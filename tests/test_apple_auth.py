"""Apple login rejects forged, replayed and cross-account credentials."""

import hashlib
import json
import time
from urllib.parse import parse_qs

import httpx
import jwt
import pytest
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from fastapi.testclient import TestClient

from foodlogger.app import create_app

MOBILE = {"X-FoodLogger-Request": "1", "X-FoodLogger-Client": "mobile"}


def test_unconfigured_apple_login_is_explicitly_unavailable(tmp_path):
    with TestClient(create_app(tmp_path / "test.db")) as client:
        response = client.post(
            "/api/auth/apple/challenge", headers=MOBILE, json={"purpose": "login"}
        )
        assert response.status_code == 503
        assert "not configured" in response.json()["detail"]


@pytest.fixture
def apple(tmp_path, monkeypatch):
    signing = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    client_key = ec.generate_private_key(ec.SECP256R1())
    monkeypatch.setenv("APPLE_CLIENT_ID", "io.github.ophbra22.foodlogger")
    monkeypatch.setenv("APPLE_TEAM_ID", "283L7984CA")
    monkeypatch.setenv("APPLE_KEY_ID", "TESTKEY")
    monkeypatch.setenv(
        "APPLE_PRIVATE_KEY",
        client_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        ).decode(),
    )
    monkeypatch.setenv("APPLE_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode())
    app = create_app(tmp_path / "test.db")
    client = TestClient(app)
    challenge = client.post("/api/auth/apple/challenge", headers=MOBILE, json={"purpose": "login"})
    assert challenge.status_code == 200
    codes, revoked = {}, []
    fail_revoke = [False]
    jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(signing.public_key()))
    jwk.update(kid="apple-test", alg="RS256", use="sig")

    def apple_http(request):
        if request.url.path == "/auth/keys":
            return httpx.Response(200, json={"keys": [jwk]})
        form = parse_qs(request.content.decode())
        # Verify the actual developer assertion sent by production code.
        assertion = jwt.decode(
            form["client_secret"][0],
            client_key.public_key(),
            algorithms=["ES256"],
            audience="https://appleid.apple.com",
        )
        assert assertion["iss"] == "283L7984CA"
        assert assertion["sub"] == "io.github.ophbra22.foodlogger"
        if request.url.path == "/auth/token":
            token = codes.pop(form["code"][0], None)
            if not token:
                return httpx.Response(400, json={"error": "invalid_grant"})
            return httpx.Response(
                200,
                json={
                    "id_token": token,
                    "refresh_token": "secret-refresh",
                    "access_token": "secret-access",
                },
            )
        if request.url.path == "/auth/revoke":
            if fail_revoke[0]:
                return httpx.Response(503)
            revoked.append(form["token"][0])
            return httpx.Response(200, json={})
        raise AssertionError("Unexpected Apple endpoint")

    app.state.apple.provider.client = httpx.Client(transport=httpx.MockTransport(apple_http))

    def proof(purpose="login", headers=None, subject="apple-user-1", **claims):
        h = {**MOBILE, **(headers or {})}
        response = client.post("/api/auth/apple/challenge", headers=h, json={"purpose": purpose})
        assert response.status_code == 200, response.text
        c = response.json()
        body = {
            "iss": "https://appleid.apple.com",
            "aud": "io.github.ophbra22.foodlogger",
            "exp": int(time.time()) + 300,
            "iat": int(time.time()),
            "sub": subject,
            "nonce": hashlib.sha256(c["nonce"].encode()).hexdigest(),
            **claims,
        }
        token = jwt.encode(body, signing, algorithm="RS256", headers={"kid": "apple-test"})
        code = "code-" + c["challenge_id"]
        codes[code] = token
        return {
            "challenge_id": c["challenge_id"],
            "identity_token": token,
            "authorization_code": code,
        }

    yield client, proof, app, revoked, fail_revoke
    client.close()


def login(client, proof):
    return client.post("/api/auth/apple/login", headers=MOBILE, json=proof)


def bearer(response):
    return {"Authorization": "Bearer " + response.json()["session_token"]}


def test_apple_login_is_repeatable_without_duplicate_user_and_stores_no_plain_tokens(apple):
    client, proof, app, _, _ = apple
    p = proof()
    first = login(client, p)
    assert first.status_code == 200, first.text
    second = login(client, proof())
    assert second.status_code == 200
    assert first.json()["user"]["id"] == second.json()["user"]["id"]
    assert first.json()["user"]["apple_linked"] is True
    assert first.json()["user"]["local_login"] is False
    assert "recovery_code" not in first.json()
    assert login(client, p).status_code == 403
    with app.state.auth.connect() as db:
        assert db.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"] == 1
        contents = " ".join(db.iterdump())
    assert "secret-refresh" not in contents and "secret-access" not in contents


@pytest.mark.parametrize(
    "claims",
    [
        {"aud": "another.app"},
        {"iss": "https://evil.example"},
        {"exp": 1},
        {"nonce": "wrong"},
        {"sub": ""},
    ],
)
def test_invalid_apple_claims_never_create_session(apple, claims):
    client, proof, app, _, _ = apple
    assert login(client, proof(**claims)).status_code == 403
    with app.state.auth.connect() as db:
        assert db.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"] == 0


def test_forged_signature_and_mismatched_code_are_rejected(apple):
    client, proof, _, _, _ = apple
    p = proof()
    body = jwt.decode(p["identity_token"], options={"verify_signature": False})
    p["identity_token"] = jwt.encode(
        body,
        "attacker-secret-that-is-long-enough",
        algorithm="HS256",
        headers={"kid": "apple-test"},
    )
    assert login(client, p).status_code == 403
    p = proof()
    other = proof(subject="different-person")
    p["authorization_code"] = other["authorization_code"]
    assert login(client, p).status_code == 403


def test_link_preserves_journal_and_cannot_reassign_an_existing_apple_identity(apple):
    client, proof, app, _, _ = apple
    account = client.post(
        "/api/auth/register",
        headers=MOBILE,
        json={"username": "alice", "password": "long-test-password"},
    )
    h = bearer(account)
    meal = {"food_id": "banana", "grams": 100, "day": "2026-10-11", "meal_type": "snack"}
    assert client.post("/api/meals", headers=h, json=meal).status_code == 201
    assert (
        client.post(
            "/api/auth/apple/link", headers={**MOBILE, **h}, json=proof("link", h)
        ).status_code
        == 200
    )
    apple_login = login(client, proof())
    assert apple_login.json()["user"]["id"] == account.json()["user"]["id"]
    assert apple_login.json()["user"]["local_login"] is True
    assert (
        client.get("/api/meals?day=2026-10-11", headers=bearer(apple_login)).json()["summary"][
            "count"
        ]
        == 1
    )
    bob = client.post(
        "/api/auth/register",
        headers=MOBILE,
        json={"username": "bob", "password": "long-test-password"},
    )
    bh = bearer(bob)
    assert (
        client.post(
            "/api/auth/apple/link", headers={**MOBILE, **bh}, json=proof("link", bh)
        ).status_code
        == 409
    )
    assert client.get("/api/auth/me", headers=bh).json()["user"]["apple_linked"] is False


def test_challenge_bound_to_session_purpose_and_expiry(apple):
    client, proof, app, _, _ = apple
    account = login(client, proof())
    h = bearer(account)
    p = proof("delete", h)
    assert login(client, p).status_code == 403
    p = proof()
    with app.state.auth.connect() as db:
        db.execute("UPDATE apple_challenges SET expires_at = 1")
    assert login(client, p).status_code == 403
    assert (
        client.post(
            "/api/auth/apple/challenge", headers=MOBILE, json={"purpose": "link"}
        ).status_code
        == 401
    )


def test_apple_delete_requires_same_identity_revokes_grant_and_erases_account(apple):
    client, proof, app, revoked, _ = apple
    account = login(client, proof())
    h = bearer(account)
    wrong = proof("delete", h, subject="somebody-else")
    r = client.post(
        "/api/auth/apple/delete", headers={**MOBILE, **h}, json={**wrong, "confirmation": "DELETE"}
    )
    assert r.status_code == 403
    assert client.get("/api/auth/me", headers=h).status_code == 200
    p = proof("delete", h)
    r = client.post(
        "/api/auth/apple/delete", headers={**MOBILE, **h}, json={**p, "confirmation": "DELETE"}
    )
    assert r.status_code == 204, r.text
    assert revoked == ["secret-refresh"]
    assert client.get("/api/auth/me", headers=h).status_code == 401
    with app.state.auth.connect() as db:
        assert db.execute("SELECT COUNT(*) AS n FROM apple_identities").fetchone()["n"] == 0


def test_revocation_failure_keeps_account_for_retry(apple):
    client, proof, _, _, fail_revoke = apple
    account = login(client, proof())
    h = bearer(account)
    fail_revoke[0] = True
    p = proof("delete", h)
    assert (
        client.post(
            "/api/auth/apple/delete", headers={**MOBILE, **h}, json={**p, "confirmation": "DELETE"}
        ).status_code
        == 503
    )
    assert client.get("/api/auth/me", headers=h).status_code == 200


def test_password_deletion_of_linked_account_also_revokes_apple(apple):
    client, proof, _, revoked, _ = apple
    account = client.post(
        "/api/auth/register",
        headers=MOBILE,
        json={"username": "alice", "password": "long-test-password"},
    )
    h = bearer(account)
    assert (
        client.post(
            "/api/auth/apple/link", headers={**MOBILE, **h}, json=proof("link", h)
        ).status_code
        == 200
    )
    result = client.request(
        "DELETE",
        "/api/auth/account",
        headers=h,
        json={"password": "long-test-password", "confirmation": "DELETE"},
    )
    assert result.status_code == 204
    assert revoked == ["secret-refresh"]
    assert client.get("/api/auth/me", headers=h).status_code == 401


def test_link_challenge_cannot_be_used_from_another_session(apple):
    client, proof, _, _, _ = apple
    account = login(client, proof())
    first = bearer(account)
    second = bearer(login(client, proof()))
    p = proof("link", first)
    result = client.post("/api/auth/apple/link", headers={**MOBILE, **second}, json=p)
    assert result.status_code == 403


def test_missing_confirmation_does_not_delete_account(apple):
    client, proof, _, _, _ = apple
    account = login(client, proof())
    h = bearer(account)
    assert (
        client.post(
            "/api/auth/apple/delete", headers={**MOBILE, **h}, json=proof("delete", h)
        ).status_code
        == 422
    )
    assert client.get("/api/auth/me", headers=h).status_code == 200
