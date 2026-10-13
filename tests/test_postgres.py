"""Real PostgreSQL tests; never truncate a database unless its name ends in _test."""

import os
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from foodlogger.auth import AccountExists, AuthStore, InvalidCredentials
from foodlogger.database import Database
from foodlogger.nutrition import Catalog
from foodlogger.schemas import CustomMealCreate, MealCreate
from foodlogger.storage import Journal

pytestmark = pytest.mark.postgres
DAY = date(2026, 10, 8)
PASSWORD = "correct horse battery staple"


@pytest.fixture
def database():
    dsn = os.getenv("FOODLOGGER_TEST_DATABASE_URL")
    if not dsn:
        pytest.skip("Set FOODLOGGER_TEST_DATABASE_URL to a disposable PostgreSQL database")
    psycopg = pytest.importorskip("psycopg")
    from psycopg.conninfo import conninfo_to_dict

    options = conninfo_to_dict(dsn)
    if not options.get("dbname", "").endswith("_test"):
        pytest.fail("Refusing to reset a database without the _test suffix")
    with psycopg.connect(dsn) as db:
        db.execute("DROP SCHEMA IF EXISTS foodlogger CASCADE")
        if db.execute("SELECT 1 FROM pg_roles WHERE rolname = 'foodlogger_app'").fetchone():
            db.execute(
                psycopg.sql.SQL("REVOKE CONNECT ON DATABASE {} FROM foodlogger_app").format(
                    psycopg.sql.Identifier(options["dbname"])
                )
            )
        db.execute("DROP ROLE IF EXISTS foodlogger_app")
        for role in ("anon", "authenticated", "service_role"):
            if not db.execute("SELECT 1 FROM pg_roles WHERE rolname=%s", (role,)).fetchone():
                db.execute(
                    psycopg.sql.SQL("CREATE ROLE {} NOLOGIN").format(psycopg.sql.Identifier(role))
                )
        db.execute(
            Path("supabase/migrations/20261008142103_foodlogger_private_schema.sql").read_text()
        )
        db.execute(Path("supabase/migrations/20261011194917_apple_sign_in.sql").read_text())
        for migration in sorted(Path("supabase/migrations").glob("*_p01_*.sql")):
            db.execute(migration.read_text())
        db.execute("ALTER ROLE foodlogger_app LOGIN PASSWORD 'local-test-app-password'")
        db.execute("CREATE TABLE IF NOT EXISTS public.unrelated_app (id integer)")
        db.execute("REVOKE ALL ON public.unrelated_app FROM PUBLIC")
    options.update(user="foodlogger_app", password="local-test-app-password")
    # Use a URL so the same production selection and TLS checks are exercised.
    from urllib.parse import quote

    url = (
        f"postgresql://foodlogger_app:local-test-app-password@{options['host']}:"
        f"{options.get('port', 5432)}/{quote(options['dbname'])}?sslmode=disable"
    )
    result = Database(url)
    result.check_schema()
    yield result


def test_accounts_journal_and_restart_are_private(database):
    auth, journal = AuthStore(database), Journal(database)
    alice, _ = auth.register("Alice", PASSWORD)
    bob, _ = auth.register("Bob", PASSWORD)
    entry = journal.add(
        MealCreate(food_id="banana", grams=150, day=DAY, meal_type="snack"),
        Catalog(),
        user_id=alice["id"],
    )
    assert journal.list(DAY, user_id=bob["id"]) == []
    assert journal.summary(DAY, user_id=bob["id"])["calories"] == 0
    assert not journal.delete(entry["id"], user_id=bob["id"])
    fresh = Journal(database)
    assert fresh.list(DAY, user_id=alice["id"])[0]["id"] == entry["id"]
    assert fresh.delete(entry["id"], user_id=alice["id"])
    meal = CustomMealCreate(
        name="Protein pudding",
        grams=200,
        day=DAY,
        meal_type="snack",
        nutrition={"calories": 75, "protein": 10, "carbs": 6, "fat": 1, "salt": 0.1},
        raw_nutriments={"calcium_100g": 0.2},
    )
    fresh.add_custom(meal, user_id=alice["id"])
    saved = Journal(database).list(DAY, user_id=alice["id"])[0]
    assert saved["protein"] == 20
    assert saved["details"]["raw_nutriments"]["calcium_100g"] == 0.2


def test_recovery_revokes_sessions_and_rejects_stale_login(database):
    auth = AuthStore(database)
    user, recovery = auth.register("Alice", PASSWORD)
    token, _ = auth.create_session(user["id"])
    _, old_hash = auth._authenticate_snapshot("alice", PASSWORD)
    auth.recover("Alice", recovery, "another secure password")
    assert auth.get_session(token) is None
    with pytest.raises(InvalidCredentials):
        auth.create_session(user["id"], expected_password_hash=old_hash)
    with pytest.raises(InvalidCredentials):
        auth.recover("Alice", recovery, PASSWORD)
    assert AuthStore(database).authenticate("alice", "another secure password") == user


def test_competing_registrations_have_one_winner(database):
    auth = AuthStore(database)

    def register():
        try:
            auth.register("same_user", PASSWORD)
            return "created"
        except AccountExists:
            return "duplicate"

    with ThreadPoolExecutor(2) as pool:
        assert sorted(pool.map(lambda _: register(), range(2))) == ["created", "duplicate"]


def test_transactions_rollback_and_role_is_restricted(database):
    from foodlogger.database import DatabaseUnavailable

    auth = AuthStore(database)
    user, _ = auth.register("Alice", PASSWORD)
    with pytest.raises(RuntimeError), database.connect() as db:
        db.execute("DELETE FROM users WHERE id = ?", (user["id"],))
        raise RuntimeError("rollback")
    assert auth.authenticate("alice", PASSWORD) == user
    for statement in (
        "SELECT * FROM public.unrelated_app",
        "CREATE TABLE foodlogger.forbidden(id int)",
    ):
        with pytest.raises(DatabaseUnavailable), database.connect() as db:
            db.execute(statement)


def test_http_journal_and_csv_survive_app_restart(database):
    from foodlogger.app import create_app
    from foodlogger.security import Settings

    app = create_app(db_path=database, settings=Settings())
    with TestClient(app) as alice:
        registered = alice.post(
            "/api/auth/register",
            headers={"x-foodlogger-request": "1"},
            json={"username": "alice", "password": PASSWORD},
        )
        assert registered.status_code == 201
        csrf = registered.json()["csrf_token"]
        response = alice.post(
            "/api/meals",
            headers={"x-csrf-token": csrf},
            json={"food_id": "banana", "grams": 100, "day": str(DAY), "meal_type": "snack"},
        )
        assert response.status_code == 201
        cookies = dict(alice.cookies)
    with TestClient(create_app(db_path=database, settings=Settings())) as restarted:
        restarted.cookies.update(cookies)
        assert restarted.get(f"/api/meals?day={DAY}").json()["meals"][0]["name"] == "Banana"
        assert "Banana" in restarted.get(f"/api/export?day={DAY}").text


def test_analyzed_meal_atomic_retry_and_isolation_on_postgres(database):
    from foodlogger.analysis_journal import AnalysisSaveConflict, save_analyzed
    from foodlogger.analysis_schemas import AnalyzedMealCreate
    from foodlogger.nutrition_reference import ReferenceCatalog

    auth, journal, refs = AuthStore(database), Journal(database), ReferenceCatalog()
    alice, _ = auth.register("analysis_alice", PASSWORD)
    bob, _ = auth.register("analysis_bob", PASSWORD)
    payload = AnalyzedMealCreate.model_validate(
        {
            "day": str(DAY),
            "meal_type": "lunch",
            "analysis_id": "postgres-test",
            "foods": [
                {
                    "id": "chicken",
                    "name": "Chicken",
                    "grams": 160,
                    "reference_id": "fdc:171477",
                    "confirmed": True,
                },
                {
                    "id": "rice",
                    "name": "Rice",
                    "grams": 180,
                    "reference_id": refs.search("rice white", "cooked")[0].id,
                    "confirmed": True,
                },
            ],
        }
    )

    def save():
        return save_analyzed(journal, payload, refs, alice["id"], "pg-analysis-retry-key")

    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(lambda _: save(), range(2)))
    assert sorted(created for _, created in results) == [False, True]
    assert results[0][0] == results[1][0]
    assert len(journal.list(DAY, user_id=alice["id"])) == 2
    assert journal.list(DAY, user_id=bob["id"]) == []
    payload.foods[0].grams = 100
    with pytest.raises(AnalysisSaveConflict):
        save()
    payload.foods[1].reference_id = "fdc:nonexistent"
    with pytest.raises(KeyError):
        save_analyzed(journal, payload, refs, alice["id"], "pg-invalid-recipe-key")
    assert len(journal.list(DAY, user_id=alice["id"])) == 2


def test_recovery_waiting_on_session_insertion_revokes_that_session(database, monkeypatch):
    from threading import Event

    from foodlogger.database import PostgresConnection

    auth = AuthStore(database)
    user, recovery = auth.register("alice", PASSWORD)
    locked, release, resetting = Event(), Event(), Event()
    original = PostgresConnection.execute

    def pause(self, statement, parameters=()):
        if statement.startswith("INSERT INTO sessions"):
            locked.set()
            assert release.wait(5)
        if "UPDATE users SET password_hash" in statement:
            resetting.set()
        return original(self, statement, parameters)

    monkeypatch.setattr(PostgresConnection, "execute", pause)
    with ThreadPoolExecutor(2) as pool:
        login = pool.submit(auth.authenticate_session, "alice", PASSWORD)
        try:
            assert locked.wait(5)
            reset = pool.submit(auth.recover, "alice", recovery, "a replacement password")
            assert resetting.wait(5)
        finally:
            release.set()
        _, token, _ = login.result(timeout=5)
        reset.result(timeout=5)
    assert auth.get_session(token) is None
    assert auth.authenticate("alice", "a replacement password") == user


def test_delete_account_revokes_sessions_and_erases_only_owner(database):
    auth, journal = AuthStore(database), Journal(database)
    alice, _ = auth.register("alice", PASSWORD)
    bob, _ = auth.register("bob", PASSWORD)
    token, _ = auth.create_session(alice["id"])
    other, _ = auth.create_session(bob["id"])
    meal = MealCreate(food_id="banana", grams=125.5, day=DAY, meal_type="snack")
    for user in (alice, bob):
        journal.add(meal, Catalog(), user_id=user["id"])
    auth.delete_account(alice["id"], PASSWORD)
    assert auth.get_session(token) is None
    assert auth.get_session(other)["user"] == bob
    assert journal.list(DAY, user_id=alice["id"]) == []
    assert len(journal.list(DAY, user_id=bob["id"])) == 1
    import sqlite3

    with pytest.raises(sqlite3.IntegrityError):
        journal.add(meal, Catalog(), user_id=alice["id"])


def test_apple_link_and_concurrent_first_login_preserve_private_identity(database):
    from foodlogger.apple_auth import AppleAuth

    auth = AuthStore(database)
    apple = AppleAuth(auth)
    user, _ = auth.register("apple_existing", PASSWORD)
    linked = apple.sign_in("existing-apple-subject", "encrypted-test-token", user["id"])
    assert linked["id"] == user["id"]
    assert apple.flags(linked)["apple_linked"] is True

    def sign_in():
        try:
            return apple.sign_in("concurrent-apple-subject", "encrypted-test-token")["id"]
        except AccountExists:
            return None

    with ThreadPoolExecutor(max_workers=2) as pool:
        ids = list(pool.map(lambda _: sign_in(), range(2)))
    final = apple.sign_in("concurrent-apple-subject", "encrypted-test-token")
    assert all(value is None or value == final["id"] for value in ids)
    with database.connect() as db:
        assert (
            db.execute(
                "SELECT COUNT(*) AS n FROM apple_identities WHERE subject = ?",
                ("concurrent-apple-subject",),
            ).fetchone()["n"]
            == 1
        )
        assert (
            db.execute(
                "SELECT COUNT(*) AS n FROM users WHERE username LIKE ?", ("apple_%",)
            ).fetchone()["n"]
            == 2
        )


def test_p01_foundation_preserves_legacy_rows_and_private_grants(database):
    from foodlogger.foundation import Foundation

    auth, journal = AuthStore(database), Journal(database)
    alice, _ = auth.register("foundation_alice", PASSWORD)
    bob, _ = auth.register("foundation_bob", PASSWORD)
    meal = journal.add(
        MealCreate(food_id="banana", grams=123.4, day=DAY, meal_type="snack"),
        Catalog(),
        user_id=alice["id"],
    )
    f = Foundation(database)
    assert f.available()
    assert f.backfill_batch(limit=1)["processed"] == 1
    assert f.backfill_batch(limit=1)["processed"] == 0
    assert journal.list(DAY, user_id=alice["id"]) == [meal]
    assert f.list_groups(bob["id"], str(DAY)) == []
    with database.connect() as db:
        for table in ("meal_groups", "meal_group_items", "save_receipts", "foundation_issues"):
            row = db.execute(
                "SELECT relrowsecurity FROM pg_class WHERE oid=?::regclass",
                ("foodlogger." + table,),
            ).fetchone()
            assert row["relrowsecurity"]
            for role in ("anon", "authenticated", "service_role"):
                assert not db.execute(
                    "SELECT has_table_privilege(?, ?, ?) AS allowed",
                    (role, "foodlogger." + table, "SELECT"),
                ).fetchone()["allowed"]
    auth.delete_account(alice["id"], PASSWORD)
    assert f.list_groups(alice["id"], str(DAY)) == []


def test_p01_canonical_concurrency_and_tombstones_on_postgres(database):
    from test_meal_service import DRAFT

    from foodlogger.domain import MealDraft
    from foodlogger.meal_service import MealConflict, MealService

    auth, journal = AuthStore(database), Journal(database)
    alice, _ = auth.register("canonical_alice", PASSWORD)
    service = MealService(journal)
    draft = MealDraft(**DRAFT)

    def save(_):
        return MealService(Journal(database)).create(draft, alice["id"], "postgres-100-save-key")

    with ThreadPoolExecutor(12) as pool:
        results = list(pool.map(save, range(100)))
    assert sum(created for _, created in results) == 1
    group = results[0][0]
    service.patch(group["id"], draft, alice["id"], 1, "postgres-patch-key")
    service.delete(group["id"], alice["id"], 2)
    with pytest.raises(MealConflict):
        save(0)
    assert journal.list(draft.local_date, user_id=alice["id"]) == []
    auth.delete_account(alice["id"], PASSWORD)
    with database.connect() as db:
        assert (
            db.execute(
                "SELECT COUNT(*) AS n FROM save_receipts WHERE user_id=?", (alice["id"],)
            ).fetchone()["n"]
            == 0
        )


def test_p01_ai_project_lock_budget_permissions_and_erasure(database):
    from datetime import UTC, datetime

    from foodlogger.ai_gateway import AIGateway, BudgetPolicy
    from foodlogger.vision import VisionQuotaExceeded

    auth = AuthStore(database)
    alice, _ = auth.register("quota_alice", PASSWORD)
    bob, _ = auth.register("quota_bobby", PASSWORD)
    now = datetime(2026, 10, 13, 18, tzinfo=UTC).timestamp()
    gateway = AIGateway(database, "mock-project", enabled=True, now=lambda: now)
    gateway.configure(
        BudgetPolicy(
            project_id="mock-project",
            model="gemini-3.5-flash-lite",
            enabled=True,
            verified_at=datetime.fromtimestamp(now, UTC),
            daily_limit=10,
            rpm=100,
            input_tpm=10000,
            max_input_tokens=100,
            photo_reserve=4,
            user_daily_limit=3,
            feature_daily_limits={"text": 10, "photo": 10},
        )
    )

    def reserve(i):
        owner = alice["id"] if i % 2 else bob["id"]
        try:
            return AIGateway(database, "mock-project", enabled=True, now=lambda: now).reserve(
                owner, "text", f"postgres-ai-key-{i:08}", "a" * 64, 0
            )
        except VisionQuotaExceeded:
            return None

    with ThreadPoolExecutor(12) as pool:
        results = list(pool.map(reserve, range(100)))
    assert sum(r is not None for r in results) == 6
    auth.delete_account(alice["id"], PASSWORD)
    assert gateway.summary()["used_requests"] == 6
    with database.connect() as db:
        assert (
            db.execute("SELECT COUNT(*) AS n FROM ai_attempts WHERE user_id IS NULL").fetchone()[
                "n"
            ]
            == 3
        )
        for table in ("ai_attempts", "ai_projects"):
            assert db.execute(
                "SELECT relrowsecurity FROM pg_class WHERE oid=?::regclass",
                ("foodlogger." + table,),
            ).fetchone()["relrowsecurity"]
            for role in ("anon", "authenticated", "service_role"):
                assert not db.execute(
                    "SELECT has_table_privilege(?, ?, ?) AS allowed",
                    (role, "foodlogger." + table, "SELECT"),
                ).fetchone()["allowed"]


def test_review_mixed_date_quarantine_and_erased_dispatch_on_postgres(database):
    import json
    from datetime import UTC, datetime

    from foodlogger.ai_gateway import AIGateway, BudgetPolicy
    from foodlogger.foundation import Foundation
    from foodlogger.vision import VisionUnavailable

    auth, journal = AuthStore(database), Journal(database)
    alice, _ = auth.register("review_alice", PASSWORD)
    for day in ("2026-10-12", "2026-10-13"):
        entry = journal.add(
            MealCreate(food_id="banana", grams=100, day=day, meal_type="snack"),
            Catalog(),
            user_id=alice["id"],
        )
        with database.connect() as db:
            db.execute(
                "UPDATE meals SET details=? WHERE id=?",
                (json.dumps({**entry["details"], "group_id": "a" * 32}), entry["id"]),
            )
    foundation = Foundation(database)
    assert foundation.backfill_batch(limit=1)["processed"] == 1
    assert foundation.backfill_batch(limit=1) == {"processed": 0, "quarantined": 1}
    assert not foundation.ready_for_owner(alice["id"])
    now = datetime(2026, 10, 13, 18, tzinfo=UTC).timestamp()
    gateway = AIGateway(database, "review-project", enabled=True, now=lambda: now)
    gateway.configure(
        BudgetPolicy(
            project_id="review-project",
            model="gemini-3.5-flash-lite",
            enabled=True,
            verified_at=datetime.fromtimestamp(now, UTC),
            daily_limit=10,
            rpm=10,
            input_tpm=10000,
            max_input_tokens=100,
            photo_reserve=10,
            user_daily_limit=10,
            feature_daily_limits={"photo": 10},
        )
    )
    attempt = gateway.reserve(alice["id"], "photo", "review-erasure-key", "a" * 64, 0)
    auth.delete_account(alice["id"], PASSWORD)
    with pytest.raises(VisionUnavailable):
        gateway.mark_dispatched(attempt)
    assert gateway.summary()["used_requests"] == 1
    with database.connect() as db:
        assert db.execute("SELECT COUNT(*) AS n FROM foundation_issues").fetchone()["n"] == 0
