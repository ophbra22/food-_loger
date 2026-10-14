"""Immutable recipe versions share canonical ingredients and preserve past logs."""

from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient
from test_meal_analysis_pipeline import register
from test_meal_service import DRAFT

from foodlogger.app import create_app
from foodlogger.security import Settings


@pytest.fixture
def client(tmp_path):
    with TestClient(
        create_app(
            tmp_path / "recipes.db",
            settings=Settings(canonical_writes=True, library_enabled=True, recipe_writes=True),
        )
    ) as c:
        yield c


def recipe_body():
    item = deepcopy(DRAFT["items"][0])
    item["portion"] = {"quantity": 200, "unit": "g", "normalized_g": 200}
    item["nutrition_per_100"] = {
        "basis": "g",
        "energy_kcal": 100,
        "protein_g": 10,
        "carbs_g": None,
        "fat_g": 2,
    }
    return {"name": "My Salad", "servings": 4, "items": [item]}


def create(client, h, key="create-recipe-test-key", body=None):
    response = client.post(
        "/api/saved-recipes", headers={**h, "Idempotency-Key": key}, json=body or recipe_body()
    )
    assert response.status_code in (200, 201), response.text
    return response.json()


def test_recipe_crud_versions_ingredients_and_two_servings_keep_old_logs(client):
    h = register(client, "alice")
    recipe = create(client, h)
    identity = recipe["id"]
    assert recipe["totals"]["values"]["energy_kcal"] == 200
    assert recipe["per_serving"]["values"]["energy_kcal"] == 50
    assert recipe["per_serving"]["values"]["carbs_g"] is None
    draft = deepcopy(recipe["draft"])
    draft["input_method"] = "recipe"
    # Four-serving recipe; two servings has half each ingredient.
    draft["items"][0]["portion"] = {"quantity": 100, "unit": "g", "normalized_g": 100}
    saved = client.post(
        "/api/meal-logs",
        headers={**h, "Idempotency-Key": "recipe-log-two-key"},
        json={**draft, "confirmed": True},
    )
    assert saved.status_code == 201, saved.text
    before = saved.json()
    assert before["snapshot"]["meals"][0]["calories"] == 100
    body = recipe_body()
    body["items"][0]["nutrition_per_100"]["energy_kcal"] = 200
    edited = client.patch(
        "/api/saved-recipes/" + identity, headers=h, json={**body, "expected_version": 1}
    )
    assert edited.status_code == 200, edited.text
    assert (
        edited.json()["version"] == 2
        and edited.json()["per_serving"]["values"]["energy_kcal"] == 100
    )
    history = client.get("/api/saved-recipes/" + identity + "/versions", headers=h).json()[
        "versions"
    ]
    assert [r["version"] for r in history] == [1, 2]
    assert history[0]["totals"]["values"]["energy_kcal"] == 200
    assert client.get("/api/meal-logs/" + before["id"], headers=h).json() == before
    client.post("/api/favorites", headers=h, json={"kind": "recipe", "id": identity})
    assert len(client.get("/api/favorites", headers=h).json()["items"]) == 1
    assert (
        client.delete(
            "/api/saved-recipes/" + identity + "?expected_version=2", headers=h
        ).status_code
        == 204
    )
    assert client.get("/api/saved-recipes", headers=h).json()["items"] == []
    assert client.get("/api/favorites", headers=h).json()["items"] == []
    assert client.get("/api/meal-logs/" + before["id"], headers=h).json() == before
    assert (
        client.post(
            "/api/saved-recipes",
            headers={**h, "Idempotency-Key": "create-recipe-test-key"},
            json=recipe_body(),
        ).status_code
        == 409
    )


def test_recipe_retry_duplicate_concurrency_and_owner_isolation(client):
    a, b = register(client, "alice"), register(client, "bobby")
    r = create(client, a)
    assert create(client, a)["id"] == r["id"]
    assert client.get("/api/saved-recipes/" + r["id"], headers=b).status_code == 404
    assert client.get("/api/saved-recipes/" + r["id"] + "/versions", headers=b).status_code == 404
    with ThreadPoolExecutor(2) as pool:
        results = list(
            pool.map(
                lambda _: client.patch(
                    "/api/saved-recipes/" + r["id"],
                    headers=a,
                    json={**recipe_body(), "expected_version": 1},
                ),
                range(2),
            )
        )
    assert sorted(x.status_code for x in results) == [200, 409]
    dup = client.post(
        "/api/saved-recipes/" + r["id"] + "/duplicate",
        headers={**a, "Idempotency-Key": "duplicate-recipe-key"},
        json={"expected_version": 2, "name": "My Salad copy"},
    )
    assert dup.status_code == 201, dup.text
    assert dup.json()["id"] != r["id"] and dup.json()["draft"]["items"] == r["draft"]["items"]
    assert (
        client.post("/api/favorites", headers=b, json={"kind": "recipe", "id": r["id"]}).status_code
        == 404
    )


@pytest.mark.parametrize(
    "changes", [{"servings": 0}, {"servings": float("1e100")}, {"items": []}, {"name": "   "}]
)
def test_invalid_recipe_does_not_write(client, changes):
    h = register(client, "alice")
    body = {**recipe_body(), **changes}
    assert (
        client.post(
            "/api/saved-recipes", headers={**h, "Idempotency-Key": "invalid-recipe-key"}, json=body
        ).status_code
        == 422
    )
    assert client.get("/api/saved-recipes", headers=h).json()["items"] == []


def test_mixed_units_need_normalized_basis_and_ingredient_removal_is_atomic(client):
    h = register(client, "alice")
    body = recipe_body()
    liquid = deepcopy(body["items"][0])
    liquid["id"] = "liquid"
    liquid["nutrition_per_100"]["basis"] = "ml"
    liquid["portion"] = {"quantity": 100, "unit": "ml", "normalized_ml": 100}
    body["items"].append(liquid)
    r = create(client, h, body=body)
    assert r["totals"]["values"]["energy_kcal"] == 300
    bad = deepcopy(body)
    bad["items"][1]["portion"] = {"quantity": 100, "unit": "g", "normalized_g": 100}
    assert (
        client.patch(
            "/api/saved-recipes/" + r["id"], headers=h, json={**bad, "expected_version": 1}
        ).status_code
        == 422
    )
    assert client.get("/api/saved-recipes/" + r["id"], headers=h).json()["version"] == 1
    edited = client.patch(
        "/api/saved-recipes/" + r["id"], headers=h, json={**recipe_body(), "expected_version": 1}
    )
    assert edited.status_code == 200 and len(edited.json()["draft"]["items"]) == 1
