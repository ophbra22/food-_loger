"""P10 local API/ledger tests. No HealthKit, network, AI or real health records."""

import json
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from test_meal_analysis_pipeline import register
from test_trends import meal

from foodlogger.app import create_app
from foodlogger.security import Settings


@pytest.fixture
def client(tmp_path):
    settings = Settings(tracking_enabled=True, tracking_writes=True)
    object.__setattr__(settings, "health_enabled", True)
    with TestClient(create_app(tmp_path / "health.db", settings=settings)) as c:
        yield c


def snapshot(c, h):
    r = c.post("/api/health/reconcile", headers=h)
    assert r.status_code == 200, r.text
    return r.json()


def timestamp(c, h, entry):
    owner = c.get("/api/auth/me", headers=h).json()["user"]["id"]
    with c.app.state.auth.database.connect() as db:
        db.execute(
            "UPDATE meals SET details=? WHERE user_id=? AND id=?",
            (
                json.dumps(
                    {"occurred_at": "2026-10-15T12:00:00+03:00", "timezone_id": "Asia/Jerusalem"}
                ),
                owner,
                entry["id"],
            ),
        )
    return owner


def sample(kind="weight", **kw):
    return dict(
        external_id=str(uuid4()),
        kind=kind,
        value=70.0 if kind == "weight" else 123.0,
        start="2026-10-15T09:00:00Z",
        end="2026-10-15T09:01:00Z",
        source_bundle="com.example.scale",
        timezone_id="Asia/Jerusalem",
        **kw,
    )


def test_health_defaults_off_and_requires_auth(tmp_path, client):
    assert client.post("/api/health/reconcile").status_code == 401
    with TestClient(create_app(tmp_path / "off.db", settings=Settings())) as c:
        h = register(c, "alice")
        assert c.post("/api/health/reconcile", headers=h).status_code == 503
        assert c.get("/api/capabilities", headers=h).json()["health"] is False


def test_stable_mapping_edit_tombstone_and_owner_isolation(client):
    h = register(client, "alice")
    m = meal(client, h, "2026-10-15")
    owner = timestamp(client, h, m)
    first = snapshot(client, h)
    second = snapshot(client, h)
    assert len(first["items"]) == 4
    assert first == second
    cal = next(i for i in first["items"] if i["kind"] == "calories")
    assert (
        cal["value"] == 100
        and cal["revision"] == 1
        and cal["provenance"] == "user_confirmed_unverified"
    )
    assert cal["start"] == "2026-10-15T09:00:00+00:00" and cal["local_date"] == "2026-10-15"
    with client.app.state.auth.database.connect() as db:
        db.execute("UPDATE meals SET calories=200 WHERE user_id=? AND id=?", (owner, m["id"]))
    edited = snapshot(client, h)
    newer = next(i for i in edited["items"] if i["kind"] == "calories")
    assert newer["id"] == cal["id"] and newer["revision"] == 2 and newer["value"] == 200
    assert client.delete("/api/meals/" + m["id"], headers=h).status_code == 204
    deleted = snapshot(client, h)
    assert all(i["deleted"] for i in deleted["items"])
    assert next(i for i in deleted["items"] if i["kind"] == "calories")["revision"] == 3
    assert deleted == snapshot(client, h)
    bob = register(client, "bob")
    b = snapshot(client, bob)
    assert b["scope"] != first["scope"] and b["items"] == []


def test_legacy_timestamp_withheld_not_fabricated(client):
    h = register(client, "alice")
    meal(client, h, "2026-10-15")
    result = snapshot(client, h)
    assert result["items"] == [] and result["withheld"] == 1


def test_manual_water_exports_original_date_but_imported_water_never_loops(client):
    h = register(client, "alice")
    body = dict(
        value=250.0,
        occurred_at="2026-10-15T12:00:00+03:00",
        local_date="2026-10-15",
        timezone_id="Asia/Jerusalem",
    )
    for source in ("manual", "apple_health"):
        r = client.post("/api/water", headers={**h, "Idempotency-Key": uuid4().hex}, json=body)
        assert r.status_code == 201, r.text
        if source == "apple_health":
            with client.app.state.auth.database.connect() as db:
                db.execute(
                    "UPDATE tracking_entries SET "
                    "source='apple_health',external_id='external-water' WHERE id=?",
                    (r.json()["id"],),
                )
    rows = snapshot(client, h)["items"]
    assert len(rows) == 1
    assert rows[0]["kind"] == "water" and rows[0]["value"] == 250 and rows[0]["unit"] == "ml"


def test_import_weight_and_steps_replay_preserves_external_provenance(client):
    h = register(client, "alice")
    a = sample()
    b = sample("steps")
    for replay in range(2):
        r = client.post("/api/health/import", headers=h, json={"samples": [a, b]})
        assert r.status_code == 200, r.text
        assert r.json()["accepted"] == 2
        assert r.json()["weight_dates"] == ([] if replay else ["2026-10-15"])
    r = client.get("/api/weight?from=2026-10-15&to=2026-10-15", headers=h)
    assert r.status_code == 200, r.text
    rows = r.json()["items"]
    assert len(rows) == 1 and rows[0]["source"] == "apple_health"
    assert a["external_id"] in rows[0]["external_id"]
    result = client.get("/api/health/imports", headers=h).json()
    assert len(result["items"]) == 2 and result["items"][0]["source_bundle"] == "com.example.scale"
    assert snapshot(client, h)["items"] == []


@pytest.mark.parametrize(
    "patch",
    [
        {"kind": "calories"},
        {"source_bundle": "io.github.ophbra22.foodlogger"},
        {"value": -1.0},
        {"start": "2026-10-15T09:00:00"},
        {"external_id": "bad"},
        {"end": "2026-10-14T09:00:00Z"},
    ],
)
def test_invalid_or_looping_import_rejected(client, patch):
    h = register(client, "alice")
    body = {**sample(), **patch}
    assert client.post("/api/health/import", headers=h, json={"samples": [body]}).status_code == 422


def test_import_conflict_atomic_and_user_deleted_weight_not_resurrected(client):
    h = register(client, "alice")
    a = sample()
    assert client.post("/api/health/import", headers=h, json={"samples": [a]}).status_code == 200
    assert (
        client.post(
            "/api/health/import",
            headers=h,
            json={"samples": [sample("steps"), {**a, "value": 71.0}]},
        ).status_code
        == 409
    )
    assert len(client.get("/api/health/imports", headers=h).json()["items"]) == 1
    row = client.get("/api/weight?from=2026-10-15&to=2026-10-15", headers=h).json()["items"][0]
    assert (
        client.delete("/api/weight/" + row["id"] + "?expected_version=1", headers=h).status_code
        == 204
    )
    assert client.post("/api/health/import", headers=h, json={"samples": [a]}).status_code == 200
    assert client.get("/api/weight?from=2026-10-15&to=2026-10-15", headers=h).json()["items"] == []


def test_import_invalid_timezone_is_validation_not_server_error(client):
    h = register(client, "alice")
    body = sample()
    body["timezone_id"] = "Nowhere/Invalid"
    assert client.post("/api/health/import", headers=h, json={"samples": [body]}).status_code == 422


def test_partial_known_nutrient_becomes_tombstone_without_zero_filling(client):
    h = register(client, "alice")
    m = meal(client, h, "2026-10-15")
    owner = timestamp(client, h, m)
    snapshot(client, h)
    with client.app.state.auth.database.connect() as db:
        db.execute("UPDATE meals SET calories=NULL WHERE user_id=? AND id=?", (owner, m["id"]))
    rows = snapshot(client, h)["items"]
    energy = next(i for i in rows if i["kind"] == "calories")
    assert energy["deleted"] and energy["value"] is None and energy["revision"] == 2
    assert next(i for i in rows if i["kind"] == "protein")["value"] == 10
