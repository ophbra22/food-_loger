"""SQLite journal. Stored nutrient snapshots do not change with catalog updates."""

import sqlite3
from contextlib import contextmanager
from datetime import UTC, date, datetime
from pathlib import Path
from uuid import uuid4

from foodlogger.nutrition import NUTRIENTS, Catalog
from foodlogger.schemas import MealCreate


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

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def add(self, meal: MealCreate, catalog: Catalog) -> dict:
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
        }
        with self.connect() as db:
            db.execute("INSERT INTO meals VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", tuple(entry.values()))
        return entry

    def list(self, day: date) -> list[dict]:
        with self.connect() as db:
            rows = db.execute(
                "SELECT * FROM meals WHERE day = ? ORDER BY created_at DESC, id DESC",
                (day.isoformat(),),
            ).fetchall()
        return [dict(row) for row in rows]

    def summary(self, day: date) -> dict:
        meals = self.list(day)
        return {
            "count": len(meals),
            **{key: round(sum(meal[key] for meal in meals), 1) for key in NUTRIENTS},
        }

    def delete(self, meal_id: str) -> bool:
        with self.connect() as db:
            return db.execute("DELETE FROM meals WHERE id = ?", (meal_id,)).rowcount > 0
