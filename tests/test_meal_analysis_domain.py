"""Contract tests: these labels/weights are test inputs, not vision benchmark results."""

import pytest
from pydantic import ValidationError

from foodlogger.analysis_schemas import VisionMeal
from foodlogger.nutrition_reference import ReferenceCatalog, aggregate, scale_nutrients


def vision_food(**changes):
    return {
        "id": "food_1",
        "name": "Grilled chicken",
        "search_name": "chicken breast",
        "preparation": "grilled",
        "region": "left of plate",
        "dish_type": "single",
        "visible_ingredients": [],
        "estimated_weight_g": 160,
        "weight_min_g": 120,
        "weight_max_g": 220,
        "confidence": "medium",
        "alternatives": [],
        "question": None,
        **changes,
    }


def vision_meal(**changes):
    return {
        "meal_name": "Lunch",
        "status": "food",
        "foods": [vision_food()],
        "warnings": [],
        **changes,
    }


def test_scaling_and_totals_reconcile_at_display_precision():
    chicken = scale_nutrients({"calories": 165, "protein": 31, "fat": 3.6, "carbs": 0}, 160)
    rice = scale_nutrients({"calories": 130, "protein": 2.7, "fat": 0.3, "carbs": 28.2}, 180)
    assert chicken == {"calories": 264, "protein": 49.6, "fat": 5.8, "carbs": 0}
    assert aggregate([chicken, rice]) == {
        "calories": 498,
        "protein": 54.5,
        "fat": 6.3,
        "carbs": 50.8,
    }
    assert scale_nutrients({"calories": 1.25}, 100)["calories"] == 1.3


def test_missing_values_poison_only_the_affected_total():
    assert (
        aggregate([{"calories": 100, "protein": None}, {"calories": 50, "protein": 5}])["protein"]
        is None
    )
    assert aggregate([{"calories": 100}, {"calories": 50}])["calories"] == 150
    assert scale_nutrients({}, 100)["calories"] is None


@pytest.mark.parametrize("grams", [0, -1, 2001, float("nan"), float("inf")])
def test_unsafe_grams_are_rejected(grams):
    with pytest.raises(ValueError):
        scale_nutrients({"calories": 100}, grams)


@pytest.mark.parametrize(
    "changes",
    [
        {"estimated_weight_g": -1},
        {"weight_min_g": 180},
        {"weight_max_g": 100},
        {"estimated_weight_g": float("nan")},
        {"nutrition_source_id": "made-up"},
        {"estimated_weight_g": True},
        {"name": " "},
    ],
)
def test_model_contract_rejects_bad_weights_and_invented_provenance(changes):
    with pytest.raises(ValidationError):
        VisionMeal.model_validate(vision_meal(foods=[vision_food(**changes)]))


def test_duplicate_component_ids_and_food_in_no_food_are_rejected():
    with pytest.raises(ValidationError):
        VisionMeal.model_validate(vision_meal(foods=[vision_food(), vision_food()]))
    with pytest.raises(ValidationError):
        VisionMeal.model_validate(vision_meal(status="no_food"))
    assert VisionMeal.model_validate(vision_meal(status="no_food", foods=[])).foods == []


def test_actual_usda_extract_and_conservative_matching():
    catalog = ReferenceCatalog()
    chicken = catalog.get("fdc:171477")
    assert chicken.source == "USDA FoodData Central"
    assert chicken.nutrition.calories == 165
    assert chicken.nutrition.protein == 31.0  # Exact value in the official archive.
    assert "cooked" in chicken.name.lower()
    cooked = catalog.search("chicken breast", preparation="grilled")
    assert cooked and "grilled" in cooked[0].name.lower()
    assert all("raw" not in row.name.lower() for row in cooked)
    assert catalog.search("rice white", preparation="cooked")
    assert catalog.search("xylophone unicorn mystery", preparation="unknown") == []
    assert catalog.search("tahini sauce", preparation="unknown") == []
    assert catalog.search("חומוס")
    assert catalog.search("falafel")


def test_nutrition_record_ids_must_exist():
    with pytest.raises(KeyError):
        ReferenceCatalog().get("fdc:invented")


def test_generic_food_is_not_matched_to_a_recipe_containing_that_food():
    from foodlogger.nutrition_reference import ReferenceCatalog

    refs = ReferenceCatalog()
    assert refs.search("grilled meat", "grilled") == []
    assert all("cookie" not in r.name.lower() for r in refs.search("oatmeal", "baked"))
    assert refs.search("almonds", "raw")
    assert "oil" not in refs.search("almonds", "raw")[0].name.lower()
    assert "paste" not in refs.search("almonds", "raw")[0].name.lower()
    assert "liver" not in refs.search("sliced sausage", "cooked")[0].name.lower()
    assert "glutinous" not in refs.search("rice white", "cooked")[0].name.lower()
