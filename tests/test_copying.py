"""Copy preview, transactional confirmation, historical provenance and DST."""

from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient
from test_meal_analysis_pipeline import register
from test_meal_service import DRAFT

from foodlogger.app import create_app
from foodlogger.security import Settings


@pytest.fixture
def client(tmp_path, monkeypatch):
    from foodlogger.vision import GeminiVision

    monkeypatch.setattr(GeminiVision, "recognize", lambda *a, **k: pytest.fail("AI forbidden"))
    with TestClient(
        create_app(
            tmp_path / "copy.db",
            settings=Settings(canonical_writes=True, copy_enabled=True, goals_enabled=True),
        )
    ) as c:
        yield c


def source(
    client,
    h,
    key="copy-source-fixture",
    day="2026-10-13",
    at="2026-10-13T12:30:00+03:00",
    zone="Asia/Jerusalem",
):
    r = client.post(
        "/api/meal-logs",
        headers={**h, "Idempotency-Key": key},
        json={
            **DRAFT,
            "local_date": day,
            "occurred_at": at,
            "timezone_id": zone,
            "confirmed": True,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def selection(groups, day="2026-10-14", zone="Asia/Jerusalem"):
    return {
        "source_day": groups[0]["local_date"],
        "sources": [{"id": g["id"], "version": g["version"]} for g in groups],
        "destination_date": day,
        "timezone_id": zone,
        "times": {},
    }


def preview(client, h, body):
    r = client.post("/api/days/copy", headers=h, json={"action": "preview", **body})
    assert r.status_code == 200, r.text
    return r.json()


def confirm(client, h, body, p, key="copy-confirm-fixture", extra=False):
    return client.post(
        "/api/days/copy",
        headers={**h, "Idempotency-Key": key},
        json={
            **body,
            "action": "confirm",
            "confirmed": True,
            "confirm_populated": extra,
            "preview_token": p["preview_token"],
            "drafts": p["drafts"],
        },
    )


def test_copy_partial_selection_preserves_source_and_goals_and_snapshot(client):
    h = register(client, "alice")
    from test_goals import TARGET

    before_goals = client.put("/api/goals", headers=h, json=TARGET).json()
    a = source(client, h)
    listed = client.get("/api/copy-sources?day=2026-10-13", headers=h)
    assert listed.status_code == 200, listed.text
    assert listed.json()["items"][0]["entry_ids"] == [a["snapshot"]["meals"][0]["id"]]
    source(client, h, "second-source-fixture")
    body = selection([a])
    p = preview(client, h, body)
    assert not p["destination_populated"] and p["time_issues"] == []
    assert p["drafts"][0]["occurred_at"] == "2026-10-14T12:30:00+03:00"
    assert client.get("/api/meal-logs?day=2026-10-14", headers=h).json()["groups"] == []
    result = confirm(client, h, body, p)
    assert result.status_code == 201, result.text
    copied = result.json()["groups"][0]
    assert copied["snapshot"]["copied_from_id"] == a["id"]
    assert copied["snapshot"]["meals"][0]["details"]["copied_from_id"] == a["id"]
    assert copied["snapshot"]["meals"][0]["calories"] == a["snapshot"]["meals"][0]["calories"]
    assert client.get("/api/meal-logs/" + a["id"], headers=h).json() == a
    assert client.get("/api/goals", headers=h).json() == before_goals
    assert confirm(client, h, body, p).status_code == 200
    assert len(client.get("/api/meal-logs?day=2026-10-14", headers=h).json()["groups"]) == 1
    client.delete("/api/meal-logs/" + copied["id"] + "?expected_version=1", headers=h)
    assert confirm(client, h, body, p).status_code == 409


def test_copy_populated_warning_and_changed_destination_require_new_preview(client):
    h = register(client, "alice")
    a = source(client, h)
    body = selection([a])
    p = preview(client, h, body)
    source(client, h, "destination-fixture", day="2026-10-14", at="2026-10-14T08:00:00+03:00")
    assert confirm(client, h, body, p).status_code == 409
    p = preview(client, h, body)
    assert p["destination_populated"]
    assert confirm(client, h, body, p).status_code == 422
    assert confirm(client, h, body, p, extra=True).status_code == 201


def test_copy_time_unknown_gap_fold_and_travel_are_explicit(client):
    h = register(client, "alice")
    a = source(client, h, at=None, zone=None)
    body = selection([a])
    p = preview(client, h, body)
    assert p["time_issues"][0]["reason"] == "unknown_time"
    assert confirm(client, h, body, p).status_code == 422
    body["times"] = {a["id"]: {"wall_time": "02:30:00"}}
    body["destination_date"] = "2026-03-27"
    p = preview(client, h, body)
    assert p["time_issues"][0]["reason"] == "nonexistent_time"
    body["times"][a["id"]]["wall_time"] = "01:30:00"
    body["destination_date"] = "2026-10-25"
    p = preview(client, h, body)
    assert p["time_issues"][0]["reason"] == "ambiguous_time"
    body["times"][a["id"]]["fold"] = 1
    p = preview(client, h, body)
    assert p["drafts"][0]["occurred_at"] == "2026-10-25T01:30:00+02:00"
    assert confirm(client, h, body, p).status_code == 201
    body["timezone_id"] = "America/New_York"
    body["destination_date"] = "2026-10-14"
    p = preview(client, h, body)
    assert p["drafts"][0]["occurred_at"] == "2026-10-14T01:30:00-04:00"


def test_copy_owner_deleted_changed_source_and_invalid_confirmation(client):
    h = register(client, "alice")
    other = register(client, "bobby")
    a = source(client, h)
    body = selection([a])
    p = preview(client, h, body)
    assert (
        client.post("/api/days/copy", headers=other, json={"action": "preview", **body}).status_code
        == 404
    )
    tampered = deepcopy(p)
    tampered["drafts"][0]["local_date"] = "2026-10-15"
    assert confirm(client, h, body, tampered).status_code == 422
    client.delete("/api/meal-logs/" + a["id"] + "?expected_version=1", headers=h)
    assert confirm(client, h, body, p).status_code == 404


def test_copy_concurrent_retry_one_batch_and_atomic_failure(client, monkeypatch):
    h = register(client, "alice")
    a = source(client, h)
    b = source(client, h, "second-copy-source")
    body = selection([a, b])
    p = preview(client, h, body)
    from foodlogger.storage import Journal

    original = Journal.insert_into
    count = 0

    def fail(db, entry, owner):
        nonlocal count
        count += 1
        if count == 2:
            raise ValueError("Synthetic failure before second component")
        return original(db, entry, owner)

    monkeypatch.setattr(Journal, "insert_into", staticmethod(fail))
    assert confirm(client, h, body, p).status_code == 422
    assert client.get("/api/meal-logs?day=2026-10-14", headers=h).json()["groups"] == []
    monkeypatch.setattr(Journal, "insert_into", staticmethod(original))
    with ThreadPoolExecutor(4) as pool:
        responses = list(pool.map(lambda _: confirm(client, h, body, p), range(4)))
    assert sorted(r.status_code for r in responses) == [200, 200, 200, 201]
    assert len(client.get("/api/meal-logs?day=2026-10-14", headers=h).json()["groups"]) == 2


def test_copy_feature_defaults_off_and_never_invokes_ai(tmp_path, monkeypatch):
    from foodlogger.vision import GeminiVision

    monkeypatch.setattr(GeminiVision, "recognize", lambda *a, **k: pytest.fail("AI call forbidden"))
    with TestClient(create_app(tmp_path / "off.db", settings=Settings(canonical_writes=True))) as c:
        h = register(c, "alice")
        a = source(c, h)
        assert c.get("/api/capabilities", headers=h).json()["copy"] is False
        assert (
            c.post(
                "/api/days/copy", headers=h, json={"action": "preview", **selection([a])}
            ).status_code
            == 503
        )
