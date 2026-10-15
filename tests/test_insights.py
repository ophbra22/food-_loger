"""Weekly statements must reflect actual recorded values, not invented completeness."""

import pytest
from fastapi.testclient import TestClient
from test_meal_analysis_pipeline import register
from test_trends import meal
from foodlogger.app import create_app
from foodlogger.security import Settings


@pytest.fixture
def client(tmp_path):
    settings = Settings(goals_enabled=True, tracking_enabled=True, trends_enabled=True)
    object.__setattr__(settings, "insights_enabled", True)
    with TestClient(create_app(tmp_path / "insights.db", settings=settings)) as c:
        yield c


def read(c, h, language="en"):
    return c.get("/api/insights?week_start=2026-10-11&language=" + language, headers=h)


def test_week_matches_trends_three_logged_days_and_no_breakfast_claim(client):
    h = register(client, "alice")
    for day, cal in [("11", 100), ("13", 200), ("16", 300)]:
        meal(client, h, "2026-10-" + day, cal)
    r = read(client, h)
    assert r.status_code == 200, r.text
    value = r.json()
    trend = client.get("/api/trends?from=2026-10-11&to=2026-10-17", headers=h).json()
    assert value["trends"] == trend
    assert value["trends"]["current"]["statistics"]["average"]["calories"] == 200
    assert value["meal_distribution"][0]["entry_count"] == 0
    assert value["meal_distribution"][1]["logged_days"] == 3
    assert value["meal_distribution"][1]["protein_average"] == 10
    text = " ".join(s["text"] for s in value["sentences"])
    assert "3" in text and "4" in text and "200" in text
    assert "breakfast" not in text.lower() and "low" not in text.lower()
    assert value["ai_status"] == "not_requested"


def test_data_and_goals_change_cache_revision_and_owner_isolation(client):
    a = register(client, "alice")
    b = register(client, "bob")
    m = meal(client, a, "2026-10-11", 150)
    first = read(client, a).json()
    assert read(client, a).json() == first
    goal = client.put(
        "/api/goals",
        headers=a,
        json={
            "effective_local_date": "2026-10-11",
            "timezone_id": "UTC",
            "allow_past": True,
            "expected_version": 0,
            "calorie_target": 150,
            "protein_g": 10,
        },
    )
    assert goal.status_code == 200
    revised = read(client, a).json()
    assert revised["revision"] != first["revision"]
    assert revised["protein_achievement"] == {"met": 1, "eligible": 1, "logged": 1}
    assert read(client, b).json()["trends"]["current"]["statistics"]["logged_days"] == 0
    assert client.delete("/api/meals/" + m["id"], headers=a).status_code == 204
    after = read(client, a).json()
    assert after["revision"] != revised["revision"]
    assert after["trends"]["current"]["statistics"]["average"]["calories"] is None


@pytest.mark.parametrize("language", ["en", "he"])
def test_empty_week_is_explicit_and_no_generated_advice(client, language):
    value = read(client, register(client, "alice"), language)
    assert value.status_code == 200, value.text
    value = value.json()
    assert value["trends"]["current"]["statistics"]["insufficient_data"]
    assert value["protein_achievement"] == {"met": 0, "eligible": 0, "logged": 0}
    assert value["sentences"] and value["language"] == language


def test_auth_bounds_and_disabled_feature(tmp_path, client):
    assert read(client, {}).status_code == 401
    h = register(client, "alice")
    assert client.get("/api/insights?week_start=2026-10-12", headers=h).status_code == 422
    assert (
        client.get("/api/insights?week_start=2026-10-11&language=xx", headers=h).status_code == 422
    )
    with TestClient(create_app(tmp_path / "off.db")) as c:
        assert read(c, register(c, "bob")).status_code == 503
