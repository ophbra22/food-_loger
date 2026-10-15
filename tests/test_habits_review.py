"""Independent P09 findings: tests must fail on the reviewed candidate."""

from datetime import UTC, datetime, timedelta

import pytest
from test_habits import NOW, setup
from test_habits import client as client
from test_meal_analysis_pipeline import register

from foodlogger.habits import DeviceBody, HabitPreferences, due
from foodlogger.meal_service import MealConflict


@pytest.mark.parametrize("clock", ["02:56", "02:57", "02:58", "02:59"])
def test_dst_gap_end_never_catches_up(clock):
    p = HabitPreferences(
        expected_version=0,
        timezone_id="America/New_York",
        breakfast=clock,
        quiet_start=None,
        quiet_end=None,
    ).model_dump()
    assert not due(p, "breakfast", datetime(2026, 3, 8, 7, 0, tzinfo=UTC))


def test_slow_final_query_exceeding_decision_deadline_does_not_send(client, monkeypatch):
    _, service, owner = setup(client)
    elapsed = [0.0]
    monkeypatch.setattr("foodlogger.habits.time.monotonic", lambda: elapsed[0])
    original = service._eligible
    count = 0

    def slow(*args):
        nonlocal count
        result = original(*args)
        count += 1
        if count == 2:
            elapsed[0] = 6.0
        return result

    monkeypatch.setattr(service, "_eligible", slow)
    assert (
        service.dispatch(owner, "lunch", lambda _: pytest.fail("deadline elapsed"), NOW)
        == "suppressed"
    )


def test_same_installation_can_rebind_after_offline_logout_without_old_credential(client):
    headers = register(client, "alice")
    service = client.app.state.habits
    alice = client.get("/api/auth/me", headers=headers).json()["user"]["id"]
    a_token = headers["Authorization"].split()[1]
    body = dict(
        token="ExpoPushToken[shared-installation]",
        platform="ios",
        ready=True,
        installation_secret="a" * 32,
        installation_generation=1,
    )
    service.register(alice, a_token, DeviceBody(**body), NOW)
    headers = register(client, "bob")
    bob = client.get("/api/auth/me", headers=headers).json()["user"]["id"]
    b_token = headers["Authorization"].split()[1]
    # Knowledge of the Expo token alone does not authorize taking a live registration.
    with pytest.raises(MealConflict):
        service.register(
            bob,
            b_token,
            DeviceBody(**{**body, "installation_secret": "b" * 32, "installation_generation": 2}),
            NOW,
        )
    service.register(
        bob,
        b_token,
        DeviceBody(**{**body, "installation_generation": 2}),
        NOW + timedelta(minutes=16),
    )
    # An earlier in-flight refresh from Alice cannot reclaim Bob's installation.
    with pytest.raises(MealConflict):
        service.register(alice, a_token, DeviceBody(**body), NOW + timedelta(minutes=17))
    with service.database.connect() as db:
        row = db.execute("SELECT user_id FROM reminder_devices").fetchone()
        assert row["user_id"] == bob


def test_final_query_crossing_slot_boundary_suppresses(client, monkeypatch):
    _, service, owner = setup(client)
    elapsed = [0.0]
    monkeypatch.setattr("foodlogger.habits.time.monotonic", lambda: elapsed[0])
    original = service._eligible
    calls = 0

    def slow(*args):
        nonlocal calls
        result = original(*args)
        calls += 1
        if calls == 2:
            elapsed[0] = 2.0
        return result

    monkeypatch.setattr(service, "_eligible", slow)
    assert (
        service.dispatch(
            owner,
            "lunch",
            lambda _: pytest.fail("past slot boundary"),
            NOW.replace(minute=4, second=59),
        )
        == "suppressed"
    )


def test_logout_is_idempotent_when_account_disappears_before_lock(tmp_path, monkeypatch):
    from foodlogger.auth import AuthStore
    from foodlogger.foundation import lock_owner
    from foodlogger.storage import Journal

    path = tmp_path / "logout-delete.db"
    Journal(path)
    auth = AuthStore(path)
    user, _ = auth.register("race_user", "test-long-password-2026")
    token, _ = auth.create_session(user["id"])

    def deleted(database, db, owner):
        auth.delete_account(owner, "test-long-password-2026")
        lock_owner(database, db, owner)

    monkeypatch.setattr("foodlogger.foundation.lock_owner", deleted)
    auth.revoke_session(token)
    assert auth.get_session(token) is None


def test_final_query_rechecks_oldest_device_lease(client, monkeypatch):
    h, service, owner = setup(client)
    second = client.post(
        "/api/auth/login",
        headers={"X-FoodLogger-Request": "1", "X-FoodLogger-Client": "mobile"},
        json={"username": "alice", "password": "test-long-password-2026"},
    ).json()["session_token"]
    service.register(
        owner,
        second,
        DeviceBody(
            token="ExpoPushToken[lease-boundary]",
            platform="ios",
            ready=True,
            installation_secret="b" * 32,
            installation_generation=1,
        ),
        NOW - timedelta(seconds=899),
    )
    elapsed = [0.0]
    monkeypatch.setattr("foodlogger.habits.time.monotonic", lambda: elapsed[0])
    original = service._eligible
    calls = 0

    def slow(*args):
        nonlocal calls
        result = original(*args)
        calls += 1
        if calls == 2:
            elapsed[0] = 2.0
        return result

    monkeypatch.setattr(service, "_eligible", slow)
    assert (
        service.dispatch(owner, "lunch", lambda _: pytest.fail("secondary lease expired"), NOW)
        == "suppressed"
    )
