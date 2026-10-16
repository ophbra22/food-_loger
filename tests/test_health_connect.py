"""P11 mocked Health Connect API contracts; no external providers."""

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from test_meal_analysis_pipeline import register

from foodlogger.app import create_app
from foodlogger.security import Settings


@pytest.fixture
def client(tmp_path):
    settings = Settings(tracking_enabled=True, tracking_writes=True)
    object.__setattr__(settings, "health_connect_enabled", True)
    with TestClient(create_app(tmp_path / "hc.db", settings=settings)) as c:
        yield c


def event(**patch):
    return dict(
        operation="upsert",
        external_id=str(uuid4()),
        kind="weight",
        value=70.0,
        start="2026-10-15T22:30:00Z",
        end="2026-10-15T22:30:00Z",
        modified_at="2026-10-15T23:00:00Z",
        source_bundle="com.example.scale",
        timezone_id="Asia/Jerusalem",
        start_offset_seconds=7200,
        end_offset_seconds=7200,
        **patch,
    )


def post(c, h, *events):
    return c.post("/api/health-connect/import", headers=h, json={"events": events})


def rows(c, h):
    return c.get("/api/weight?from=2026-10-15&to=2026-10-17", headers=h).json()["items"]


def test_defaults_off_auth_and_isolation(client, tmp_path):
    assert post(client, {}, event()).status_code == 401
    with TestClient(create_app(tmp_path / "off.db", settings=Settings())) as c:
        h = register(c, "offuser")
        assert post(c, h, event()).status_code == 503
        assert c.get("/api/capabilities", headers=h).json()["health_connect"] is False
    a, b = register(client, "alice"), register(client, "bob")
    e = event()
    assert post(client, a, e).status_code == 200
    assert rows(client, b) == []
    assert client.get("/api/health-connect/imports", headers=b).json()["items"] == []
    assert post(client, b, e).status_code == 200
    assert len(rows(client, b)) == 1


def test_versions_timezone_and_replay(client):
    h = register(client, "alice")
    e = event()
    assert post(client, h, e).json()["weight_dates"] == ["2026-10-16"]
    assert post(client, h, e).json()["weight_dates"] == []
    first = rows(client, h)[0]
    newer = {**e, "value": 71.0, "modified_at": "2026-10-16T01:00:00Z", "timezone_id": "UTC"}
    assert post(client, h, newer).json()["weight_dates"] == ["2026-10-16"]
    assert post(client, h, e).json()["weight_dates"] == []
    row = rows(client, h)[0]
    assert row["id"] == first["id"] and row["value"] == 71 and row["version"] == 2
    assert row["source"] == "health_connect" and row["timezone_id"] == "Asia/Jerusalem"
    receipt = client.get("/api/health-connect/imports", headers=h).json()["items"][0]
    assert receipt["start_offset_seconds"] == 7200 and receipt["timezone_id"] == "Asia/Jerusalem"
    assert post(client, h, newer).json()["weight_dates"] == []


def test_conflicting_identity_atomic(client):
    h = register(client, "alice")
    e = event()
    assert post(client, h, e).status_code == 200
    assert post(client, h, event(), {**e, "value": 72.0}).status_code == 409
    assert len(rows(client, h)) == 1
    for patch in ({"kind": "steps"}, {"source_bundle": "other.app"}):
        assert (
            post(client, h, {**e, **patch, "modified_at": "2026-10-17T00:00:00Z"}).status_code
            == 409
        )


def test_deletions_and_user_deleted_records_never_resurrect(client):
    h = register(client, "alice")
    a, b, unseen = event(), event(), event()
    assert post(client, h, a, b).status_code == 200
    ar = next(r for r in rows(client, h) if a["external_id"] in r["external_id"])
    assert client.delete(f"/api/weight/{ar['id']}?expected_version=1", headers=h).status_code == 204
    assert (
        post(client, h, {**a, "value": 72.0, "modified_at": "2026-10-17T00:00:00Z"}).status_code
        == 200
    )
    assert len(rows(client, h)) == 1

    def delete(e):
        return {"operation": "delete", "external_id": e["external_id"]}

    assert post(client, h, delete(b), delete(unseen)).json()["weight_dates"] == ["2026-10-16"]
    assert post(client, h, delete(b)).json()["weight_dates"] == []
    assert post(client, h, b, unseen).status_code == 200
    assert rows(client, h) == []


@pytest.mark.parametrize(
    "patch",
    [
        {"source_bundle": "io.github.ophbra22.foodlogger"},
        {"kind": "calories"},
        {"value": -1.0},
        {"modified_at": "2026-10-15T12:00:00"},
        {"start_offset_seconds": 70000},
        {"start_offset_seconds": True},
        {"timezone_id": "UTC+02:00"},
        {"end": "2026-10-14T00:00:00Z"},
        {"kind": "steps", "value": 2.2},
        {"external_id": "bad"},
    ],
)
def test_invalid_samples_rejected(client, patch):
    h = register(client, "alice")
    assert post(client, h, {**event(), **patch}).status_code == 422


def test_steps_provenance_and_provider_collision(client):
    h = register(client, "alice")
    e = {**event(), "kind": "steps", "value": 123.0, "end": "2026-10-15T22:31:00Z"}
    assert post(client, h, e).status_code == 200
    assert rows(client, h) == []
    assert client.get("/api/health-connect/imports", headers=h).json()["items"][0]["value"] == 123
    owner = client.get("/api/auth/me", headers=h).json()["user"]["id"]
    with client.app.state.auth.database.connect() as db:
        db.execute(
            "INSERT INTO health_imports VALUES (?,?,?,?)",
            (owner, e["external_id"], "{}", e["start"]),
        )
    assert post(client, h, e).status_code == 200
    assert client.post("/api/health-connect/reconcile", headers=h).json()["items"] == []
