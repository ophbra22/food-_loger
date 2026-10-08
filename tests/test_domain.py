from datetime import date

import pytest
from pydantic import ValidationError

from foodlogger.nutrition import Catalog
from foodlogger.schemas import MealCreate
from foodlogger.storage import Journal


def test_nutrition_scales_a_measured_portion():
    result = Catalog().estimate("banana", 150)
    assert result == {"calories": 133.5, "protein": 1.6, "carbs": 34.3, "fat": 0.5}


@pytest.mark.parametrize("grams", [0, -1, 2001, float("nan"), float("inf")])
def test_invalid_portions_are_rejected(grams):
    with pytest.raises((ValueError, ValidationError)):
        Catalog().estimate("banana", grams)


def test_unknown_food_does_not_get_invented_nutrition():
    with pytest.raises(KeyError):
        Catalog().estimate("unicorn", 100)


def test_meal_validation():
    with pytest.raises(ValidationError):
        MealCreate(food_id="banana", grams=100, day="2026-02-30", meal_type="breakfast")
    with pytest.raises(ValidationError):
        MealCreate(food_id="banana", grams=100, day="2026-10-08", meal_type="anything")


def test_journal_persists_filters_dates_and_deletes(tmp_path):
    path = tmp_path / "journal.sqlite3"
    catalog = Catalog()
    journal = Journal(path)
    meal = MealCreate(food_id="banana", grams=150, day="2026-10-08", meal_type="breakfast")
    entry = journal.add(meal, catalog, user_id="alice")
    journal = Journal(path)
    assert journal.list(date(2026, 10, 8), user_id="alice")[0]["id"] == entry["id"]
    assert journal.list(date(2026, 10, 9), user_id="alice") == []
    assert journal.summary(date(2026, 10, 8), user_id="alice")["calories"] == 133.5
    assert journal.summary(date(2026, 10, 8), user_id="alice")["count"] == 1
    assert journal.delete(entry["id"], user_id="alice") is True
    assert journal.delete(entry["id"], user_id="alice") is False
    assert journal.summary(date(2026, 10, 8), user_id="alice")["count"] == 0


def test_nutrition_snapshot_and_sql_parameters(tmp_path):
    journal = Journal(tmp_path / "journal.sqlite3")
    entry = journal.add(
        MealCreate(food_id="pizza", grams=100, day="2026-10-08", meal_type="dinner"),
        Catalog(),
        user_id="alice",
    )
    assert entry["calories"] == Catalog().estimate("pizza", 100)["calories"]
    assert journal.delete("' OR 1=1 --", user_id="alice") is False
    assert len(journal.list(date(2026, 10, 8), user_id="alice")) == 1
