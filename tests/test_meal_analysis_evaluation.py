"""Metrics themselves must not turn missing evidence into measured accuracy."""

import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "meal_eval", Path("scripts/evaluate_meal_analysis.py")
)
evaluation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evaluation)


def test_alias_matching_distinguishes_sweet_potato_and_counts_extra_predictions():
    assert evaluation.canonical("Sweet potato") == "yam"
    assert evaluation.detection(["yam", "chicken"], ["sweet potato", "chicken", "chicken"]) == {
        "tp": 2,
        "fp": 1,
        "fn": 0,
    }


def test_failed_run_does_not_become_zero_error_or_successful_abstention():
    result = evaluation.summarize([{"status": "failed"}])
    assert result["completed"] == 0
    assert result["recall"] is None and result["mean_absolute_error"]["grams"] is None
    assert result["failed_or_blocked"] == 1


def test_unavailable_images_count_as_missed_items_in_end_to_end_recall():
    rows = [
        {
            "status": "ok",
            "elapsed_ms": 10,
            "expected_food_count": 2,
            "detection": {"tp": 2, "fp": 0, "fn": 0},
        },
        {"status": "failed", "expected_food_count": 3},
    ]
    result = evaluation.summarize(rows)
    assert result["recall"] == 1  # Recognition conditional on a successful response.
    assert result["end_to_end_recall"] == 0.4
    assert result["completion_rate"] == 0.5
