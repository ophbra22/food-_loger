"""Versioned personal recipes; each ingredient version is a frozen canonical item."""

import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Annotated

from pydantic import Field, model_validator

from foodlogger.domain import Amount, Contract, MealDraft, MealDraftItem
from foodlogger.foundation import lock_owner
from foodlogger.library import draft_totals, table_exists
from foodlogger.meal_service import MealConflict, digest, request_hash
from foodlogger.nutrition_engine import scale_nutrients_exact


def ensure_sqlite_recipes(database):
    if not database.postgres:
        with database.connect() as db:
            for statement in (Path(__file__).parent / "data/recipes.sql").read_text().split(";"):
                if statement.strip():
                    db.execute(statement)


class RecipeBody(Contract):
    name: str = Field(min_length=1, max_length=120, pattern=r"^[^\x00-\x1f]+$")
    servings: Annotated[Amount, Field(ge=Decimal("0.01"), le=1000)]
    items: list[MealDraftItem] = Field(min_length=1, max_length=15)

    @model_validator(mode="after")
    def validate_items(self):
        if not self.name.strip():
            raise ValueError("Recipe name is required.")
        if len({x.id for x in self.items}) != len(self.items):
            raise ValueError("Ingredient IDs must be unique.")
        for item in self.items:
            amount = getattr(item.portion, "normalized_" + item.nutrition_per_100.basis)
            if amount is None or not Decimal("0.0001") <= amount <= 2000:
                raise ValueError(
                    "Resolve every ingredient to its matching g/ml basis (0.0001–2000)."
                )
            if item.source.verified_status == "verified":
                raise ValueError("Use user-confirmed source values.")
            scale_nutrients_exact(item.nutrition_per_100, item.portion)
        return self


class RecipePatch(RecipeBody):
    expected_version: int = Field(ge=1)


class RecipeDuplicate(Contract):
    expected_version: int = Field(ge=1)
    name: str = Field(min_length=1, max_length=120, pattern=r"^[^\x00-\x1f]+$")


class Recipes:
    def __init__(self, database):
        self.database = database

    def available(self):
        return table_exists(self.database, "recipe_headers")

    def _get(self, db, owner, identity, version=None):
        header = db.execute(
            "SELECT * FROM recipe_headers WHERE user_id=? AND id=? AND deleted_at IS NULL",
            (owner, identity),
        ).fetchone()
        if not header:
            raise KeyError("Recipe no longer exists.")
        version = header["current_version"] if version is None else version
        row = db.execute(
            "SELECT * FROM recipe_versions WHERE user_id=? AND recipe_id=? AND version=?",
            (owner, identity, version),
        ).fetchone()
        if not row:
            raise KeyError("Recipe version no longer exists.")
        items = [
            json.loads(r["item"])
            for r in db.execute(
                "SELECT item FROM recipe_items WHERE user_id=? AND recipe_id=? AND "
                "version=? ORDER BY position",
                (owner, identity, version),
            ).fetchall()
        ]
        draft = MealDraft(
            input_method="recipe",
            local_date=row["created_at"][:10],
            meal_category="lunch",
            items=items,
        )
        favorite = bool(
            db.execute(
                "SELECT 1 FROM library_favorites WHERE user_id=? AND kind='recipe' AND source_id=?",
                (owner, identity),
            ).fetchone()
        )
        return {
            "kind": "recipe",
            "id": identity,
            "version": version,
            "name": row["name"],
            "servings": row["servings"],
            "draft": draft.model_dump(mode="json"),
            "favorite": favorite,
            "totals": draft_totals(draft),
            "per_serving": draft_totals(draft, Decimal(str(row["servings"]))),
            "created_at": row["created_at"],
        }

    def get(self, owner, identity):
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            return self._get(db, owner, identity)

    def list(self, owner, query="", limit=20, offset=0):
        escaped = query.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            rows = db.execute(
                "SELECT h.id FROM recipe_headers h JOIN recipe_versions v ON "
                "v.user_id=h.user_id AND v.recipe_id=h.id AND "
                "v.version=h.current_version WHERE h.user_id=? AND h.deleted_at IS "
                "NULL AND LOWER(v.name) LIKE ? ESCAPE '\\' ORDER BY h.updated_at "
                "DESC,h.id DESC LIMIT ? OFFSET ?",
                (owner, "%" + escaped + "%", limit + 1, offset),
            ).fetchall()
            return {
                "items": [self._get(db, owner, r["id"]) for r in rows[:limit]],
                "next_offset": offset + limit if len(rows) > limit else None,
            }

    def versions(self, owner, identity):
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            self._get(db, owner, identity)
            rows = db.execute(
                "SELECT version FROM recipe_versions WHERE user_id=? AND recipe_id=? "
                "ORDER BY version",
                (owner, identity),
            ).fetchall()
            return {"versions": [self._get(db, owner, identity, r["version"]) for r in rows]}

    def _version(self, db, owner, identity, body, version, now):
        db.execute(
            "INSERT INTO "
            "recipe_versions(user_id,recipe_id,version,name,servings,created_at) "
            "VALUES (?,?,?,?,?,?)",
            (owner, identity, version, body.name.strip(), float(body.servings), now),
        )
        for i, item in enumerate(body.items):
            db.execute(
                "INSERT INTO recipe_items(user_id,recipe_id,version,position,item) "
                "VALUES (?,?,?,?,?)",
                (owner, identity, version, i, item.model_dump_json()),
            )

    def _create(self, db, owner, body, key, operation, payload):
        identity = request_hash(owner, key)
        fingerprint = digest(payload)
        receipt = db.execute(
            "SELECT * FROM library_requests WHERE user_id=? AND request_hash=?", (owner, identity)
        ).fetchone()
        if receipt:
            if receipt["digest"] != fingerprint or receipt["operation"] != operation:
                raise MealConflict("Retry key was used for different content.")
            try:
                return self._get(db, owner, json.loads(receipt["result"])["id"]), False
            except KeyError:
                raise MealConflict(
                    "Recipe was deleted. It cannot be recreated by retrying."
                ) from None
        now = datetime.now(UTC).isoformat()
        db.execute(
            "INSERT INTO "
            "recipe_headers(user_id,id,current_version,created_at,updated_at) "
            "VALUES (?,?,1,?,?)",
            (owner, identity, now, now),
        )
        self._version(db, owner, identity, body, 1, now)
        db.execute(
            "INSERT INTO "
            "library_requests(user_id,request_hash,digest,operation,result,created_at) VALUES (?,?,?,?,?,?)",
            (owner, identity, fingerprint, operation, json.dumps({"id": identity}), now),
        )
        return self._get(db, owner, identity), True

    def create(self, owner, body, key):
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            return self._create(db, owner, body, key, "recipe-create", body.model_dump(mode="json"))

    def patch(self, owner, identity, body):
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            before = self._get(db, owner, identity)
            if before["version"] != body.expected_version:
                raise MealConflict("Recipe changed. Reload before editing.")
            version = before["version"] + 1
            now = datetime.now(UTC).isoformat()
            self._version(db, owner, identity, body, version, now)
            db.execute(
                "UPDATE recipe_headers SET current_version=?,updated_at=? WHERE user_id=? AND id=?",
                (version, now, owner, identity),
            )
            return self._get(db, owner, identity)

    def duplicate(self, owner, identity, selection, key):
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            # A successful duplicate retry must not depend on the source remaining unchanged.
            request_id = request_hash(owner, key)
            payload = {"source": identity, **selection.model_dump(mode="json")}
            receipt = db.execute(
                "SELECT * FROM library_requests WHERE user_id=? AND request_hash=?",
                (owner, request_id),
            ).fetchone()
            if receipt:
                if (
                    receipt["digest"] != digest(payload)
                    or receipt["operation"] != "recipe-duplicate"
                ):
                    raise MealConflict("Retry key was used for different content.")
                try:
                    return self._get(db, owner, json.loads(receipt["result"])["id"]), False
                except KeyError:
                    raise MealConflict("Duplicate was deleted.") from None
            source = self._get(db, owner, identity)
            if source["version"] != selection.expected_version:
                raise MealConflict("Recipe changed. Reload before duplicating.")
            body = RecipeBody(
                name=selection.name, servings=source["servings"], items=source["draft"]["items"]
            )
            return self._create(db, owner, body, key, "recipe-duplicate", payload)

    def delete(self, owner, identity, expected_version):
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            before = self._get(db, owner, identity)
            if before["version"] != expected_version:
                raise MealConflict("Recipe changed. Reload before deleting.")
            db.execute(
                "UPDATE recipe_headers SET deleted_at=?,updated_at=? WHERE user_id=? AND id=?",
                (datetime.now(UTC).isoformat(), datetime.now(UTC).isoformat(), owner, identity),
            )
            db.execute(
                "DELETE FROM library_favorites WHERE user_id=? AND kind='recipe' AND source_id=?",
                (owner, identity),
            )
