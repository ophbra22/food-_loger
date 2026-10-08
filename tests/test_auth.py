import sqlite3

import pytest
from argon2 import PasswordHasher, Type, extract_parameters


def test_register_normalizes_username_and_authenticates_without_changing_password(tmp_path):
    from foodlogger.auth import AuthStore

    path = tmp_path / "journal.sqlite3"
    store = AuthStore(path)
    password = "  My Mixed Case Secret  "
    user, recovery_code = store.register("  Alice_123-Test  ", password)

    assert set(user) == {"id", "username"}
    assert user["id"]
    assert user["username"] == "alice_123-test"
    assert len(recovery_code) >= 32
    assert AuthStore(path).authenticate("ALICE_123-TEST", password) == user


def test_registration_rejects_duplicate_case_normalized_username(tmp_path):
    from foodlogger.auth import AccountExists, AuthStore

    store = AuthStore(tmp_path / "journal.sqlite3")
    original, _ = store.register("Alice", "correct horse battery staple")
    with pytest.raises(AccountExists):
        store.register("  ALICE  ", "different secure password")
    assert store.authenticate("alice", "correct horse battery staple") == original


@pytest.mark.parametrize("username", ["", "ab", "a" * 33, "a b", "a'b", "álîce", "Kevin", None])
def test_registration_validates_username_in_domain(tmp_path, username):
    from foodlogger.auth import AuthStore, InvalidAccountInput

    store = AuthStore(tmp_path / "journal.sqlite3")
    with pytest.raises(InvalidAccountInput):
        store.register(username, "correct horse battery staple")


@pytest.mark.parametrize("password", ["", "x" * 11, "x" * 129, "\ud800" * 12, None])
def test_registration_validates_password_in_domain(tmp_path, password):
    from foodlogger.auth import AuthStore, InvalidAccountInput

    store = AuthStore(tmp_path / "journal.sqlite3")
    with pytest.raises(InvalidAccountInput):
        store.register("alice", password)


def test_passwords_are_salted_argon2id_hashes_and_recovery_is_not_plaintext(tmp_path):
    from foodlogger.auth import AuthStore

    path = tmp_path / "journal.sqlite3"
    store = AuthStore(path)
    password = "correct horse battery staple"
    _, first_code = store.register("alice", password)
    _, second_code = store.register("bob", password)
    with sqlite3.connect(path) as db:
        rows = db.execute("SELECT password_hash, recovery_hash FROM users").fetchall()
        contents = " ".join(db.iterdump())

    assert rows[0][0] != rows[1][0]
    assert first_code != second_code
    assert password not in contents
    assert first_code not in contents
    assert second_code not in contents
    for password_hash, recovery_hash in rows:
        assert PasswordHasher().verify(password_hash, password)
        parameters = extract_parameters(password_hash)
        assert parameters.type == Type.ID
        assert parameters.memory_cost >= 19456
        assert parameters.time_cost >= 2
        assert parameters.parallelism == 1
        assert len(recovery_hash) == 64


def test_authentication_has_generic_failure_for_unknown_invalid_and_wrong_credentials(tmp_path):
    from foodlogger.auth import AuthStore, InvalidCredentials

    store = AuthStore(tmp_path / "journal.sqlite3")
    password = "  My Mixed Case Secret  "
    store.register("alice", password)
    messages = []
    for username, wrong_password in [
        ("alice", "incorrect but long password"),
        ("unknown", password),
        ("' OR 1=1 --", password),
        ("alice", password.strip()),
        ("alice", password.lower()),
        ("alice", "short"),
        (None, password),
        ("alice", None),
    ]:
        with pytest.raises(InvalidCredentials) as error:
            store.authenticate(username, wrong_password)
        messages.append(str(error.value))
    assert len(set(messages)) == 1
    assert "alice" not in messages[0]
    assert password not in messages[0]


def test_sessions_are_opaque_persistent_and_stored_only_as_token_hashes(tmp_path, monkeypatch):
    from foodlogger import auth

    path = tmp_path / "journal.sqlite3"
    store = auth.AuthStore(path)
    user, _ = store.register("alice", "correct horse battery staple")
    monkeypatch.setattr(auth.time, "time", lambda: 1000000)
    token, csrf = store.create_session(user["id"])
    other_token, other_csrf = store.create_session(user["id"])

    assert len(token) >= 43
    assert len(csrf) >= 43
    assert token != other_token
    assert csrf != other_csrf
    assert csrf != token
    assert auth.AuthStore(path).get_session(token) == {
        "user": user,
        "csrf_token": csrf,
        "expires_at": 1000000 + store.SESSION_TTL_SECONDS,
    }
    with sqlite3.connect(path) as db:
        contents = " ".join(db.iterdump())
        hashes = db.execute("SELECT token_hash FROM sessions").fetchall()
    assert token not in contents
    assert other_token not in contents
    assert all(len(row[0]) == 64 for row in hashes)


def test_session_expires_at_exact_deadline(tmp_path, monkeypatch):
    from foodlogger import auth

    store = auth.AuthStore(tmp_path / "journal.sqlite3")
    user, _ = store.register("alice", "correct horse battery staple")
    now = 1000000
    monkeypatch.setattr(auth.time, "time", lambda: now)
    token, _ = store.create_session(user["id"])
    now += store.SESSION_TTL_SECONDS - 1
    assert store.get_session(token) is not None
    now += 1
    assert store.get_session(token) is None


def test_revoking_session_does_not_revoke_other_sessions(tmp_path):
    from foodlogger.auth import AuthStore

    store = AuthStore(tmp_path / "journal.sqlite3")
    user, _ = store.register("alice", "correct horse battery staple")
    token, _ = store.create_session(user["id"])
    other_token, _ = store.create_session(user["id"])
    store.revoke_session(token)
    store.revoke_session(token)
    assert store.get_session(token) is None
    assert store.get_session(other_token)["user"] == user


@pytest.mark.parametrize(
    "token",
    [None, "", "x" * 10000, "' OR 1=1 --", "é" * 43],
    ids=["missing", "empty", "oversized", "sql-injection", "non-ascii"],
)
def test_invalid_session_token_is_rejected(tmp_path, token):
    from foodlogger.auth import AuthStore

    store = AuthStore(tmp_path / "journal.sqlite3")
    assert store.get_session(token) is None
    store.revoke_session(token)


def test_sessions_enforce_foreign_keys(tmp_path):
    from foodlogger.auth import AuthStore

    store = AuthStore(tmp_path / "journal.sqlite3")
    with pytest.raises(sqlite3.IntegrityError):
        store.create_session("unknown-user")
    user, _ = store.register("alice", "correct horse battery staple")
    token, _ = store.create_session(user["id"])
    with store.connect() as db:
        db.execute("DELETE FROM users WHERE id = ?", (user["id"],))
        assert db.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 0
    assert store.get_session(token) is None


def test_recovery_rotates_code_and_password_and_revokes_all_own_sessions(tmp_path):
    from foodlogger.auth import AuthStore, InvalidCredentials

    store = AuthStore(tmp_path / "journal.sqlite3")
    old_password = "correct horse battery staple"
    new_password = "new stronger mixed CASE password"
    user, recovery_code = store.register("alice", old_password)
    other_user, _ = store.register("bob", old_password)
    token, _ = store.create_session(user["id"])
    second_token, _ = store.create_session(user["id"])
    other_user_token, _ = store.create_session(other_user["id"])

    recovered_user, new_code = store.recover("  ALICE  ", recovery_code, new_password)

    assert recovered_user == user
    assert new_code != recovery_code
    assert len(new_code) >= 43
    assert store.get_session(token) is None
    assert store.get_session(second_token) is None
    assert store.get_session(other_user_token)["user"] == other_user
    assert store.authenticate("alice", new_password) == user
    with pytest.raises(InvalidCredentials):
        store.authenticate("alice", old_password)
    with pytest.raises(InvalidCredentials):
        store.recover("alice", recovery_code, old_password)
    assert store.recover("alice", new_code, old_password)[0] == user


def test_invalid_recovery_does_not_change_password_code_or_sessions(tmp_path):
    from foodlogger.auth import AuthStore, InvalidAccountInput, InvalidCredentials

    store = AuthStore(tmp_path / "journal.sqlite3")
    password = "correct horse battery staple"
    user, code = store.register("alice", password)
    _, other_code = store.register("bob", password)
    token, _ = store.create_session(user["id"])
    messages = []
    for username, invalid_code in [
        ("alice", "wrong"),
        ("unknown", code),
        ("alice", other_code),
        ("' OR 1=1 --", code),
        ("alice", None),
        ("alice", "é" * 43),
        ("alice", "x" * 10000),
    ]:
        with pytest.raises(InvalidCredentials) as error:
            store.recover(username, invalid_code, "another strong password")
        messages.append(str(error.value))
    assert len(set(messages)) == 1
    with pytest.raises(InvalidAccountInput):
        store.recover("alice", code, "short")
    assert store.get_session(token)["user"] == user
    assert store.authenticate("alice", password) == user
    assert store.recover("alice", code, "another strong password")[0] == user


def test_failed_recovery_transaction_preserves_credentials_and_sessions(tmp_path):
    from foodlogger.auth import AuthStore

    store = AuthStore(tmp_path / "journal.sqlite3")
    password = "correct horse battery staple"
    user, code = store.register("alice", password)
    token, _ = store.create_session(user["id"])
    with store.connect() as db:
        db.execute("""
            CREATE TRIGGER fail_revoke BEFORE DELETE ON sessions
            BEGIN SELECT RAISE(ABORT, 'test failure'); END
        """)
    with pytest.raises(sqlite3.IntegrityError):
        store.recover("alice", code, "another strong password")
    assert store.authenticate("alice", password) == user
    assert store.get_session(token)["user"] == user
    with store.connect() as db:
        db.execute("DROP TRIGGER fail_revoke")
    assert store.recover("alice", code, "another strong password")[0] == user


def test_recovery_blocks_inflight_old_password_login(tmp_path, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event

    import foodlogger.auth as module

    store = module.AuthStore(tmp_path / "race.sqlite3")
    _, code = store.register("alice", "the-old-password-123")
    verified, release = Event(), Event()
    original_verify = module._verify_password

    def paused_verify(password_hash, password):
        valid = original_verify(password_hash, password)
        verified.set()
        assert release.wait(timeout=5)
        return valid

    monkeypatch.setattr(module, "_verify_password", paused_verify)
    with ThreadPoolExecutor() as executor:
        future = executor.submit(store.authenticate_session, "alice", "the-old-password-123")
        try:
            assert verified.wait(timeout=5)
            store.recover("alice", code, "the-new-password-456")
        finally:
            release.set()
        with pytest.raises(module.InvalidCredentials):
            future.result(timeout=5)
    monkeypatch.setattr(module, "_verify_password", original_verify)
    user, token, _ = store.authenticate_session("alice", "the-new-password-456")
    assert store.get_session(token)["user"] == user
