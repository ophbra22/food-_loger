import sqlite3
from datetime import date

import pytest
from pydantic import ValidationError

from foodlogger.nutrition import Catalog
from foodlogger.schemas import CustomMealCreate, MealCreate
from foodlogger.storage import Journal

DAY = date(2026, 10, 8)


def test_every_journal_operation_is_scoped_to_its_owner(tmp_path):
    journal = Journal(tmp_path / "journal.sqlite3")
    entry = journal.add(
        MealCreate(food_id="banana", grams=150, day=DAY, meal_type="snack"),
        Catalog(),
        user_id="alice",
    )
    assert len(journal.list(DAY, user_id="alice")) == 1
    assert journal.list(DAY, user_id="bob") == []
    assert journal.summary(DAY, user_id="bob")["calories"] == 0
    assert journal.delete(entry["id"], user_id="bob") is False
    assert journal.delete(entry["id"], user_id="alice") is True


def test_product_preserves_detailed_nutrition_and_scales_portions(tmp_path):
    journal = Journal(tmp_path / "journal.sqlite3")
    meal = CustomMealCreate(
        name="Protein pudding",
        brand="Test brand",
        barcode="7290000000003",
        grams=200,
        basis_unit="g",
        day=DAY,
        meal_type="snack",
        source="barcode",
        nutrition={"calories": 75, "protein": 10, "carbs": 6, "fat": 1, "sugars": 4, "salt": 0.1},
        raw_nutriments={"calcium_100g": 0.2, "calcium_unit": "g"},
    )
    entry = journal.add_custom(meal, user_id="alice")
    assert entry["calories"] == 150
    assert entry["protein"] == 20
    loaded = journal.list(DAY, user_id="alice")[0]
    assert loaded["details"]["nutrition_total"]["sugars"] == 8
    assert loaded["details"]["raw_nutriments"]["calcium_100g"] == 0.2
    assert loaded["details"]["barcode"] == "7290000000003"


def test_liquid_nutrition_is_scaled_by_milliliters(tmp_path):
    journal = Journal(tmp_path / "journal.sqlite3")
    meal = CustomMealCreate(
        name="Milk",
        grams=250,
        basis_unit="ml",
        day=DAY,
        meal_type="breakfast",
        nutrition={"calories": 50, "protein": 3.5, "carbs": 5, "fat": 2},
    )
    entry = journal.add_custom(meal, user_id="alice")
    assert entry["calories"] == 125
    assert entry["details"]["basis_unit"] == "ml"


def test_missing_or_nonfinite_required_nutrients_are_not_silently_zeroed():
    payload = dict(name="Pudding", grams=100, day=DAY, meal_type="snack")
    with pytest.raises(ValidationError):
        CustomMealCreate(**payload, nutrition={"calories": 50, "carbs": 3, "fat": 1})
    with pytest.raises(ValidationError):
        CustomMealCreate(
            **payload, nutrition={"calories": 50, "protein": float("nan"), "carbs": 3, "fat": 1}
        )


def test_legacy_local_rows_are_migrated_without_becoming_public(tmp_path):
    path = tmp_path / "old.sqlite3"
    with sqlite3.connect(path) as db:
        db.execute("""CREATE TABLE meals (
        id TEXT PRIMARY KEY,day TEXT,meal_type TEXT,food_id TEXT,name TEXT,emoji TEXT,
        grams REAL,calories REAL,protein REAL,carbs REAL,fat REAL,created_at TEXT)""")
        db.execute(
            "INSERT INTO meals VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            ("old", "2026-10-08", "snack", "banana", "Banana", "🍌", 100, 89, 1, 23, 0.3, "old"),
        )
    journal = Journal(path)
    assert journal.list(DAY, user_id="new-public-user") == []
    with sqlite3.connect(path) as db:
        assert db.execute("SELECT COUNT(*) FROM meals").fetchone()[0] == 1
        assert db.execute("SELECT user_id FROM meals").fetchone()[0] == "__legacy__"
