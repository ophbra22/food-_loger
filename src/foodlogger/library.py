"""Owner-scoped links to existing immutable journal snapshots. No provider calls."""

from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Literal

from pydantic import Field

from foodlogger.domain import LEGACY_NUTRIENTS, Contract, MealDraft, MealDraftItem
from foodlogger.foundation import Foundation, lock_owner
from foodlogger.nutrition_engine import aggregate_nutrients, scale_nutrients_exact


def ensure_sqlite_library(database):
    if not database.postgres:
        with database.connect() as db:
            for statement in (Path(__file__).parent / "data/library.sql").read_text().split(";"):
                if statement.strip():
                    db.execute(statement)


class Favorite(Contract):
    kind: Literal["meal", "recipe"]
    id: str = Field(pattern=r"^[a-f0-9]{32}$")


def table_exists(database, name):
    with database.connect() as db:
        if database.postgres:
            return bool(
                db.execute("SELECT to_regclass(?) AS name", ("foodlogger." + name,)).fetchone()[
                    "name"
                ]
            )
        return bool(
            db.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
            ).fetchone()
        )


def snapshot_draft(group):
    """Read saved components only, including after a legacy component deletion.

    Canonical rows retain their nutrient source. Legacy rows use their recorded
    totals as the scaling basis, never current catalog/reference nutrition.
    """
    items = []
    for row in group["snapshot"].get("meals", []):
        raw = row.get("details", {}).get("canonical_item")
        if raw:
            item = MealDraftItem.model_validate(raw)
        else:
            details = row.get("details", {})
            amount = row["grams"]
            basis = details.get("basis_unit", "g")
            totals = {
                **details.get("nutrition_total", {}),
                **{k: row.get(k) for k in ("calories", "protein", "carbs", "fat")},
            }
            values = {
                new: None
                if totals.get(old) is None
                else totals[old] * 100 / amount * (1000 if old == "sodium" else 1)
                for old, new in LEGACY_NUTRIENTS.items()
            }
            item = MealDraftItem.model_validate(
                {
                    "id": row["id"],
                    "display_name": row["name"],
                    "portion": {"quantity": amount, "unit": basis, "normalized_" + basis: amount},
                    "nutrition_per_100": {"basis": basis, **values},
                    "source": {
                        "provider": "historical_snapshot",
                        "reference_id": row["id"],
                        "verified_status": "legacy_unknown",
                    },
                    "warnings": ["historical_snapshot_scaling"],
                }
            )
        # Retaining a source label does not grant a new client authority to verify it.
        if item.source.verified_status == "verified":
            item.source.verified_status = "user_confirmed"
        items.append(item)
    return MealDraft(
        input_method="repeat",
        local_date=group["local_date"],
        occurred_at=group.get("occurred_at"),
        timezone_id=group.get("timezone_id"),
        meal_category=group["snapshot"]["meals"][0]["meal_type"],
        items=items,
        warnings=["historical_snapshot_scaling"] if not group["snapshot"].get("draft") else [],
    )


def draft_totals(draft, divisor=Decimal(1)):
    total = aggregate_nutrients(
        [scale_nutrients_exact(x.nutrition_per_100, x.portion) for x in draft.items]
    )
    return {
        k: v
        if k == "partial"
        else {n: None if a is None else float(a / divisor) for n, a in v.items()}
        for k, v in total.items()
    }


class Library:
    def __init__(self, database):
        self.database = database

    def available(self):
        return table_exists(self.database, "library_favorites")

    def meal(self, db, owner, identity):
        row = db.execute(
            "SELECT * FROM meal_groups WHERE user_id=? AND id=? AND deleted_at IS NULL",
            (owner, identity),
        ).fetchone()
        if not row:
            raise KeyError("Meal no longer exists.")
        group = Foundation.public(row)
        draft = snapshot_draft(group)
        return {
            "kind": "meal",
            "id": identity,
            "version": group["version"],
            "name": ", ".join(x.display_name for x in draft.items)[:120],
            "servings": 1,
            "draft": draft.model_dump(mode="json"),
            "totals": draft_totals(draft),
        }

    def source(self, db, owner, kind, identity):
        if kind == "meal":
            return self.meal(db, owner, identity)
        from foodlogger.recipes import Recipes

        return Recipes(self.database)._get(db, owner, identity)

    def list(self, owner, *, favorites=False, query="", limit=20, offset=0):
        if favorites:
            return self.favorites(owner, query, limit, offset)
        escaped = query.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            sql = (
                "SELECT g.id,MAX(m.created_at) AS logged_at FROM meal_groups g "
                "JOIN meal_group_items i ON i.user_id=g.user_id AND i.group_id=g.id "
                "JOIN meals m ON m.user_id=i.user_id AND m.id=i.entry_id "
                "WHERE g.user_id=? AND g.deleted_at IS NULL "
            )
            args = [owner]
            if favorites:
                sql += (
                    "AND EXISTS (SELECT 1 FROM library_favorites f WHERE "
                    "f.user_id=g.user_id AND f.kind='meal' AND f.source_id=g.id) "
                )
            if query:
                sql += (
                    "AND EXISTS (SELECT 1 FROM meals s JOIN meal_group_items si ON "
                    "si.user_id=s.user_id AND si.entry_id=s.id "
                    "WHERE si.user_id=g.user_id AND si.group_id=g.id AND LOWER(s.name) "
                    "LIKE ? ESCAPE '\\') "
                )
                args.append("%" + escaped + "%")
            sql += (
                "GROUP BY g.id,g.local_date ORDER BY g.local_date DESC,logged_at "
                "DESC,g.id DESC LIMIT ? OFFSET ?"
            )
            rows = db.execute(sql, (*args, limit + 1, offset)).fetchall()
            items = []
            for row in rows[:limit]:
                entry = self.source(db, owner, "meal", row["id"])
                entry["favorite"] = bool(
                    db.execute(
                        "SELECT 1 FROM library_favorites WHERE user_id=? AND kind=? AND "
                        "source_id=?",
                        (owner, "meal", row["id"]),
                    ).fetchone()
                )
                items.append(entry)
            return {"items": items, "next_offset": offset + limit if len(rows) > limit else None}

    def favorites(self, owner, query, limit, offset):
        # Union identity links, not duplicate catalog records. Deleted sources are hidden.
        recipes = table_exists(self.database, "recipe_headers")
        escaped = query.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            sql = (
                "SELECT f.kind,f.source_id,f.created_at FROM library_favorites f "
                "JOIN meal_groups g ON g.user_id=f.user_id AND g.id=f.source_id "
                "WHERE f.user_id=? AND f.kind='meal' AND g.deleted_at IS NULL "
                "AND EXISTS (SELECT 1 FROM meals m JOIN meal_group_items i "
                "ON i.user_id=m.user_id AND i.entry_id=m.id WHERE i.user_id=g.user_id "
                "AND i.group_id=g.id AND LOWER(m.name) LIKE ? ESCAPE '\\')"
            )
            args = [owner, "%" + escaped + "%"]
            if recipes:
                sql += (
                    " UNION ALL SELECT f.kind,f.source_id,f.created_at FROM library_favorites f "
                    "JOIN recipe_headers h ON h.user_id=f.user_id AND h.id=f.source_id "
                    "JOIN recipe_versions v ON v.user_id=h.user_id AND v.recipe_id=h.id "
                    "AND v.version=h.current_version WHERE f.user_id=? AND f.kind='recipe' "
                    "AND h.deleted_at IS NULL AND LOWER(v.name) LIKE ? ESCAPE '\\'"
                )
                args.extend([owner, "%" + escaped + "%"])
            sql += " ORDER BY created_at DESC,source_id DESC LIMIT ? OFFSET ?"
            rows = db.execute(sql, (*args, limit + 1, offset)).fetchall()
            return {
                "items": [
                    {**self.source(db, owner, r["kind"], r["source_id"]), "favorite": True}
                    for r in rows[:limit]
                ],
                "next_offset": offset + limit if len(rows) > limit else None,
            }

    def favorite(self, owner, selection):
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            self.source(db, owner, selection.kind, selection.id)
            db.execute(
                "INSERT INTO library_favorites(user_id,kind,source_id,created_at) "
                "VALUES (?,?,?,?) ON CONFLICT(user_id,kind,source_id) DO NOTHING",
                (owner, selection.kind, selection.id, datetime.now(UTC).isoformat()),
            )
            return {"kind": selection.kind, "id": selection.id, "favorite": True}

    def unfavorite(self, owner, kind, identity):
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            db.execute(
                "DELETE FROM library_favorites WHERE user_id=? AND kind=? AND source_id=?",
                (owner, kind, identity),
            )
