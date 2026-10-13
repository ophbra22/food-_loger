"""Shared synthetic contracts: prevent false completeness, unit and rounding errors."""

import json
from decimal import Decimal
from pathlib import Path

import pytest

FIXTURE = json.loads(Path("tests/fixtures/biteflow/nutrition.json").read_text())


def test_shared_nutrition_cases_and_partial_totals():
    from foodlogger.domain import NutritionPer100, Portion
    from foodlogger.nutrition_engine import aggregate_nutrients, scale_nutrients_exact

    for case in FIXTURE["scaling"]:
        nutrition = NutritionPer100(**case["per100"])
        portion = Portion(
            quantity=case["amount"],
            unit=nutrition.basis,
            **{"normalized_" + nutrition.basis: case["amount"]},
        )
        actual = scale_nutrients_exact(nutrition, portion)
        for key, value in case["expected"].items():
            assert actual[key] == (None if value is None else Decimal(str(value)))
    row = {"energy_kcal": Decimal("0.14"), "protein_g": Decimal(0)}
    total = aggregate_nutrients([row, row, row])
    assert total["values"]["energy_kcal"] == Decimal("0.42")
    assert total["values"]["protein_g"] == 0
    assert total["values"]["fat_g"] is None
    assert total["partial"]["fat_g"] is True
    total = aggregate_nutrients([row, {"energy_kcal": None}])
    assert total["values"]["energy_kcal"] is None
    assert total["known_totals"]["energy_kcal"] == Decimal("0.14")


def test_unit_conversions_require_density_and_preserve_label_kcal():
    from foodlogger.nutrition_engine import energy_kcal, normalize_portion, sodium_mg

    assert (
        normalize_portion(
            2, "tbsp", "g", conversion_amount=15, conversion_id="tahini-v1"
        ).normalized_g
        == 30
    )
    with pytest.raises(ValueError):
        normalize_portion(2, "tbsp", "g")
    with pytest.raises(ValueError):
        normalize_portion(20, "ml", "g")
    assert normalize_portion(20, "ml", "g", density_g_per_ml="1.2").normalized_g == 24
    assert energy_kcal(kj=418.4) == 100
    assert energy_kcal(kcal=99, kj=418.4) == 99
    assert sodium_mg(sodium_g=0.1) == 100
    assert sodium_mg(salt_g=1) == 400


@pytest.mark.parametrize("value", [-1, float("inf"), float("nan"), 100001])
def test_invalid_nutrients_are_rejected(value):
    from foodlogger.domain import NutritionPer100

    with pytest.raises(ValueError):
        NutritionPer100(basis="g", energy_kcal=value)


def test_plain_hebrew_keyboard_numbers():
    from foodlogger.nutrition_engine import parse_quantity

    for text, want in FIXTURE["numbers"]:
        assert parse_quantity(text) == (None if want is None else Decimal(str(want)))


def test_time_context_rejects_nonexistent_wall_time_and_keeps_assigned_day():
    from foodlogger.domain import MealDraft

    item = {
        "id": "one",
        "display_name": "Test",
        "portion": {"quantity": 10, "unit": "g", "normalized_g": 10},
        "nutrition_per_100": {"basis": "g", "energy_kcal": 1.4},
        "source": {"provider": "manual"},
    }
    base = dict(items=[item], input_method="manual", local_date="2026-10-13", meal_category="lunch")
    legacy = MealDraft(**base)
    assert legacy.occurred_at is None and legacy.timezone_id is None
    exact = MealDraft(**base, occurred_at="2026-10-13T12:30:00+03:00", timezone_id="Asia/Jerusalem")
    assert exact.local_date.isoformat() == "2026-10-13"
    for timestamp in (
        "2026-03-27T02:30:00+02:00",
        "2026-10-13T12:30:00",
        "2026-10-13T12:30:00+02:00",
    ):
        with pytest.raises(ValueError):
            MealDraft(**base, occurred_at=timestamp, timezone_id="Asia/Jerusalem")
    with pytest.raises(ValueError):
        MealDraft(**{**base, "local_date": "2026-02-30"})


def test_legacy_adapter_preserves_ml_sodium_and_unknown_time():
    from foodlogger.domain import adapt_legacy_draft

    row = {
        "id": "old",
        "name": "Drink",
        "grams": 150,
        "day": "2026-10-12",
        "meal_type": "snack",
        "created_at": "2026-10-13T20:00:00Z",
        "calories": 63,
        "details": {"basis_unit": "ml", "nutrition_per100": {"calories": 42, "sodium": 0.1}},
    }
    draft = adapt_legacy_draft(row)
    assert draft.occurred_at is None and draft.timezone_id is None
    assert str(draft.local_date) == "2026-10-12"
    item = draft.items[0]
    assert item.portion.normalized_ml == 150 and item.portion.normalized_g is None
    assert item.nutrition_per_100.sodium_mg == 100
    assert item.nutrition_per_100.protein_g is None
    assert item.source.verified_status == "legacy_unknown"
