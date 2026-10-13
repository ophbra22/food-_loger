"""Native Apple sign-in: verified proofs, one-use challenges and private identity links."""

import hashlib
import os
import secrets
import sqlite3
import threading
import time
from uuid import uuid4

import httpx
import jwt
from cryptography.fernet import Fernet, InvalidToken

from foodlogger.auth import AccountExists, InvalidCredentials, _hash_password, _token_hash


class AppleUnavailable(RuntimeError):
    pass


class AppleProvider:
    def __init__(self):
        self.client_id = os.getenv("APPLE_CLIENT_ID", "")
        self.team_id = os.getenv("APPLE_TEAM_ID", "")
        self.key_id = os.getenv("APPLE_KEY_ID", "")
        self.private_key = os.getenv("APPLE_PRIVATE_KEY", "").replace("\\n", "\n")
        self.encryption_key = os.getenv("APPLE_TOKEN_ENCRYPTION_KEY", "")
        self.enabled = all(
            (self.client_id, self.team_id, self.key_id, self.private_key, self.encryption_key)
        )
        self.cipher = Fernet(self.encryption_key.encode()) if self.enabled else None
        self.client = httpx.Client(timeout=10, follow_redirects=False)
        self._keys = {}
        self._keys_at = 0
        self._keys_lock = threading.Lock()

    def require_enabled(self):
        if not self.enabled:
            raise AppleUnavailable("Apple sign-in is not configured yet.")

    def _secret(self):
        self.require_enabled()
        now = int(time.time())
        return jwt.encode(
            {
                "iss": self.team_id,
                "iat": now,
                "exp": now + 300,
                "aud": "https://appleid.apple.com",
                "sub": self.client_id,
            },
            self.private_key,
            algorithm="ES256",
            headers={"kid": self.key_id},
        )

    def verify(self, token, nonce=None):
        self.require_enabled()
        try:
            header = jwt.get_unverified_header(token)
            kid = header.get("kid")
            if header.get("alg") != "RS256" or not isinstance(kid, str):
                raise InvalidCredentials("Invalid Apple credentials.")
            with self._keys_lock:
                age = time.time() - self._keys_at
                if age > 3600 or (kid not in self._keys and age > 5):
                    response = self.client.get("https://appleid.apple.com/auth/keys")
                    response.raise_for_status()
                    self._keys = {
                        k["kid"]: jwt.PyJWK.from_dict(k).key
                        for k in response.json()["keys"]
                        if k.get("kty") == "RSA" and k.get("alg") == "RS256"
                    }
                    self._keys_at = time.time()
                key = self._keys.get(kid)
            if key is None:
                raise InvalidCredentials("Invalid Apple credentials.")
            claims = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                audience=self.client_id,
                issuer="https://appleid.apple.com",
                options={"require": ["exp", "iat", "sub", "iss", "aud"], "strict_aud": True},
            )
            subject = claims["sub"]
            if not isinstance(subject, str) or not 1 <= len(subject) <= 255:
                raise InvalidCredentials("Invalid Apple credentials.")
            if nonce is not None and not secrets.compare_digest(
                str(claims.get("nonce", "")), hashlib.sha256(nonce.encode()).hexdigest()
            ):
                raise InvalidCredentials("Invalid Apple credentials.")
            return subject
        except (jwt.PyJWTError, ValueError, KeyError, TypeError):
            raise InvalidCredentials("Invalid Apple credentials.") from None
        except httpx.HTTPError:
            raise AppleUnavailable("Apple is temporarily unavailable. Please try again.") from None

    def exchange(self, code, identity_token, nonce):
        subject = self.verify(identity_token, nonce)
        try:
            r = self.client.post(
                "https://appleid.apple.com/auth/token",
                data={
                    "client_id": self.client_id,
                    "client_secret": self._secret(),
                    "code": code,
                    "grant_type": "authorization_code",
                },
            )
            if r.status_code == 400:
                raise InvalidCredentials("Invalid or expired Apple authorization. Try again.")
            r.raise_for_status()
            body = r.json()
            if self.verify(body["id_token"], nonce) != subject:
                raise InvalidCredentials("Invalid Apple credentials.")
            refresh = body["refresh_token"]
            if not isinstance(refresh, str) or not refresh:
                raise ValueError("missing refresh token")
            return subject, self.cipher.encrypt(refresh.encode()).decode()
        except InvalidCredentials:
            raise
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            raise AppleUnavailable("Apple is temporarily unavailable. Please try again.") from None

    def revoke(self, encrypted):
        self.require_enabled()
        try:
            token = self.cipher.decrypt(encrypted.encode()).decode()
            r = self.client.post(
                "https://appleid.apple.com/auth/revoke",
                data={
                    "client_id": self.client_id,
                    "client_secret": self._secret(),
                    "token": token,
                    "token_type_hint": "refresh_token",
                },
            )
            r.raise_for_status()
        except (httpx.HTTPError, InvalidToken, ValueError):
            raise AppleUnavailable("Could not revoke Apple access. Please try again.") from None


class AppleAuth:
    def __init__(self, auth):
        self.auth = auth
        self.provider = AppleProvider()
        if not auth.database.postgres:
            with auth.connect() as db:
                db.execute("""CREATE TABLE IF NOT EXISTS apple_identities (
                    subject TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE
                    REFERENCES users(id) ON DELETE CASCADE,
                    refresh_token TEXT NOT NULL, has_password INTEGER NOT NULL)""")
                db.execute("""CREATE TABLE IF NOT EXISTS apple_challenges (
                    id TEXT PRIMARY KEY, nonce TEXT NOT NULL, purpose TEXT NOT NULL,
                    session_hash TEXT NOT NULL, user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                    expires_at BIGINT NOT NULL)""")
                db.execute(
                    "CREATE INDEX IF NOT EXISTS apple_challenges_expiry "
                    "ON apple_challenges(expires_at)"
                )

    def flags(self, user):
        with self.auth.connect() as db:
            row = db.execute(
                "SELECT has_password, subject FROM apple_identities WHERE user_id = ?",
                (user["id"],),
            ).fetchone()
        return {
            **user,
            "apple_linked": row is not None,
            "apple_subject": row["subject"] if row else None,
            "local_login": bool(row["has_password"]) if row else True,
        }

    def challenge(self, purpose, token, user_id=None):
        self.provider.require_enabled()
        challenge_id, nonce = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        with self.auth.connect() as db:
            db.execute("DELETE FROM apple_challenges WHERE expires_at <= ?", (int(time.time()),))
            db.execute(
                "INSERT INTO apple_challenges "
                "(id, nonce, purpose, session_hash, user_id, expires_at) VALUES (?,?,?,?,?,?)",
                (challenge_id, nonce, purpose, _token_hash(token), user_id, int(time.time()) + 300),
            )
        return {"challenge_id": challenge_id, "nonce": nonce}

    def consume(self, proof, purpose, token, user_id=None):
        self.provider.require_enabled()
        with self.auth.connect() as db:
            row = db.execute(
                "DELETE FROM apple_challenges WHERE id = ? AND purpose = ? "
                "AND session_hash = ? AND expires_at > ? RETURNING nonce, user_id",
                (proof.challenge_id, purpose, _token_hash(token), int(time.time())),
            ).fetchone()
        if row is None or row["user_id"] != user_id:
            raise InvalidCredentials("Apple sign-in expired. Please try again.")
        return self.provider.exchange(proof.authorization_code, proof.identity_token, row["nonce"])

    def sign_in(self, subject, encrypted, user_id=None):
        try:
            return self._sign_in(subject, encrypted, user_id)
        except sqlite3.IntegrityError:
            raise AccountExists("Apple account changed concurrently. Try again.") from None

    def _sign_in(self, subject, encrypted, user_id=None):
        # A new Apple account has no user-known password or recovery credential.
        new_id = uuid4().hex
        password_hash = _hash_password(secrets.token_urlsafe(64))
        with self.auth.connect() as db:
            if not self.auth.database.postgres:
                db.execute("BEGIN IMMEDIATE")
            if user_id:
                existing = db.execute(
                    "SELECT id FROM users WHERE id = ?"
                    + (" FOR UPDATE" if self.auth.database.postgres else ""),
                    (user_id,),
                ).fetchone()
                if not existing:
                    raise InvalidCredentials("Sign in again before linking Apple.")
            row = db.execute(
                "SELECT user_id FROM apple_identities WHERE subject = ?", (subject,)
            ).fetchone()
            if row and user_id and row["user_id"] != user_id:
                raise AccountExists("This Apple account is already linked to another account.")
            if row:
                target = row["user_id"]
                current = db.execute(
                    "SELECT id FROM users WHERE id = ?"
                    + (" FOR UPDATE" if self.auth.database.postgres else ""),
                    (target,),
                ).fetchone()
                if not current:
                    raise InvalidCredentials("Account changed. Please sign in again.")
                db.execute(
                    "UPDATE apple_identities SET refresh_token = ? WHERE subject = ?",
                    (encrypted, subject),
                )
            else:
                target = user_id or new_id
                if (
                    user_id
                    and db.execute(
                        "SELECT 1 FROM apple_identities WHERE user_id = ?", (user_id,)
                    ).fetchone()
                ):
                    raise AccountExists("This account already has a linked Apple account.")
                if not user_id:
                    db.execute(
                        "INSERT INTO users (id, username, password_hash, recovery_hash) "
                        "VALUES (?,?,?,?)",
                        (
                            target,
                            "apple_" + new_id[:20],
                            password_hash,
                            _token_hash(secrets.token_urlsafe(32)),
                        ),
                    )
                try:
                    db.execute(
                        "INSERT INTO apple_identities "
                        "(subject, user_id, refresh_token, has_password) VALUES (?,?,?,?)",
                        (subject, target, encrypted, int(user_id is not None)),
                    )
                except sqlite3.IntegrityError:
                    raise AccountExists(
                        "Apple account was linked concurrently. Try again."
                    ) from None
            user = db.execute("SELECT id, username FROM users WHERE id = ?", (target,)).fetchone()
        return dict(user)

    def revoke_in_transaction(self, db, user_id):
        row = db.execute(
            "SELECT refresh_token FROM apple_identities WHERE user_id = ?", (user_id,)
        ).fetchone()
        if row:
            self.provider.revoke(row["refresh_token"])

    def delete(self, user_id, subject, fresh_token):
        with self.auth.connect() as db:
            if not self.auth.database.postgres:
                db.execute("BEGIN IMMEDIATE")
            db.execute(
                "SELECT id FROM users WHERE id = ?"
                + (" FOR UPDATE" if self.auth.database.postgres else ""),
                (user_id,),
            ).fetchone()
            row = db.execute(
                "SELECT subject FROM apple_identities WHERE user_id = ?", (user_id,)
            ).fetchone()
            if not row or row["subject"] != subject:
                raise InvalidCredentials("Use the Apple account linked to this journal.")
            self.provider.revoke(fresh_token)
            db.execute("DELETE FROM meals WHERE user_id = ?", (user_id,))
            db.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
            db.execute("DELETE FROM users WHERE id = ?", (user_id,))
