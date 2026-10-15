"""Conservative personal-source filtering and deterministic, editable serving suggestions."""

import json
from copy import deepcopy
from decimal import Decimal
from pathlib import Path
from typing import Literal

from pydantic import Field, StrictBool, model_validator

from foodlogger.domain import Contract, MealDraft
from foodlogger.foundation import lock_owner
from foodlogger.goals import Goals, effective_goal, progress
from foodlogger.library import Library, draft_totals, table_exists
from foodlogger.meal_service import MealConflict, digest
from foodlogger.storage import Journal, summarize_entries

Allergen = Literal[
    "milk",
    "eggs",
    "peanuts",
    "tree_nuts",
    "sesame",
    "soy",
    "wheat",
    "gluten",
    "fish",
    "shellfish",
    "celery",
    "mustard",
    "lupin",
    "sulphites",
    "other",
]
Diet = Literal["vegetarian", "vegan", "gluten_free"]
DEFAULT = dict(version=0, allergy_status="unknown", allergens=[], diets=[])


def ensure_sqlite_recommendations(database):
    if not database.postgres:
        with database.connect() as db:
            for statement in (
                (Path(__file__).parent / "data/recommendations.sql").read_text().split(";")
            ):
                if statement.strip():
                    db.execute(statement)


class PreferenceBody(Contract):
    expected_version: int = Field(ge=0)
    allergy_status: Literal["unknown", "none", "declared"] = "unknown"
    allergens: list[Allergen] = Field(default_factory=list, max_length=15)
    diets: list[Diet] = Field(default_factory=list, max_length=3)

    @model_validator(mode="after")
    def coherent(self):
        if (self.allergy_status == "declared") != bool(self.allergens):
            raise ValueError("Declared allergies require a list; unknown/none must not carry one.")
        object.__setattr__(self, "allergens", sorted(set(self.allergens)))
        object.__setattr__(self, "diets", sorted(set(self.diets)))
        return self


class SourceReview(Contract):
    source_revision: str = Field(pattern=r"^[a-f0-9]{64}$")
    expected_version: int = Field(ge=0)
    ingredients_reviewed: StrictBool = False
    allergens: list[Allergen] = Field(default_factory=list, max_length=15)
    suitable_diets: list[Diet] = Field(default_factory=list, max_length=3)


def source_revision(entry):
    return digest({k: entry[k] for k in ("kind", "id", "version", "draft")})


def allowed(preferences, review):
    allergens = set(preferences["allergens"])
    if "other" in allergens:
        return False
    restricted = bool(allergens or preferences["diets"])
    if restricted and not review["ingredients_reviewed"]:
        return False
    present = set(review["allergens"])
    if "gluten" in allergens:
        allergens.add("wheat")
    if allergens & present:
        return False
    if not set(preferences["diets"]).issubset(review["suitable_diets"]):
        return False
    if "gluten_free" in preferences["diets"] and present & {"gluten", "wheat"}:
        return False
    if "vegan" in preferences["diets"] and present & {"milk", "eggs", "fish", "shellfish"}:
        return False
    if "vegetarian" in preferences["diets"] and present & {"fish", "shellfish"}:
        return False
    return True


def scaled(entry, servings, day):
    draft = MealDraft.model_validate(
        {
            **deepcopy(entry["draft"]),
            "local_date": str(day),
            "occurred_at": None,
            "timezone_id": None,
        }
    )
    divisor = Decimal(str(entry["servings"])) if entry["kind"] == "recipe" else Decimal(1)
    factor = Decimal(str(servings)) / divisor
    draft.input_method = "recipe" if entry["kind"] == "recipe" else "repeat"
    for item in draft.items:
        item.portion.quantity *= factor
        key = "normalized_" + item.nutrition_per_100.basis
        amount = getattr(item.portion, key) * factor
        if not Decimal("0.0001") <= amount <= 2000:
            raise ValueError("Serving is outside editable bounds.")
        setattr(item.portion, key, amount)
    return draft.model_dump(mode="json"), draft_totals(draft)


def rank(pool, preferences, remaining, day):
    ranked = []
    for source in pool:
        entry, review = source["entry"], source["review"]
        if not allowed(preferences, review):
            continue
        candidates = []
        portions = (
            (Decimal(".5"), Decimal("1"), Decimal("1.5"), Decimal("2"))
            if remaining["calories"] is not None and remaining["calories"] > 0
            else (Decimal("1"),)
        )
        for portion in portions:
            try:
                draft, nutrition = scaled(entry, portion, day)
            except ValueError:
                continue
            values = nutrition["values"]
            score = Decimal(0)
            for nutrient, key, weight in [
                ("calories", "energy_kcal", 2),
                ("protein", "protein_g", 2),
                ("carbs", "carbs_g", 1),
                ("fat", "fat_g", 1),
            ]:
                target = remaining[nutrient]
                actual = values[key]
                if target is not None and target > 0:
                    if actual is None:
                        score += 3
                    else:
                        score += (
                            abs(Decimal(str(actual)) - Decimal(str(target)))
                            / Decimal(str(target))
                            * weight
                        )
            # Familiarity breaks close ties without overriding hard restriction filters.
            if entry.get("favorite"):
                score -= Decimal(".1")
            candidates.append(
                (
                    score,
                    abs(portion - 1),
                    dict(
                        entry=entry,
                        servings=float(portion),
                        draft=draft,
                        nutrition=nutrition,
                        safety_status="user_reviewed"
                        if review["ingredients_reviewed"]
                        else "unknown",
                        rationale="remaining_targets"
                        if any(v is not None and v > 0 for v in remaining.values())
                        else "familiar_portion",
                        warnings=["check_ingredients", "recorded_nutrition"]
                        + (["partial_nutrition"] if any(nutrition["partial"].values()) else []),
                    ),
                )
            )
        if candidates:
            score, _, choice = min(candidates, key=lambda x: (x[0], x[1]))
            ranked.append((score, entry["kind"], entry["id"], choice))
    return [x[3] for x in sorted(ranked, key=lambda x: x[:3])[:4]]


class Recommendations:
    def __init__(self, database):
        self.database = database

    def available(self):
        return table_exists(self.database, "recommendation_preferences")

    def _preferences(self, db, owner):
        row = db.execute(
            "SELECT version,body FROM recommendation_preferences WHERE user_id=?", (owner,)
        ).fetchone()
        return {**json.loads(row["body"]), "version": row["version"]} if row else deepcopy(DEFAULT)

    def preferences(self, owner):
        with self.database.connect() as db:
            return self._preferences(db, owner)

    def put_preferences(self, owner, body, clear=False):
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            current = self._preferences(db, owner)
            if current["version"] != body.expected_version:
                raise MealConflict("Preferences changed. Reload before saving.")
            value = body.model_dump(exclude={"expected_version"})
            db.execute(
                "INSERT INTO recommendation_preferences(user_id,version,body) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET version=excluded.version,body=excluded.body",
                (owner, current["version"] + 1, json.dumps(value)),
            )
            if clear:
                db.execute("DELETE FROM recommendation_source_reviews WHERE user_id=?", (owner,))
            return {**value, "version": current["version"] + 1}

    def _review(self, db, owner, entry):
        row = db.execute(
            "SELECT * FROM recommendation_source_reviews WHERE user_id=? AND kind=? AND source_id=?",
            (owner, entry["kind"], entry["id"]),
        ).fetchone()
        empty = dict(
            version=row["version"] if row else 0,
            ingredients_reviewed=False,
            allergens=[],
            suitable_diets=[],
        )
        return (
            {**json.loads(row["body"]), "version": row["version"]}
            if row and row["source_revision"] == source_revision(entry)
            else empty
        )

    def _pool(self, db, owner):
        favorites = db.execute(
            "SELECT kind,source_id AS id FROM library_favorites WHERE user_id=? ORDER BY created_at DESC,source_id LIMIT 20",
            (owner,),
        ).fetchall()
        recipes = db.execute(
            "SELECT 'recipe' AS kind,id FROM recipe_headers WHERE user_id=? AND deleted_at IS NULL ORDER BY updated_at DESC,id LIMIT 20",
            (owner,),
        ).fetchall()
        meals = db.execute(
            "SELECT 'meal' AS kind,id FROM meal_groups WHERE user_id=? AND deleted_at IS NULL ORDER BY local_date DESC,id LIMIT 20",
            (owner,),
        ).fetchall()
        found = set()
        result = []
        for row in [*favorites, *recipes, *meals]:
            identity = (row["kind"], row["id"])
            if identity in found:
                continue
            found.add(identity)
            try:
                entry = Library(self.database).source(db, owner, *identity)
            except (KeyError, ValueError):
                continue
            entry["favorite"] = any((f["kind"], f["id"]) == identity for f in favorites)
            result.append(
                dict(
                    entry=entry,
                    source_revision=source_revision(entry),
                    review=self._review(db, owner, entry),
                )
            )
        return result

    def sources(self, owner):
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            return dict(items=self._pool(db, owner), pool_limit=60)

    def put_review(self, owner, kind, identity, body):
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            entry = Library(self.database).source(db, owner, kind, identity)
            if source_revision(entry) != body.source_revision:
                raise MealConflict("Food changed. Review the current ingredients.")
            current = self._review(db, owner, entry)
            if current["version"] != body.expected_version:
                raise MealConflict("Ingredient review changed. Reload it.")
            value = body.model_dump(exclude={"expected_version", "source_revision"})
            db.execute(
                "INSERT INTO recommendation_source_reviews(user_id,kind,source_id,source_revision,version,body) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,kind,source_id) DO UPDATE SET source_revision=excluded.source_revision,version=excluded.version,body=excluded.body",
                (
                    owner,
                    kind,
                    identity,
                    body.source_revision,
                    current["version"] + 1,
                    json.dumps(value),
                ),
            )
            return {**value, "version": current["version"] + 1}

    def get(self, owner, day, language="en"):
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            prefs = self._preferences(db, owner)
            pool = self._pool(db, owner)
            meals = [
                Journal._public(r)
                for r in db.execute(
                    "SELECT * FROM meals WHERE user_id=? AND day=?", (owner, str(day))
                ).fetchall()
            ]
            goals = Goals._document(db, owner)
            summary = summarize_entries(meals)
            goal = effective_goal(goals, day)
            daily = progress(summary, goal)
            remaining = {k: daily[k]["remaining"] for k in ("calories", "protein", "carbs", "fat")}
            warnings = ["not_medical_advice", "check_ingredients"]
            if prefs["allergy_status"] == "unknown":
                warnings.append("allergies_unknown")
            if any(v is None for v in remaining.values()):
                warnings.append("incomplete_goals_or_logs")
            if "other" in prefs["allergens"]:
                warnings.append("unsupported_allergy")
            choices = rank(pool, prefs, remaining, day)
            if not choices:
                warnings.append("no_matching_choices")
            revision = digest(
                dict(pool=pool, preferences=prefs, goals=goals, summary=summary, day=str(day))
            )
            return dict(
                schema_version=1,
                day=str(day),
                language=language,
                revision=revision,
                preferences=prefs,
                remaining=remaining,
                choices=choices,
                warnings=warnings,
                pool_limit=60,
                ai_status="not_requested",
            )
