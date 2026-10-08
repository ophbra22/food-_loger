"""Local accounts with Argon2id passwords and opaque, revocable sessions."""

import hashlib
import re
import secrets
import sqlite3
import threading
import time
from pathlib import Path
from uuid import uuid4

from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError

from foodlogger.database import Database

_PASSWORD_HASHER = PasswordHasher(memory_cost=19456, time_cost=2, parallelism=1, type=Type.ID)
# Bound Argon2's working memory across concurrent FastAPI worker threads.
_PASSWORD_SLOTS = threading.BoundedSemaphore(2)
_CREDENTIALS_MESSAGE = "Invalid username or credentials."


class AccountExists(ValueError):
    """The normalized username is already registered."""


class InvalidCredentials(ValueError):
    """The supplied login or recovery credentials are invalid."""


class InvalidAccountInput(ValueError):
    """An account field does not meet its length or format requirements."""


def _username(value: str) -> str:
    if not isinstance(value, str):
        raise InvalidAccountInput("Username must contain 3–32 ASCII letters, digits, '_' or '-'.")
    normalized = value.strip()
    if not normalized.isascii() or not re.fullmatch(r"[A-Za-z0-9_-]{3,32}", normalized):
        raise InvalidAccountInput("Username must contain 3–32 ASCII letters, digits, '_' or '-'.")
    return normalized.lower()


def _password(value: str) -> str:
    if not isinstance(value, str) or not 12 <= len(value) <= 128:
        raise InvalidAccountInput("Password must contain 12–128 characters.")
    try:
        value.encode("utf-8")
    except UnicodeEncodeError:
        raise InvalidAccountInput("Password must contain valid Unicode characters.") from None
    return value


def _hash_password(password: str) -> str:
    with _PASSWORD_SLOTS:
        return _PASSWORD_HASHER.hash(password)


def _verify_password(password_hash: str, password: str) -> bool:
    with _PASSWORD_SLOTS:
        try:
            return _PASSWORD_HASHER.verify(password_hash, password)
        except (VerificationError, InvalidHashError):
            return False


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def _valid_token(token: str | None) -> bool:
    return isinstance(token, str) and bool(re.fullmatch(r"[A-Za-z0-9_-]{43}", token))


# Missing accounts still perform the same password-verification work as real accounts.
_DUMMY_PASSWORD_HASH = _hash_password(secrets.token_urlsafe(32))


class AuthStore:
    SESSION_TTL_SECONDS = 604800

    def __init__(self, path: str | Path | Database):
        self.database = path if isinstance(path, Database) else Database(path)
        self.path = self.database.path
        if self.database.postgres:
            self.database.check_schema()
            return
        with self.connect() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    recovery_hash TEXT NOT NULL
                )
            """)
            db.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    token_hash TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    csrf_token TEXT NOT NULL,
                    expires_at INTEGER NOT NULL
                )
            """)
            db.execute("CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id)")
            db.execute("CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at)")

    def connect(self):
        return self.database.connect()

    def register(self, username: str, password: str) -> tuple[dict, str]:
        username = _username(username)
        password = _password(password)
        user = {"id": uuid4().hex, "username": username}
        recovery_code = secrets.token_urlsafe(32)
        password_hash = _hash_password(password)
        try:
            with self.connect() as db:
                db.execute(
                    "INSERT INTO users (id, username, password_hash, recovery_hash) "
                    "VALUES (?,?,?,?)",
                    (user["id"], username, password_hash, _token_hash(recovery_code)),
                )
        except sqlite3.IntegrityError:
            raise AccountExists("Username is unavailable.") from None
        return user, recovery_code

    def authenticate(self, username: str, password: str) -> dict:
        """Verify credentials without issuing a session. HTTP logins use authenticate_session."""
        user, _ = self._authenticate_snapshot(username, password)
        return user

    def authenticate_session(self, username: str, password: str) -> tuple[dict, str, str]:
        user, password_hash = self._authenticate_snapshot(username, password)
        token, csrf = self.create_session(user["id"], expected_password_hash=password_hash)
        return user, token, csrf

    def _authenticate_snapshot(self, username: str, password: str) -> tuple[dict, str]:
        try:
            username = _username(username)
            password = _password(password)
        except InvalidAccountInput:
            raise InvalidCredentials(_CREDENTIALS_MESSAGE) from None
        with self.connect() as db:
            row = db.execute(
                "SELECT id, username, password_hash FROM users WHERE username = ?", (username,)
            ).fetchone()
        password_hash = row["password_hash"] if row else _DUMMY_PASSWORD_HASH
        valid_password = _verify_password(password_hash, password)
        if row is None or not valid_password:
            raise InvalidCredentials(_CREDENTIALS_MESSAGE)
        return {"id": row["id"], "username": row["username"]}, password_hash

    def create_session(
        self, user_id: str, *, expected_password_hash: str | None = None
    ) -> tuple[str, str]:
        token = secrets.token_urlsafe(32)
        csrf_token = secrets.token_urlsafe(32)
        expires_at = int(time.time()) + self.SESSION_TTL_SECONDS
        with self.connect() as db:
            db.execute("DELETE FROM sessions WHERE expires_at <= ?", (int(time.time()),))
            if expected_password_hash is None:
                db.execute(
                    "INSERT INTO sessions (token_hash, user_id, csrf_token, expires_at) "
                    "VALUES (?,?,?,?)",
                    (_token_hash(token), user_id, csrf_token, expires_at),
                )
            else:
                # Lock credentials through session insertion on PostgreSQL. Recovery
                # must either delete this committed session or finish before this read.
                if self.database.postgres:
                    current = db.execute(
                        "SELECT password_hash FROM users WHERE id = ? FOR UPDATE", (user_id,)
                    ).fetchone()
                    if not current or current["password_hash"] != expected_password_hash:
                        raise InvalidCredentials(_CREDENTIALS_MESSAGE)
                inserted = db.execute(
                    "INSERT INTO sessions (token_hash, user_id, csrf_token, expires_at) "
                    "SELECT ?, id, ?, ? FROM users WHERE id = ? AND password_hash = ?",
                    (_token_hash(token), csrf_token, expires_at, user_id, expected_password_hash),
                )
                if inserted.rowcount != 1:
                    raise InvalidCredentials(_CREDENTIALS_MESSAGE)
        return token, csrf_token

    def get_session(self, token: str | None) -> dict | None:
        if not _valid_token(token):
            return None
        with self.connect() as db:
            row = db.execute(
                """
                SELECT users.id, users.username, sessions.csrf_token, sessions.expires_at
                FROM sessions JOIN users ON users.id = sessions.user_id
                WHERE sessions.token_hash = ? AND sessions.expires_at > ?
                """,
                (_token_hash(token), int(time.time())),
            ).fetchone()
        if row is None:
            return None
        return {
            "user": {"id": row["id"], "username": row["username"]},
            "csrf_token": row["csrf_token"],
            "expires_at": row["expires_at"],
        }

    def revoke_session(self, token: str | None) -> None:
        if _valid_token(token):
            with self.connect() as db:
                db.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_hash(token),))

    def recover(self, username: str, recovery_code: str, new_password: str) -> tuple[dict, str]:
        new_password = _password(new_password)
        try:
            username = _username(username)
        except InvalidAccountInput:
            raise InvalidCredentials(_CREDENTIALS_MESSAGE) from None
        if not _valid_token(recovery_code):
            raise InvalidCredentials(_CREDENTIALS_MESSAGE)
        recovery_hash = _token_hash(recovery_code)
        with self.connect() as db:
            row = db.execute(
                "SELECT id, username, recovery_hash FROM users WHERE username = ?", (username,)
            ).fetchone()
        valid_code = secrets.compare_digest(
            row["recovery_hash"] if row else "0" * 64, recovery_hash
        )
        if row is None or not valid_code:
            raise InvalidCredentials(_CREDENTIALS_MESSAGE)

        # Run expensive hashing before taking the database write lock. The conditional
        # update below ensures only one concurrent use of the recovery code succeeds.
        password_hash = _hash_password(new_password)
        new_code = secrets.token_urlsafe(32)
        with self.connect() as db:
            updated = db.execute(
                """
                UPDATE users SET password_hash = ?, recovery_hash = ?
                WHERE id = ? AND recovery_hash = ?
                """,
                (password_hash, _token_hash(new_code), row["id"], recovery_hash),
            )
            if updated.rowcount != 1:
                raise InvalidCredentials(_CREDENTIALS_MESSAGE)
            db.execute("DELETE FROM sessions WHERE user_id = ?", (row["id"],))
        return {"id": row["id"], "username": row["username"]}, new_code
