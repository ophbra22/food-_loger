"""P04 library operations reuse journal snapshots and never perform recognition."""

from copy import deepcopy

import pytest
from fastapi.testclient import TestClient
from test_meal_analysis_pipeline import register
from test_meal_service import DRAFT

from foodlogger.app import create_app
from foodlogger.security import Settings


def reject_ai(*args, **kwargs):
    raise AssertionError("P04 must not invoke an AI provider")


@pytest.fixture
def client(tmp_path, monkeypatch):
    from foodlogger.vision import GeminiVision

    monkeypatch.setattr(GeminiVision, "recognize", reject_ai)
    with TestClient(
        create_app(
            tmp_path / "library.db", settings=Settings(canonical_writes=True, library_enabled=True)
        )
    ) as c:
        yield c


def save(client, headers, key="library-source-key", **changes):
    result = client.post(
        "/api/meal-logs",
        headers={**headers, "Idempotency-Key": key},
        json={**deepcopy(DRAFT), **changes, "confirmed": True},
    )
    assert result.status_code == 201, result.text
    return result.json()


def test_recents_and_favorites_require_auth_capability_and_owner(client):
    assert client.get("/api/recents").status_code == 401
    alice, bob = register(client, "alice"), register(client, "bobby")
    source = save(client, alice)
    recents = client.get("/api/recents", headers=alice).json()
    assert recents["items"][0]["id"] == source["id"]
    assert recents["items"][0]["draft"]["items"][0]["nutrition_per_100"]["energy_kcal"] == 1.4
    assert client.get("/api/recents", headers=bob).json()["items"] == []
    assert (
        client.post(
            "/api/favorites", headers=bob, json={"kind": "meal", "id": source["id"]}
        ).status_code
        == 404
    )
    favorite = {"kind": "meal", "id": source["id"]}
    for _ in range(2):
        assert client.post("/api/favorites", headers=alice, json=favorite).status_code == 200
    found = client.get("/api/favorites", headers=alice).json()["items"]
    assert len(found) == 1 and found[0]["id"] == source["id"]
    assert client.get("/api/recents", headers=alice).json()["items"][0]["favorite"] is True
    assert client.delete("/api/favorites/meal/" + source["id"], headers=alice).status_code == 204
    assert (
        len(
            client.get(
                "/api/meals?schema_version=2&day=" + DRAFT["local_date"], headers=alice
            ).json()["meals"]
        )
        == 1
    )
    assert client.get("/api/favorites", headers=alice).json()["items"] == []


def test_pagination_search_wildcards_and_deleted_sources(client):
    h = register(client, "alice")
    for i, name in enumerate(["Salad", "Soup", "100% salad"]):
        items = deepcopy(DRAFT["items"])
        items[0]["display_name"] = name
        save(client, h, "library-source-key-" + str(i), items=items, local_date=f"2026-10-{10 + i}")
    first = client.get("/api/recents?limit=2", headers=h).json()
    assert [x["name"] for x in first["items"]] == ["100% salad", "Soup"]
    second = client.get("/api/recents?limit=2&offset=2", headers=h).json()
    assert [x["name"] for x in second["items"]] == ["Salad"]
    assert len(client.get("/api/recents?query=SALAD", headers=h).json()["items"]) == 2
    assert len(client.get("/api/recents?query=%25", headers=h).json()["items"]) == 1
    source = first["items"][0]
    client.post("/api/favorites", headers=h, json={"kind": "meal", "id": source["id"]})
    assert (
        client.delete(
            "/api/meal-logs/" + source["id"] + "?expected_version=1", headers=h
        ).status_code
        == 204
    )
    assert client.get("/api/favorites", headers=h).json()["items"] == []
    assert client.get("/api/recents?limit=0", headers=h).status_code == 422


def test_repeat_preview_uses_snapshot_with_new_id_and_no_ai(client):
    h = register(client, "alice")
    source = save(client, h)
    entry = client.get("/api/recents", headers=h).json()["items"][0]
    repeat = {
        **entry["draft"],
        "local_date": "2026-10-14",
        "input_method": "repeat",
        "confirmed": True,
    }
    assert client.get("/api/meals?schema_version=2&day=2026-10-14", headers=h).json()["meals"] == []
    headers = {**h, "Idempotency-Key": "library-repeat-test-key"}
    result = client.post("/api/meal-logs", headers=headers, json=repeat)
    assert result.status_code == 201, result.text
    assert result.json()["id"] != source["id"]
    assert result.json()["snapshot"]["meals"][0]["calories"] == 0.14
    assert client.post("/api/meal-logs", headers=headers, json=repeat).status_code == 200
    assert client.get("/api/meal-logs/" + source["id"], headers=h).json() == source


def test_library_flag_off_and_account_erasure(tmp_path):
    with TestClient(create_app(tmp_path / "off.db")) as c:
        h = register(c, "alice")
        assert c.get("/api/capabilities", headers=h).json()["library"] is False
        assert c.get("/api/recents", headers=h).status_code == 503


def test_favorite_account_delete_cascade_and_concurrent_dedup(client):
    from concurrent.futures import ThreadPoolExecutor

    h = register(client, "alice")
    source = save(client, h)
    with ThreadPoolExecutor(4) as pool:
        responses = list(
            pool.map(
                lambda _: client.post(
                    "/api/favorites", headers=h, json={"kind": "meal", "id": source["id"]}
                ),
                range(8),
            )
        )
    assert all(r.status_code == 200 for r in responses)
    assert len(client.get("/api/favorites", headers=h).json()["items"]) == 1
    owner = client.get("/api/auth/me", headers=h).json()["user"]["id"]
    with client.app.state.auth.database.connect() as db:
        db.execute("DELETE FROM users WHERE id=?", (owner,))
        assert (
            db.execute(
                "SELECT COUNT(*) AS n FROM library_favorites WHERE user_id=?", (owner,)
            ).fetchone()["n"]
            == 0
        )
    assert client.get("/api/favorites", headers=h).status_code == 401
