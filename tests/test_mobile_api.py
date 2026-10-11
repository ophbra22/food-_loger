"""Native-client sessions (bearer token) and retry-safe meal saves."""

from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image

from foodlogger.app import create_app

PASSWORD = "long-enough-password-2026"
MOBILE = {"X-FoodLogger-Request": "1", "X-FoodLogger-Client": "mobile"}
MEAL = {"food_id": "banana", "grams": 150, "day": "2026-10-08", "meal_type": "snack"}
CUSTOM = {
    "name": "Oat drink",
    "grams": 250,
    "basis_unit": "ml",
    "day": "2026-10-08",
    "meal_type": "breakfast",
    "nutrition": {"calories": 46, "protein": 1, "carbs": 6.7, "fat": 1.5},
}


def mobile_register(client, name):
    response = client.post(
        "/api/auth/register", json={"username": name, "password": PASSWORD}, headers=MOBILE
    )
    assert response.status_code == 201, response.text
    return response.json()


def bearer(account):
    return {"Authorization": "Bearer " + account["session_token"]}


def test_mobile_session_uses_a_bearer_token_without_cookie_or_csrf(tmp_path):
    with TestClient(create_app(tmp_path / "app.sqlite3")) as client:
        account = mobile_register(client, "alice")
        assert len(account["session_token"]) == 43
        assert account["expires_in"] == 604800
        assert account["recovery_code"]
        assert (
            "set-cookie"
            not in client.post(
                "/api/auth/login", json={"username": "alice", "password": PASSWORD}, headers=MOBILE
            ).headers
        )
        assert not client.cookies
        assert client.get("/api/auth/me").status_code == 401
        me = client.get("/api/auth/me", headers=bearer(account))
        assert me.json()["user"]["username"] == "alice"
        assert "session_token" not in me.json()
        # No CSRF header: a bearer credential is never attached by a browser on its own.
        saved = client.post("/api/meals", json=MEAL, headers=bearer(account))
        assert saved.status_code == 201, saved.text
        listed = client.get("/api/meals?day=2026-10-08", headers=bearer(account)).json()
        assert listed["summary"]["calories"] == 133.5
        assert (
            client.delete("/api/meals/" + saved.json()["id"], headers=bearer(account)).status_code
            == 204
        )


def test_browser_sessions_keep_cookie_and_csrf_protection(tmp_path):
    with TestClient(create_app(tmp_path / "app.sqlite3")) as client:
        response = client.post(
            "/api/auth/register",
            json={"username": "alice", "password": PASSWORD},
            headers={"X-FoodLogger-Request": "1"},
        )
        assert "session_token" not in response.json()
        assert client.cookies.get("foodlogger_session")
        assert client.post("/api/meals", json=MEAL).status_code == 403
        csrf = {"X-CSRF-Token": response.json()["csrf_token"]}
        assert client.post("/api/meals", json=MEAL, headers=csrf).status_code == 201
        # A cookie's token is not accepted with a wrong bearer header, and an
        # invalid bearer header never falls back to the cookie.
        assert (
            client.get("/api/auth/me", headers={"Authorization": "Bearer nope"}).status_code == 401
        )
        assert client.get("/api/auth/me", headers={"Authorization": "Basic abc"}).status_code == 401


def test_mobile_logout_revokes_only_that_token_and_accounts_stay_isolated(tmp_path):
    app = create_app(tmp_path / "app.sqlite3")
    with TestClient(app) as client:
        alice = mobile_register(client, "alice")
        bob = mobile_register(client, "bob")
        second = client.post(
            "/api/auth/login", json={"username": "alice", "password": PASSWORD}, headers=MOBILE
        ).json()
        saved = client.post("/api/meals", json=MEAL, headers=bearer(alice)).json()
        assert client.get("/api/meals?day=2026-10-08", headers=bearer(bob)).json()["meals"] == []
        assert client.delete("/api/meals/" + saved["id"], headers=bearer(bob)).status_code == 404
        assert client.post("/api/auth/logout", headers=bearer(alice)).status_code == 204
        assert client.get("/api/auth/me", headers=bearer(alice)).status_code == 401
        assert client.get("/api/auth/me", headers=bearer(second)).status_code == 200


def test_recovery_on_mobile_returns_new_token_and_code_and_revokes_old_sessions(tmp_path):
    with TestClient(create_app(tmp_path / "app.sqlite3")) as client:
        account = mobile_register(client, "alice")
        recovered = client.post(
            "/api/auth/recover",
            json={
                "username": "alice",
                "recovery_code": account["recovery_code"],
                "new_password": "a-different-long-password",
            },
            headers=MOBILE,
        )
        assert recovered.status_code == 200, recovered.text
        assert recovered.json()["recovery_code"] != account["recovery_code"]
        assert client.get("/api/auth/me", headers=bearer(account)).status_code == 401
        assert client.get("/api/auth/me", headers=bearer(recovered.json())).status_code == 200


def test_repeated_save_with_the_same_idempotency_key_creates_one_meal(tmp_path):
    with TestClient(create_app(tmp_path / "app.sqlite3")) as client:
        alice, bob = mobile_register(client, "alice"), mobile_register(client, "bob")
        key = {"Idempotency-Key": "draft-0123456789abcdef"}
        first = client.post("/api/meals", json=MEAL, headers={**bearer(alice), **key})
        again = client.post("/api/meals", json=MEAL, headers={**bearer(alice), **key})
        assert (first.status_code, again.status_code) == (201, 200)
        assert again.json() == first.json()
        day = client.get("/api/meals?day=2026-10-08", headers=bearer(alice)).json()
        assert day["summary"] == {
            "count": 1,
            "calories": 133.5,
            "protein": 1.6,
            "carbs": 34.3,
            "fat": 0.5,
        }
        # The same key from another account is an unrelated save.
        other = client.post("/api/meals", json=MEAL, headers={**bearer(bob), **key})
        assert other.status_code == 201 and other.json()["id"] != first.json()["id"]
        # Without a key every request is a new entry, as before.
        client.post("/api/meals", json=MEAL, headers=bearer(alice))
        client.post("/api/meals", json=MEAL, headers=bearer(alice))
        after = client.get("/api/meals?day=2026-10-08", headers=bearer(alice)).json()
        assert after["summary"]["count"] == 3


def test_custom_meal_retry_is_deduplicated_and_keeps_missing_nutrients_missing(tmp_path):
    with TestClient(create_app(tmp_path / "app.sqlite3")) as client:
        alice = mobile_register(client, "alice")
        headers = {**bearer(alice), "Idempotency-Key": "custom-draft-000000000001"}
        first = client.post("/api/meals/custom", json=CUSTOM, headers=headers)
        again = client.post("/api/meals/custom", json=CUSTOM, headers=headers)
        assert (first.status_code, again.status_code) == (201, 200)
        assert again.json()["id"] == first.json()["id"]
        meals = client.get("/api/meals?day=2026-10-08", headers=bearer(alice)).json()["meals"]
        assert len(meals) == 1
        assert "sugars" not in meals[0]["details"]["nutrition_per100"]
        assert meals[0]["details"]["basis_unit"] == "ml"


def test_invalid_idempotency_key_is_rejected(tmp_path):
    with TestClient(create_app(tmp_path / "app.sqlite3")) as client:
        alice = mobile_register(client, "alice")
        for key in ("short", "has spaces in the key!!", "x" * 65):
            response = client.post(
                "/api/meals", json=MEAL, headers={**bearer(alice), "Idempotency-Key": key}
            )
            assert response.status_code == 422, key


def test_uploads_accept_bearer_sessions_and_reject_missing_ones(tmp_path):
    class Suggests:
        name = "test-model"

        def predict(self, image):
            return {"status": "uncertain", "candidates": [], "unmapped_label": None}

    buffer = BytesIO()
    Image.new("RGB", (64, 64), "green").save(buffer, "JPEG")
    files = {"file": ("meal.jpg", buffer.getvalue(), "image/jpeg")}
    with TestClient(create_app(tmp_path / "app.sqlite3", Suggests())) as client:
        alice = mobile_register(client, "alice")
        assert client.post("/api/predict", files=files).status_code == 401
        result = client.post("/api/predict", files=files, headers=bearer(alice))
        assert result.status_code == 200, result.text
        assert result.json()["status"] == "uncertain"
        scan = client.post("/api/barcode/scan", files=files, headers=bearer(alice))
        assert scan.status_code == 422
