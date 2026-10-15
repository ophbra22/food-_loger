"""Tracking must remain owner-private, retry safe and independent of food volumes."""

from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from test_meal_analysis_pipeline import register

from foodlogger.app import create_app
from foodlogger.security import Settings

BODY = dict(
    value=250,
    occurred_at="2026-10-11T09:00:00+03:00",
    local_date="2026-10-11",
    timezone_id="Asia/Jerusalem",
)


@pytest.fixture
def client(tmp_path):
    # Flags loaded through the existing settings boundary (missing flags cause RED, not
    # import errors).
    import os
    from unittest.mock import patch

    with patch.dict(
        os.environ,
        {
            "FOODLOGGER_TRACKING_ENABLED": "1",
            "FOODLOGGER_TRACKING_WRITES": "1",
            "FOODLOGGER_GOALS_ENABLED": "1",
        },
    ):
        settings = Settings.from_environment()
    with TestClient(create_app(tmp_path / "tracking.db", settings=settings)) as c:
        yield c


def add(c, h, kind="water", key="tracking-request-0001", **values):
    return c.post(f"/api/{kind}", headers={**h, "Idempotency-Key": key}, json={**BODY, **values})


def listing(c, h, kind="water"):
    return c.get(f"/api/{kind}?from=2026-10-10&to=2026-10-18", headers=h)


def test_hydration_arithmetic_retry_edit_delete_and_tombstone(client):
    h = register(client, "alice")
    a = add(client, h)
    assert a.status_code == 201, a.text
    a = a.json()
    b = add(client, h, key="tracking-request-0002", value=500)
    assert b.status_code == 201
    assert add(client, h).json()["id"] == a["id"]
    assert listing(client, h).json()["total"] == 750
    assert add(client, h, value=300).status_code == 409
    path = f"/api/water/{a['id']}"
    assert (
        client.patch(
            path, headers=h, json={**BODY, "value": 150, "expected_version": 1}
        ).status_code
        == 200
    )
    assert (
        client.patch(
            path, headers=h, json={**BODY, "value": 200, "expected_version": 1}
        ).status_code
        == 409
    )
    assert listing(client, h).json()["total"] == 650
    assert client.delete(path + "?expected_version=1", headers=h).status_code == 409
    assert client.delete(path + "?expected_version=2", headers=h).status_code == 204
    assert client.delete(path + "?expected_version=2", headers=h).status_code == 204
    assert listing(client, h).json()["total"] == 500
    assert add(client, h).status_code == 409


def test_owner_isolation_and_account_erasure(client):
    a = register(client, "alice")
    b = register(client, "bob")
    entry = add(client, a, kind="weight", value=70)
    assert entry.status_code == 201
    identity = entry.json()["id"]
    assert listing(client, b, "weight").json()["items"] == []
    assert (
        client.patch(
            "/api/weight/" + identity, headers=b, json={**BODY, "value": 80, "expected_version": 1}
        ).status_code
        == 404
    )
    assert (
        client.delete("/api/weight/" + identity + "?expected_version=1", headers=b).status_code
        == 404
    )
    assert (
        client.request(
            "DELETE",
            "/api/auth/account",
            headers=a,
            json={"password": "test-long-password-2026", "confirmation": "DELETE"},
        ).status_code
        == 204
    )
    with client.app.state.auth.database.connect() as db:
        assert db.execute("SELECT COUNT(*) AS n FROM tracking_entries").fetchone()["n"] == 0
        assert db.execute("SELECT COUNT(*) AS n FROM tracking_receipts").fetchone()["n"] == 0


@pytest.mark.parametrize(
    "change",
    [
        {"value": 0},
        {"value": True},
        {"value": 15001},
        {"value": 0.0001},
        {"occurred_at": "2026-10-11T09:00:00"},
        {"local_date": "2026-10-12"},
        {"timezone_id": "invalid/zone"},
        {"occurred_at": "2026-10-11T09:00:00+02:00"},
        {"source": "apple_health", "external_id": "fake"},
        {"user_id": "someone"},
    ],
)
def test_invalid_measurements_fail_without_writes(client, change):
    h = register(client, "alice")
    assert add(client, h, **change).status_code == 422
    assert listing(client, h).json()["items"] == []


def test_latest_uses_measurement_time_and_records_are_pageable(client):
    h = register(client, "alice")
    for n, (stamp, value) in enumerate([("12T09", 69.5), ("11T09", 70), ("12T10", 69.7)]):
        assert (
            add(
                client,
                h,
                kind="weight",
                key=f"weight-request-{n:04}",
                value=value,
                occurred_at=f"2026-10-{stamp}:00:00+03:00",
                local_date="2026-10-" + stamp[:2],
            ).status_code
            == 201
        )
    result = listing(client, h, "weight").json()
    assert result["latest"]["value"] == 69.7
    assert result["previous"]["value"] == 69.5
    assert result["delta"] == 0.2
    page = client.get("/api/weight?from=2026-10-10&to=2026-10-18&limit=2", headers=h).json()
    assert len(page["items"]) == 2 and page["has_more"]
    assert client.get("/api/water?from=2026-01-01&to=2026-10-18", headers=h).status_code == 422


def test_competing_retry_has_one_entry(client):
    h = register(client, "alice")
    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(lambda _: add(client, h), range(2)))
    assert sorted(r.status_code for r in results) == [200, 201]
    assert listing(client, h).json()["total"] == 250


def test_flags_and_auth_default_closed(tmp_path):
    with TestClient(create_app(tmp_path / "off.db")) as c:
        assert c.get("/api/water?from=2026-10-11&to=2026-10-11").status_code == 401
        h = register(c, "alice")
        assert c.get("/api/capabilities", headers=h).json().get("tracking") is False
        assert add(c, h).status_code == 503


def test_source_identity_deduplicates_without_implementing_health_sync(client):
    from foodlogger.tracking import Tracking, TrackingBody, TrackingConflict

    h = register(client, "alice")
    owner = client.get("/api/auth/me", headers=h).json()["user"]["id"]
    service = Tracking(client.app.state.auth.database)
    body = TrackingBody(
        **{**BODY, "value": 70, "source": "apple_health", "external_id": "sample-1"}
    )
    a, created = service.create(owner, "weight", body, "import-first")
    b, created_again = service.create(owner, "weight", body, "import-second")
    assert created and not created_again and a["id"] == b["id"]
    service.delete(owner, "weight", a["id"], 1)
    with pytest.raises(TrackingConflict):
        service.create(owner, "weight", body, "import-third")


def test_meal_drink_does_not_create_water_and_readonly_flag_preserves_history(client):
    h = register(client, "alice")
    response = client.post(
        "/api/meals/custom",
        headers=h,
        json=dict(
            name="Milk",
            grams=250,
            basis_unit="ml",
            day="2026-10-11",
            meal_type="snack",
            nutrition=dict(calories=60, protein=3, carbs=5, fat=3),
        ),
    )
    assert response.status_code == 201
    assert listing(client, h).json()["total"] == 0
    assert add(client, h).status_code == 201
    db = client.app.state.auth.database
    with TestClient(create_app(db_path=db, settings=Settings(tracking_enabled=True))) as readonly:
        assert listing(readonly, h).json()["total"] == 250
        assert add(readonly, h, key="tracking-request-0002").status_code == 503
