"""Account erasure uses disposable databases only."""

import sqlite3

import pytest
from fastapi.testclient import TestClient

from foodlogger.app import create_app
from foodlogger.auth import AuthStore, InvalidCredentials
from foodlogger.nutrition import Catalog
from foodlogger.schemas import MealCreate
from foodlogger.storage import Journal

PASSWORD = "disposable-password-2026"
MOBILE = {"X-FoodLogger-Request": "1", "X-FoodLogger-Client": "mobile"}
MEAL = {"food_id": "banana", "grams": 125.5, "day": "2026-10-11", "meal_type": "snack"}


def register(client, name):
    r = client.post(
        "/api/auth/register", headers=MOBILE, json={"username": name, "password": PASSWORD}
    )
    assert r.status_code == 201
    return r.json()


def headers(account):
    return {"Authorization": "Bearer " + account["session_token"]}


def delete(client, account, **body):
    return client.request(
        "DELETE",
        "/api/auth/account",
        headers=headers(account),
        json={"password": PASSWORD, "confirmation": "DELETE", **body},
    )


def test_deletion_erases_only_owner_and_revokes_every_session(tmp_path):
    path = tmp_path / "journal.db"
    with TestClient(create_app(path)) as client:
        alice, bob = register(client, "alice"), register(client, "bob")
        browser = client.post(
            "/api/auth/login",
            headers={"X-FoodLogger-Request": "1"},
            json={"username": "alice", "password": PASSWORD},
        )
        assert browser.status_code == 200
        second = client.post(
            "/api/auth/login", headers=MOBILE, json={"username": "alice", "password": PASSWORD}
        ).json()
        for account in (alice, bob):
            assert client.post("/api/meals", headers=headers(account), json=MEAL).status_code == 201
        assert delete(client, alice).status_code == 204
        for account in (alice, second):
            assert client.get("/api/auth/me", headers=headers(account)).status_code == 401
            assert delete(client, account).status_code == 401
        assert client.get("/api/auth/me").status_code == 401
        assert (
            client.post(
                "/api/auth/login", headers=MOBILE, json={"username": "alice", "password": PASSWORD}
            ).status_code
            == 401
        )
        assert (
            client.post(
                "/api/auth/recover",
                headers=MOBILE,
                json={
                    "username": "alice",
                    "recovery_code": alice["recovery_code"],
                    "new_password": PASSWORD,
                },
            ).status_code
            == 401
        )
        assert (
            client.get("/api/meals?day=2026-10-11", headers=headers(bob)).json()["summary"]["count"]
            == 1
        )
        with sqlite3.connect(path) as db:
            for table in ("meals", "sessions"):
                assert (
                    db.execute(
                        f"SELECT COUNT(*) FROM {table} WHERE user_id=?", (alice["user"]["id"],)
                    ).fetchone()[0]
                    == 0
                )
            assert (
                db.execute(
                    "SELECT COUNT(*) FROM users WHERE id=?", (alice["user"]["id"],)
                ).fetchone()[0]
                == 0
            )


def test_authorization_confirmation_password_and_target_cannot_be_bypassed(tmp_path):
    with TestClient(create_app(tmp_path / "journal.db")) as client:
        alice = register(client, "alice")
        assert (
            client.request(
                "DELETE", "/api/auth/account", json={"password": PASSWORD, "confirmation": "DELETE"}
            ).status_code
            == 401
        )
        assert delete(client, alice, password="wrong-password-2026").status_code == 403
        assert delete(client, alice, confirmation="").status_code == 422
        assert delete(client, alice, user_id="another-user").status_code == 422
        assert client.get("/api/auth/me", headers=headers(alice)).status_code == 200


def test_browser_deletion_requires_csrf(tmp_path):
    with TestClient(create_app(tmp_path / "journal.db")) as client:
        result = client.post(
            "/api/auth/register",
            headers={"X-FoodLogger-Request": "1"},
            json={"username": "alice", "password": PASSWORD},
        ).json()
        body = {"password": PASSWORD, "confirmation": "DELETE"}
        assert client.request("DELETE", "/api/auth/account", json=body).status_code == 403
        assert (
            client.request(
                "DELETE",
                "/api/auth/account",
                json=body,
                headers={"X-CSRF-Token": result["csrf_token"]},
            ).status_code
            == 204
        )


def test_failure_rolls_back_meals_sessions_and_user(tmp_path):
    path = tmp_path / "journal.db"
    journal, auth = Journal(path), AuthStore(path)
    user, _ = auth.register("alice", PASSWORD)
    token, _ = auth.create_session(user["id"])
    journal.add(MealCreate(**MEAL), Catalog(), user_id=user["id"])
    with auth.connect() as db:
        db.execute(
            "CREATE TRIGGER fail_delete BEFORE DELETE ON users "
            "BEGIN SELECT RAISE(ABORT, 'test failure'); END"
        )
    with pytest.raises(sqlite3.IntegrityError):
        auth.delete_account(user["id"], PASSWORD)
    assert auth.get_session(token)
    assert len(journal.list(MealCreate(**MEAL).day, user_id=user["id"])) == 1


def test_inflight_save_cannot_recreate_deleted_users_journal(tmp_path):
    path = tmp_path / "journal.db"
    journal, auth = Journal(path), AuthStore(path)
    user, _ = auth.register("alice", PASSWORD)
    auth.delete_account(user["id"], PASSWORD)
    with pytest.raises(sqlite3.IntegrityError):
        journal.add(MealCreate(**MEAL), Catalog(), user_id=user["id"])
    assert journal.list(MealCreate(**MEAL).day, user_id=user["id"]) == []


def test_password_changed_during_verification_cannot_authorize_deletion(tmp_path, monkeypatch):
    import foodlogger.auth as module

    path = tmp_path / "journal.db"
    Journal(path)
    auth = AuthStore(path)
    user, code = auth.register("alice", PASSWORD)
    verify = module._verify_password

    def racing_verify(encoded, password):
        result = verify(encoded, password)
        auth.recover("alice", code, "changed-password-2026")
        return result

    monkeypatch.setattr(module, "_verify_password", racing_verify)
    with pytest.raises(InvalidCredentials):
        auth.delete_account(user["id"], PASSWORD)
    with auth.connect() as db:
        assert db.execute("SELECT id FROM users WHERE id=?", (user["id"],)).fetchone()
