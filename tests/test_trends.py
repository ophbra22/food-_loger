"""Hand-calculated period fixtures catch zero-filled gaps and rewritten historical goals."""

from datetime import date

import pytest
from fastapi.testclient import TestClient
from test_meal_analysis_pipeline import register
from test_tracking import add

from foodlogger.app import create_app
from foodlogger.security import Settings


@pytest.fixture
def client(tmp_path):
    with TestClient(
        create_app(
            tmp_path / "trends.db",
            settings=Settings(
                goals_enabled=True, tracking_enabled=True, tracking_writes=True, trends_enabled=True
            ),
        )
    ) as c:
        yield c


def meal(c, h, day, calories=100):
    result = c.post(
        "/api/meals/custom",
        headers=h,
        json=dict(
            name="Fixture",
            grams=100,
            day=day,
            meal_type="lunch",
            nutrition=dict(calories=calories, protein=10, carbs=12, fat=1),
        ),
    )
    assert result.status_code == 201
    return result.json()


def trends(c, h, start="2026-10-11", end="2026-10-17"):
    return c.get(f"/api/trends?from={start}&to={end}", headers=h)


def test_three_logged_days_four_gaps_and_effective_targets(client):
    h = register(client, "alice")
    for day, cal in [("11", 100), ("13", 200), ("16", 300)]:
        meal(client, h, "2026-10-" + day, cal)
    for n, (day, cal) in enumerate([("11", 100), ("14", 300)]):
        assert (
            client.put(
                "/api/goals",
                headers=h,
                json=dict(
                    effective_local_date="2026-10-" + day,
                    timezone_id="UTC",
                    expected_version=n,
                    allow_past=True,
                    calorie_target=cal,
                ),
            ).status_code
            == 200
        )
    r = trends(client, h)
    assert r.status_code == 200, r.text
    r = r.json()
    s = r["current"]["statistics"]
    days = r["current"]["days"]
    assert s["logged_days"] == 3 and s["unlogged_days"] == 4
    assert s["average"]["calories"] == 200
    assert s["calorie_in_range"] == 2 and s["calorie_eligible_days"] == 3
    assert [d["calories"] for d in days] == [100, None, 200, None, None, 300, None]
    assert (
        days[2]["targets"]["calorie_target"] == 100 and days[3]["targets"]["calorie_target"] == 300
    )
    assert r["previous"]["from"] == "2026-10-04" and r["previous"]["to"] == "2026-10-10"
    assert r["previous"]["statistics"]["average"]["calories"] is None
    assert s["insufficient_data"] is True
    assert r["comparison"]["calories"] is None


def test_daily_latest_weight_measured_date_average_and_water(client):
    h = register(client, "alice")
    for n, (day, hour, value) in enumerate(
        [("11", "09", 70), ("13", "08", 71), ("13", "10", 69.5)]
    ):
        assert (
            add(
                client,
                h,
                kind="weight",
                key=f"weight-fixture-{n}",
                value=value,
                local_date="2026-10-" + day,
                occurred_at=f"2026-10-{day}T{hour}:00:00+03:00",
            ).status_code
            == 201
        )
    assert add(client, h).status_code == 201
    assert add(client, h, key="water-fixture-002", value=500).status_code == 201
    r = trends(client, h).json()["current"]
    assert [d["weight"] for d in r["days"]] == [70, None, 69.5, None, None, None, None]
    assert r["statistics"]["average"]["weight"] == 69.75
    assert r["statistics"]["measured_days"] == 2
    assert r["days"][0]["water"] == 750 and r["days"][1]["water"] is None
    assert r["statistics"]["average"]["water"] == 750


def test_historical_delete_and_move_recompute_and_user_b_is_empty(client):
    a = register(client, "alice")
    b = register(client, "bob")
    m = meal(client, a, "2026-10-11", 150)
    assert trends(client, a).json()["current"]["statistics"]["average"]["calories"] == 150
    assert trends(client, b).json()["current"]["statistics"]["logged_days"] == 0
    assert client.delete("/api/meals/" + m["id"], headers=a).status_code == 204
    assert trends(client, a).json()["current"]["statistics"]["average"]["calories"] is None


@pytest.mark.parametrize(
    "start,end",
    [
        ("2026-02-01", "2026-02-28"),
        ("2024-02-01", "2024-02-29"),
        ("2026-10-01", "2026-10-31"),
        ("2026-03-22", "2026-03-28"),
    ],
)
def test_calendar_and_dst_ranges_have_exact_count(client, start, end):
    h = register(client, "alice")
    r = trends(client, h, start, end)
    assert r.status_code == 200
    n = (date.fromisoformat(end) - date.fromisoformat(start)).days + 1
    assert len(r.json()["current"]["days"]) == n and len(r.json()["previous"]["days"]) == n


def test_invalid_long_or_reversed_ranges_are_rejected(client):
    h = register(client, "alice")
    assert trends(client, h, "2026-01-01", "2026-10-01").status_code == 422
    assert trends(client, h, "2026-10-11", "2026-10-10").status_code == 422


def test_partial_logged_day_does_not_become_zero_or_leave_denominator(client):
    from foodlogger.trends import period

    entries = [
        dict(day="2026-10-11", calories=100, protein=None, carbs=12, fat=1, details={}),
        dict(day="2026-10-12", calories=200, protein=10, carbs=12, fat=1, details={}),
    ]
    result = period(date(2026, 10, 11), date(2026, 10, 17), entries, [], {"revisions": []})
    assert result["statistics"]["logged_days"] == 2
    assert result["statistics"]["average"]["calories"] == 150
    assert result["statistics"]["average"]["protein"] is None
    assert result["statistics"]["partial_days"]["protein"] == 1
    assert result["days"][0]["known_totals"]["protein"] == 0


def test_prior_comparison_and_unknown_provenance_are_explicit(client):
    h = register(client, "alice")
    meal(client, h, "2026-10-04", 100)
    meal(client, h, "2026-10-11", 150)
    result = trends(client, h).json()
    assert result["comparison"]["calories"] == 50
    assert result["current"]["days"][0]["nutrition_status"] == "recorded_snapshot"
    assert "verified" not in result["current"]["days"][0]["nutrition_sources"]
