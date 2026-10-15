"""P08 filters owner-reviewed sources before deterministic nutrition ranking."""

import pytest
from fastapi.testclient import TestClient
from test_meal_analysis_pipeline import register
from test_recipes import create, recipe_body
from test_trends import meal

from foodlogger.app import create_app
from foodlogger.security import Settings


@pytest.fixture
def client(tmp_path):
    settings = Settings(
        canonical_writes=True, library_enabled=True, recipe_writes=True, goals_enabled=True
    )
    object.__setattr__(settings, "recommendations_enabled", True)
    object.__setattr__(settings, "recommendation_writes", True)
    with TestClient(create_app(tmp_path / "recommendations.db", settings=settings)) as c:
        yield c


def get(c, h):
    return c.get("/api/recommendations?day=2026-10-14", headers=h)


def sources(c, h):
    return c.get("/api/recommendation-sources", headers=h)


def prefs(c, h, **kw):
    return c.put(
        "/api/recommendation-preferences",
        headers=h,
        json={
            "expected_version": 0,
            "allergy_status": "unknown",
            "allergens": [],
            "diets": [],
            **kw,
        },
    )


def food(c, h, name, key, calories=250, protein=20):
    body = recipe_body()
    body["name"] = name
    body["servings"] = 1
    body["items"][0]["portion"] = {"quantity": 100, "unit": "g", "normalized_g": 100}
    body["items"][0]["nutrition_per_100"] = {
        "basis": "g",
        "energy_kcal": calories,
        "protein_g": protein,
        "carbs_g": 30,
        "fat_g": 8,
    }
    return create(c, h, key, body)


def review(c, h, entry, **kw):
    source = next(s for s in sources(c, h).json()["items"] if s["entry"]["id"] == entry["id"])
    return c.put(
        "/api/recommendation-sources/" + entry["kind"] + "/" + entry["id"],
        headers=h,
        json={
            "source_revision": source["source_revision"],
            "expected_version": source["review"]["version"],
            "ingredients_reviewed": True,
            "allergens": [],
            "suitable_diets": [],
            **kw,
        },
    )


def test_remaining_500_40_filters_before_ranking_and_never_saves(client):
    h = register(client, "alice")
    meal(client, h, "2026-10-14", 500)
    assert (
        client.put(
            "/api/goals",
            headers=h,
            json={
                "effective_local_date": "2026-10-14",
                "timezone_id": "UTC",
                "allow_past": True,
                "expected_version": 0,
                "calorie_target": 1000,
                "protein_g": 50,
            },
        ).status_code
        == 200
    )
    a = food(client, h, "Chicken bowl", "recipe-fixture-key-a")
    b = food(client, h, "Other bowl", "recipe-fixture-key-b")
    milk = food(client, h, "Milk bowl", "recipe-fixture-key-c")
    food(client, h, "Unknown ingredients", "recipe-fixture-key-d")
    assert prefs(client, h, allergy_status="declared", allergens=["milk"]).status_code == 200
    for entry in (a, b):
        assert review(client, h, entry).status_code == 200
    assert review(client, h, milk, allergens=["milk"]).status_code == 200
    before = client.get("/api/meals?day=2026-10-14", headers=h).json()
    r = get(client, h)
    assert r.status_code == 200, r.text
    value = r.json()
    assert value["remaining"]["calories"] == 500 and value["remaining"]["protein"] == 40
    assert {v["entry"]["id"] for v in value["choices"]} == {a["id"], b["id"]}
    for choice in value["choices"]:
        assert choice["servings"] == 2
        assert choice["nutrition"]["values"]["energy_kcal"] == 500
        assert choice["nutrition"]["values"]["protein_g"] == 40
        assert choice["draft"]["items"][0]["portion"]["normalized_g"] == 200
        assert choice["safety_status"] == "user_reviewed"
    assert client.get("/api/meals?day=2026-10-14", headers=h).json() == before


def test_unknown_allergies_are_not_none_and_missing_goals_are_not_zero(client):
    h = register(client, "alice")
    food(client, h, "Known meal", "recipe-fixture-key-a")
    r = get(client, h)
    assert r.status_code == 200, r.text
    result = r.json()
    assert result["preferences"]["allergy_status"] == "unknown"
    assert "allergies_unknown" in result["warnings"]
    assert result["remaining"]["calories"] is None and result["remaining"]["protein"] is None
    assert (
        result["choices"][0]["servings"] == 1 and result["choices"][0]["safety_status"] == "unknown"
    )


def test_no_safe_candidate_and_changed_source_requires_new_review(client):
    h = register(client, "alice")
    entry = food(client, h, "Bowl", "recipe-fixture-key-a")
    assert (
        prefs(
            client, h, allergy_status="declared", allergens=["sesame"], diets=["vegan"]
        ).status_code
        == 200
    )
    assert get(client, h).json()["choices"] == []
    assert review(client, h, entry, suitable_diets=["vegan"]).status_code == 200
    assert len(get(client, h).json()["choices"]) == 1
    body = recipe_body()
    body["name"] = "Changed ingredient"
    body["expected_version"] = 1
    assert (
        client.patch("/api/saved-recipes/" + entry["id"], headers=h, json=body).status_code == 200
    )
    assert get(client, h).json()["choices"] == []


def test_private_preferences_reviews_versions_erasure_and_auth(client):
    a = register(client, "alice")
    b = register(client, "bob")
    entry = food(client, a, "Private", "recipe-fixture-key-a")
    assert get(client, {}).status_code == 401
    assert prefs(client, a, allergy_status="declared", allergens=[]).status_code == 422
    assert prefs(client, a, allergy_status="none", allergens=["milk"]).status_code == 422
    assert prefs(client, a, allergy_status="declared", allergens=["milk"]).status_code == 200
    assert prefs(client, a).status_code == 409
    assert get(client, b).json()["preferences"]["allergens"] == []
    assert sources(client, b).json()["items"] == []
    assert (
        client.put(
            "/api/recommendation-sources/recipe/" + entry["id"],
            headers=b,
            json={
                "source_revision": "0" * 64,
                "expected_version": 0,
                "ingredients_reviewed": True,
                "allergens": [],
                "suitable_diets": [],
            },
        ).status_code
        == 404
    )
    assert review(client, a, entry).status_code == 200
    assert (
        client.delete("/api/recommendation-preferences?expected_version=1", headers=a).status_code
        == 200
    )
    value = get(client, a).json()
    assert (
        value["preferences"]["allergy_status"] == "unknown"
        and value["preferences"]["allergens"] == []
    )
    assert all(
        s["review"]["ingredients_reviewed"] is False for s in sources(client, a).json()["items"]
    )


@pytest.mark.parametrize(
    "field,value",
    [
        ("allergens", ["unrecognized"]),
        ("diets", ["starvation"]),
        ("allergy_status", "invalid"),
        ("expected_version", -1),
    ],
)
def test_invalid_preferences_rejected(client, field, value):
    h = register(client, "alice")
    assert prefs(client, h, **{field: value}).status_code == 422
