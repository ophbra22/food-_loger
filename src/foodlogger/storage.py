"""SQLite journal. Stored nutrient snapshots do not change with catalog updates."""

import json
import sqlite3
from contextlib import contextmanager
from datetime import UTC, date, datetime
from pathlib import Path
from uuid import uuid4

from foodlogger.nutrition import NUTRIENTS, Catalog
from foodlogger.schemas import CustomMealCreate, MealCreate


class Journal:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("""
                CREATE TABLE IF NOT EXISTS meals (
                    id TEXT PRIMARY KEY, day TEXT NOT NULL, meal_type TEXT NOT NULL,
                    food_id TEXT NOT NULL, name TEXT NOT NULL, emoji TEXT NOT NULL,
                    grams REAL NOT NULL CHECK (grams >= 1 AND grams <= 2000),
                    calories REAL NOT NULL, protein REAL NOT NULL,
                    carbs REAL NOT NULL, fat REAL NOT NULL, created_at TEXT NOT NULL
                )
            """)
            db.execute("CREATE INDEX IF NOT EXISTS meals_day ON meals(day)")
            columns = {row["name"] for row in db.execute("PRAGMA table_info(meals)")}
            if "user_id" not in columns:
                db.execute(
                    "ALTER TABLE meals ADD COLUMN user_id TEXT NOT NULL DEFAULT '__legacy__'"
                )
            if "details" not in columns:
                db.execute("ALTER TABLE meals ADD COLUMN details TEXT NOT NULL DEFAULT '{}'")
            db.execute("CREATE INDEX IF NOT EXISTS meals_owner_day ON meals(user_id, day)")

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def add(self, meal: MealCreate, catalog: Catalog, *, user_id: str) -> dict:
        food = catalog.get(meal.food_id)
        entry = {
            "id": uuid4().hex,
            "day": meal.day.isoformat(),
            "meal_type": meal.meal_type,
            "food_id": meal.food_id,
            "name": food["name"],
            "emoji": food["emoji"],
            "grams": meal.grams,
            **catalog.estimate(meal.food_id, meal.grams),
            "created_at": datetime.now(UTC).isoformat(),
            "details": {"basis_unit": "g", "source": "catalog"},
        }
        self._insert(entry, user_id)
        return entry

    def add_custom(self, meal: CustomMealCreate, *, user_id: str) -> dict:
        per100 = meal.nutrition.model_dump(exclude_none=True)
        totals = {key: round(value * meal.grams / 100, 3) for key, value in per100.items()}
        entry = {
            "id": uuid4().hex,
            "day": meal.day.isoformat(),
            "meal_type": meal.meal_type,
            "food_id": "custom",
            "name": meal.name,
            "emoji": "🥣",
            "grams": meal.grams,
            **{key: round(totals[key], 1) for key in NUTRIENTS},
            "created_at": datetime.now(UTC).isoformat(),
            "details": {
                "basis_unit": meal.basis_unit,
                "source": meal.source,
                "brand": meal.brand,
                "barcode": meal.barcode,
                "nutrition_per100": per100,
                "nutrition_total": totals,
                "raw_nutriments": meal.raw_nutriments,
            },
        }
        self._insert(entry, user_id)
        return entry

    def _insert(self, entry: dict, user_id: str):
        with self.connect() as db:
            db.execute(
                """INSERT INTO meals
                (id,day,meal_type,food_id,name,emoji,grams,calories,protein,carbs,fat,
                 created_at,user_id,details) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                tuple(
                    entry[key]
                    for key in (
                        "id",
                        "day",
                        "meal_type",
                        "food_id",
                        "name",
                        "emoji",
                        "grams",
                        "calories",
                        "protein",
                        "carbs",
                        "fat",
                        "created_at",
                    )
                )
                + (user_id, json.dumps(entry["details"], ensure_ascii=False)),
            )

    def list(self, day: date, *, user_id: str) -> list[dict]:
        with self.connect() as db:
            rows = db.execute(
                "SELECT * FROM meals WHERE day = ? AND user_id = ? "
                "ORDER BY created_at DESC, id DESC",
                (day.isoformat(), user_id),
            ).fetchall()
        entries = []
        for row in rows:
            entry = dict(row)
            entry.pop("user_id")
            entry["details"] = json.loads(entry["details"])
            entries.append(entry)
        return entries

    def summary(self, day: date, *, user_id: str) -> dict:
        meals = self.list(day, user_id=user_id)
        return {
            "count": len(meals),
            **{key: round(sum(meal[key] for meal in meals), 1) for key in NUTRIENTS},
        }

    def delete(self, meal_id: str, *, user_id: str) -> bool:
        with self.connect() as db:
            return (
                db.execute(
                    "DELETE FROM meals WHERE id = ? AND user_id = ?", (meal_id, user_id)
                ).rowcount
                > 0
            )
