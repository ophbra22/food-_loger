"""P09 real SQLite behavior, fixed clock and mocked delivery only."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from test_meal_analysis_pipeline import register
from test_trends import meal

from foodlogger.app import create_app
from foodlogger.habits import DeviceBody, HabitPreferences
from foodlogger.security import Settings

NOW = datetime(2026, 10, 15, 12, 0, tzinfo=UTC)


@pytest.fixture
def client(tmp_path):
    settings = Settings(
        canonical_writes=True, goals_enabled=True, tracking_enabled=True, tracking_writes=True
    )
    object.__setattr__(settings, "habits_enabled", True)
    with TestClient(create_app(tmp_path / "habits.db", settings=settings)) as c:
        yield c


def setup(c, **kw):
    h = register(c, "alice")
    r = c.put(
        "/api/habits/preferences",
        headers=h,
        json=dict(expected_version=0, timezone_id="UTC", lunch="12:00", **kw),
    )
    assert r.status_code == 200, r.text
    service = c.app.state.habits
    owner = c.get("/api/auth/me", headers=h).json()["user"]["id"]
    token = h["Authorization"].split()[1]
    service.register(
        owner,
        token,
        DeviceBody(token="ExpoPushToken[fixture-alice]", platform="ios", ready=True),
        NOW,
    )
    return h, service, owner


def test_preferences_defaults_and_conflict_and_owner(client):
    h = register(client, "alice")
    d = client.get("/api/habits?timezone_id=UTC", headers=h).json()
    assert d["preferences"]["lunch"] is None
    assert d["streak"]["current"] == 0
    assert (
        client.put(
            "/api/habits/preferences",
            headers=h,
            json=dict(expected_version=0, timezone_id="UTC", lunch="12:00"),
        ).status_code
        == 200
    )
    assert (
        client.put(
            "/api/habits/preferences", headers=h, json=dict(expected_version=0, timezone_id="UTC")
        ).status_code
        == 409
    )
    b = register(client, "bob")
    assert (
        client.get("/api/habits?timezone_id=UTC", headers=b).json()["preferences"]["version"] == 0
    )


@pytest.mark.parametrize(
    "change",
    [
        {"timezone_id": "Mars/X"},
        {"lunch": "25:00"},
        {"quiet_start": "22:00", "quiet_end": None},
        {"muted": "true"},
    ],
)
def test_reject_invalid_preferences(client, change):
    h = register(client, "alice")
    assert (
        client.put(
            "/api/habits/preferences", headers=h, json=dict(expected_version=0, **change)
        ).status_code
        == 422
    )


def test_streak_confirmed_dates_only_not_water_goals_or_future(client):
    h, s, owner = setup(client)
    assert s.streak(owner, NOW.date()) == dict(current=0, longest=0, logged_days=0)
    meal(client, h, "2026-10-13", 100)
    meal(client, h, "2026-10-14", 900)
    meal(client, h, "2026-10-14", 100)
    meal(client, h, "2026-10-17", 100)
    assert s.streak(owner, NOW.date()) == dict(current=2, longest=2, logged_days=2)
    assert s.streak(owner, datetime(2026, 10, 16).date())["current"] == 0


def test_lunch_log_suppresses_and_other_category_does_not(client):
    h, s, owner = setup(client)
    sent = []
    assert s.dispatch(owner, "lunch", sent.append, NOW) == "sent"
    assert len(sent) == 1 and sent[0]["ttl"] == 0
    assert s.dispatch(owner, "lunch", sent.append, NOW) == "suppressed"
    # A new owner's confirmed lunch makes no dispatch claim.
    with s.database.connect() as db:
        db.execute("DELETE FROM reminder_attempts WHERE user_id=?", (owner,))
    meal(client, h, "2026-10-15", 200)
    with s.database.connect() as db:
        db.execute("UPDATE meals SET meal_type='lunch' WHERE user_id=?", (owner,))
    assert s.dispatch(owner, "lunch", sent.append, NOW) == "suppressed"


@pytest.mark.parametrize("reason", ["stale", "not_ready", "logout", "muted", "quiet", "wrong_time"])
def test_suppress_uncertain_or_disallowed(client, reason):
    h, s, owner = setup(client)
    clock = NOW
    if reason == "stale":
        with s.database.connect() as db:
            db.execute("UPDATE reminder_devices SET checked_at=0")
    elif reason == "not_ready":
        with s.database.connect() as db:
            db.execute("UPDATE reminder_devices SET ready=0")
    elif reason == "logout":
        client.post("/api/auth/logout", headers=h)
    elif reason in ("muted", "quiet"):
        s.put_preferences(
            owner,
            HabitPreferences(
                expected_version=1,
                timezone_id="UTC",
                lunch="12:00",
                muted=reason == "muted",
                quiet_start="11:00",
                quiet_end="13:00",
            ),
        )
    else:
        clock = NOW.replace(hour=13)
    assert s.dispatch(owner, "lunch", lambda _: pytest.fail("must suppress"), clock) == "suppressed"


def test_timeout_is_not_retried_and_concurrent_workers_at_most_once(client):
    _, s, owner = setup(client)

    def fail(_):
        raise TimeoutError()

    assert s.dispatch(owner, "lunch", fail, NOW) == "uncertain"
    assert s.dispatch(owner, "lunch", fail, NOW) == "suppressed"
    with s.database.connect() as db:
        db.execute("DELETE FROM reminder_attempts")
    sent = []
    with ThreadPoolExecutor(8) as pool:
        results = list(pool.map(lambda _: s.dispatch(owner, "lunch", sent.append, NOW), range(8)))
    assert results.count("sent") == 1 and len(sent) == 1


def test_water_unknown_target_suppresses_and_goal_progress_checked(client):
    h, s, owner = setup(client, water="12:00")
    assert s.dispatch(owner, "water", lambda _: pytest.fail("no goal"), NOW) == "suppressed"
    assert (
        client.put(
            "/api/goals",
            headers=h,
            json=dict(
                effective_local_date="2026-10-15",
                timezone_id="UTC",
                allow_past=True,
                expected_version=0,
                water_ml=1000,
            ),
        ).status_code
        == 200
    )
    assert s.dispatch(owner, "water", lambda _: None, NOW) == "sent"


def test_dst_repeated_hour_deduplicated_and_midnight_streak(client):
    h, s, owner = setup(client)
    s.put_preferences(
        owner,
        HabitPreferences(
            expected_version=1,
            timezone_id="America/New_York",
            lunch="01:30",
            quiet_start=None,
            quiet_end=None,
        ),
    )
    first = datetime(2026, 11, 1, 5, 30, tzinfo=UTC)
    with s.database.connect() as db:
        db.execute("UPDATE reminder_devices SET checked_at=?", (int(first.timestamp()),))
        db.execute("UPDATE sessions SET expires_at=?", (int(first.timestamp()) + 10000,))
    assert s.dispatch(owner, "lunch", lambda _: None, first) == "sent"
    second = first.replace(hour=6)
    with s.database.connect() as db:
        db.execute("UPDATE reminder_devices SET checked_at=?", (int(second.timestamp()),))
    assert (
        s.dispatch(owner, "lunch", lambda _: pytest.fail("repeated hour"), second) == "suppressed"
    )


def test_disabled_and_deleted_account(client):
    h, s, owner = setup(client)
    assert s.tick(lambda _: pytest.fail("disabled"), NOW) == dict(sent=0, uncertain=0, suppressed=0)
    assert (
        client.request(
            "DELETE",
            "/api/auth/account",
            headers=h,
            json={"password": "test-long-password-2026", "confirmation": "DELETE"},
        ).status_code
        == 204
    )


def test_unknown_database_state_fails_closed(client, monkeypatch):
    _, s, owner = setup(client)

    def fail():
        raise RuntimeError("unavailable")

    monkeypatch.setattr(s.database, "connect", fail)
    assert s.dispatch(owner, "lunch", lambda _: pytest.fail("unknown state"), NOW) == "suppressed"


def test_device_rotation_denial_owner_isolation_and_revocation(client):
    h, s, owner = setup(client)
    b = register(client, "bob")
    body = {"token": "ExpoPushToken[fixture-alice]", "platform": "ios", "ready": True}
    assert client.put("/api/habits/device", headers=b, json=body).status_code == 409
    body["token"] = "ExpoPushToken[fixture-rotated]"
    assert client.put("/api/habits/device", headers=h, json=body).status_code == 200
    with s.database.connect() as db:
        rows = db.execute("SELECT token FROM reminder_devices").fetchall()
        assert [r["token"] for r in rows] == [body["token"]]
    assert client.delete("/api/habits/device", headers=b).status_code == 204
    with s.database.connect() as db:
        assert db.execute("SELECT count(*) AS n FROM reminder_devices").fetchone()["n"] == 1
    assert client.delete("/api/habits/device", headers=h).status_code == 204
    assert s.dispatch(owner, "lunch", lambda _: pytest.fail("revoked"), NOW) == "suppressed"


def test_water_only_and_goal_only_never_increment_streak_and_completed_water_suppresses(client):
    h, s, owner = setup(client, water="12:00")
    client.put(
        "/api/goals",
        headers=h,
        json=dict(
            effective_local_date="2026-10-15",
            timezone_id="UTC",
            allow_past=True,
            expected_version=0,
            water_ml=500,
        ),
    )
    r = client.post(
        "/api/water",
        headers={**h, "Idempotency-Key": "water-only-fixture"},
        json={
            "value": 500,
            "occurred_at": "2026-10-15T11:00:00Z",
            "local_date": "2026-10-15",
            "timezone_id": "UTC",
            "source": "manual",
        },
    )
    assert r.status_code == 201, r.text
    assert s.streak(owner, NOW.date())["current"] == 0
    assert s.dispatch(owner, "water", lambda _: pytest.fail("target reached"), NOW) == "suppressed"


def test_spring_dst_gap_no_catchup_and_travel_throttle(client):
    from foodlogger.habits import due

    p = HabitPreferences(
        expected_version=0,
        timezone_id="America/New_York",
        breakfast="02:30",
        quiet_start=None,
        quiet_end=None,
    ).model_dump()
    assert not due(p, "breakfast", datetime(2026, 3, 8, 7, 30, tzinfo=UTC))
    h, s, owner = setup(client)
    assert s.dispatch(owner, "lunch", lambda _: None, NOW) == "sent"
    # Same date/time after a zone change cannot cause another lunch reminder.
    s.put_preferences(
        owner, HabitPreferences(expected_version=1, timezone_id="Europe/London", lunch="13:00")
    )
    assert (
        s.dispatch(owner, "lunch", lambda _: pytest.fail("travel duplicate"), NOW) == "suppressed"
    )


def test_fresh_state_rechecked_after_durable_claim(client, monkeypatch):
    h, s, owner = setup(client)
    original = s._eligible
    calls = 0

    def changed(db, *args):
        nonlocal calls
        calls += 1
        if calls == 2:
            return None
        return original(db, *args)

    monkeypatch.setattr(s, "_eligible", changed)
    assert s.dispatch(owner, "lunch", lambda _: pytest.fail("state changed"), NOW) == "suppressed"
    assert calls == 2


def test_removed_push_token_and_api_invalid_zone(client):
    h, s, owner = setup(client)
    assert client.get("/api/habits?timezone_id=invalid", headers=h).status_code == 422
    assert s.dispatch(owner, "lunch", lambda _: "DeviceNotRegistered", NOW) == "suppressed"
    with s.database.connect() as db:
        assert db.execute("SELECT count(*) AS n FROM reminder_devices").fetchone()["n"] == 0


def test_one_unready_device_suppresses_owner_even_with_another_ready_device(client):
    h, s, owner = setup(client)
    response = client.post(
        "/api/auth/login",
        headers={"X-FoodLogger-Request": "1", "X-FoodLogger-Client": "mobile"},
        json={"username": "alice", "password": "test-long-password-2026"},
    )
    assert response.status_code == 200
    token = response.json()["session_token"]
    s.register(
        owner,
        token,
        DeviceBody(token="ExpoPushToken[second-device]", platform="android", ready=False),
        NOW,
    )
    assert (
        s.dispatch(owner, "lunch", lambda _: pytest.fail("unknown second device"), NOW)
        == "suppressed"
    )
