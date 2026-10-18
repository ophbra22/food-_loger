"""P13 privacy export and erasure against real disposable storage, no provider calls."""

import pytest
from fastapi.testclient import TestClient

from foodlogger.app import create_app
from foodlogger.security import Settings

PASSWORD = "local-fixture-password"


def seed_private_data(database, owner):
    # Independent SQL fixtures cover every account-owned table, including tombstones.
    rows = {
        "meals": dict(
            id=owner + "-meal",
            day="2026-10-13",
            meal_type="lunch",
            food_id="banana",
            name="Private meal " + owner,
            emoji="",
            grams=150,
            calories=133.5,
            protein=1.6,
            carbs=34.2,
            fat=0.5,
            created_at="2026-10-13T12:00:00Z",
            details="{}",
        ),
        "meal_groups": dict(
            id="group", local_date="2026-10-13", version=1, snapshot='{"private":"meal"}'
        ),
        "meal_group_items": dict(entry_id=owner + "-meal", group_id="group"),
        "save_receipts": dict(
            request_hash="receipt",
            digest="private-digest",
            operation="create",
            group_id="group",
            result_ids="[]",
            status="active",
            created_at="now",
        ),
        "foundation_issues": dict(
            entry_id=owner + "-meal", reason="invalid_metadata", created_at="now"
        ),
        "user_nutrition_goal_revisions": dict(
            id="goal",
            version=1,
            effective_local_date="2026-10-13",
            created_at="now",
            calorie_target=2300,
            protein_g=150,
            calorie_min_percent=90,
            calorie_max_percent=110,
        ),
        "tracking_entries": dict(
            id="water",
            kind="water",
            value=500,
            occurred_at="2026-10-13T12:00:00Z",
            local_date="2026-10-13",
            timezone_id="UTC",
            source="manual",
            version=1,
            deleted=0,
            created_at="now",
            updated_at="now",
        ),
        "tracking_receipts": dict(
            request_key="tracking-request", request_hash="private-digest", entry_id="water"
        ),
        "library_favorites": dict(kind="meal", source_id="group", created_at="now"),
        "recipe_headers": dict(id="recipe", current_version=1, created_at="now", updated_at="now"),
        "recipe_versions": dict(
            recipe_id="recipe", version=1, name="Private recipe", servings=2, created_at="now"
        ),
        "recipe_items": dict(recipe_id="recipe", version=1, position=0, item='{"name":"tahini"}'),
        "library_requests": dict(
            request_hash="request",
            digest="private-digest",
            operation="create",
            result="{}",
            created_at="now",
        ),
        "recommendation_preferences": dict(version=1, body='{"allergens":["sesame"]}'),
        "recommendation_source_reviews": dict(
            kind="meal", source_id="group", source_revision="1", version=1, body="{}"
        ),
        "reminder_preferences": dict(version=1, body="{}"),
        "reminder_attempts": dict(local_date="2026-10-13", category="lunch", attempted_at=1),
        "private_products": dict(
            id="product", current_version=1, created_at="now", updated_at="now"
        ),
        "private_product_versions": dict(
            product_id="product", version=1, item='{"name":"private tahini"}', created_at="now"
        ),
        "private_product_requests": dict(
            request_hash="request", digest="private-digest", result="{}"
        ),
        "label_cache": dict(
            fingerprint="private-image-fingerprint",
            payload='{"name":"private label"}',
            created_at=1,
            expires_at=2,
        ),
        "health_scopes": dict(scope=owner + "-scope"),
        "health_exports": dict(
            record_key="water", sample_id=owner + "-sample", revision=1, payload="{}"
        ),
        "health_imports": dict(
            external_id="external-weight", payload='{"value":70}', created_at="now"
        ),
        "health_connect_imports": dict(external_id="external-deleted", deleted=1, updated_at="now"),
        "apple_identities": dict(
            subject=owner + "-apple", refresh_token="secret-apple-refresh", has_password=1
        ),
        "apple_challenges": dict(
            id=owner + "-challenge",
            nonce="secret-nonce",
            purpose="delete",
            session_hash="private-session",
            expires_at=1,
        ),
    }
    with database.connect() as db:
        session = db.execute("SELECT token_hash FROM sessions WHERE user_id=?", (owner,)).fetchone()
        rows["reminder_devices"] = dict(
            token=owner + "-secret-push-token",
            installation_hash=owner + "-installation",
            installation_generation=1,
            session_hash=session["token_hash"],
            platform="ios",
            ready=1,
            checked_at=1,
        )
        db.execute(
            "INSERT INTO ai_projects(id,policy,revision) VALUES ('privacy-test','{}',1) "
            "ON CONFLICT(id) DO NOTHING"
        )
        rows["ai_attempts"] = dict(
            id=owner + "-attempt",
            project_id="privacy-test",
            request_hash=owner + "-private-request",
            payload_digest="private-digest",
            policy_hash="private-policy",
            attempt=0,
            feature="photo",
            provider="mock",
            model="mock",
            provider_day="2026-10-13",
            started_at=1,
            reserved_tokens=100,
            state="consumed",
        )
        for table, data in rows.items():
            data = {"user_id": owner, **data}
            db.execute(
                f"INSERT INTO {table} ({','.join(data)}) VALUES ({','.join('?' for _ in data)})",
                tuple(data.values()),
            )
    return set(rows)


@pytest.fixture
def privacy_client(tmp_path):
    app = create_app(tmp_path / "privacy.sqlite3", settings=Settings(ai_enabled=False))
    with TestClient(app) as client:
        users = []
        for name in ("alice", "bobby"):
            body = client.post(
                "/api/auth/register",
                json={"username": name, "password": PASSWORD},
                headers={"X-Foodlogger-Request": "1", "X-Foodlogger-Client": "mobile"},
            ).json()
            users.append(
                (
                    body["user"]["id"],
                    {
                        "Authorization": "Bearer " + body["session_token"],
                        "X-Foodlogger-Request": "1",
                    },
                    body,
                )
            )
        client.cookies.clear()
        yield client, app.state.auth.database, users


def test_archive_covers_account_data_without_cross_owner_or_credentials(privacy_client):
    client, database, users = privacy_client
    for owner, _, _ in users:
        seed_private_data(database, owner)
    owner, headers, credentials = users[0]
    response = client.get("/api/account/export?user_id=" + users[1][0], headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["schema_version"] == 1
    assert body["account"] == {"id": owner, "username": "alice"}
    assert body["data"]["meals"][0]["calories"] == 133.5
    assert body["data"]["tracking_entries"][0]["value"] == 500
    assert body["data"]["recipe_versions"][0]["servings"] == 2
    assert body["data"]["health_connect_imports"][0]["deleted"] == 1
    assert body["data"]["label_cache"][0]["expires_at"] == 2
    assert body["data"]["recommendation_preferences"][0]["body"] == '{"allergens":["sesame"]}'
    assert all(len(rows) == 1 for rows in body["data"].values())
    for secret in (
        users[1][0],
        credentials["session_token"],
        credentials["recovery_code"],
        "secret-apple-refresh",
        "secret-push-token",
        "secret-nonce",
        "private-digest",
        "private-image-fingerprint",
    ):
        assert secret not in response.text
    assert response.headers["cache-control"] == "no-store"
    assert 'attachment; filename="biteflow-account.json"' == response.headers["content-disposition"]
    assert "sessions" in body["exclusions"] and "apple_challenges" in body["exclusions"]


def test_archive_requires_auth_and_preserves_day_csv(privacy_client):
    client, _, users = privacy_client
    assert client.get("/api/account/export").status_code == 401
    assert client.get("/api/export?day=2026-10-13", headers=users[0][1]).status_code == 200


def test_archive_inventory_requires_explicit_table_classification(privacy_client):
    from foodlogger.privacy import EXCLUDED_TABLES, EXPORT_COLUMNS

    _, database, _ = privacy_client
    with database.connect() as db:
        tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert tables == set(EXPORT_COLUMNS) | set(EXCLUDED_TABLES) | {"users"}


def test_archive_does_not_silently_truncate(privacy_client, monkeypatch):
    from foodlogger import privacy

    client, database, users = privacy_client
    seed_private_data(database, users[0][0])
    monkeypatch.setattr(privacy, "MAX_ROWS", 1)
    assert client.get("/api/account/export", headers=users[0][1]).status_code == 413
    monkeypatch.setattr(privacy, "MAX_ROWS", 50000)
    monkeypatch.setattr(privacy, "MAX_BYTES", 100)
    assert client.get("/api/account/export", headers=users[0][1]).status_code == 413


def test_deletion_erases_owned_rows_preserves_other_owner_and_quota_counts(privacy_client):
    client, database, users = privacy_client
    tables = seed_private_data(database, users[0][0])
    seed_private_data(database, users[1][0])
    auth = client.app.state.auth

    def fail(db, owner):
        db.execute("DELETE FROM tracking_entries WHERE user_id=?", (owner,))
        raise RuntimeError("fixture rollback")

    with pytest.raises(RuntimeError, match="fixture rollback"):
        auth.delete_account(users[0][0], PASSWORD, before_delete=fail)
    with database.connect() as db:
        assert (
            db.execute(
                "SELECT COUNT(*) n FROM tracking_entries WHERE user_id=?", (users[0][0],)
            ).fetchone()["n"]
            == 1
        )
    auth.delete_account(
        users[0][0], PASSWORD
    )  # Apple provider revocation is tested separately with mocks.
    with database.connect() as db:
        for table in tables | {"users", "sessions"}:
            column = "id" if table == "users" else "user_id"
            assert (
                db.execute(
                    f"SELECT COUNT(*) n FROM {table} WHERE {column}=?", (users[0][0],)
                ).fetchone()["n"]
                == 0
            ), table
            assert (
                db.execute(
                    f"SELECT COUNT(*) n FROM {table} WHERE {column}=?", (users[1][0],)
                ).fetchone()["n"]
                == 1
            ), table
        assert (
            db.execute("SELECT COUNT(*) n FROM ai_attempts WHERE user_id IS NULL").fetchone()["n"]
            == 1
        )


def test_archive_rate_limit_and_missing_account(privacy_client):
    from foodlogger.privacy import account_archive

    client, database, users = privacy_client
    for _ in range(3):
        assert client.get("/api/account/export", headers=users[0][1]).status_code == 200
    assert client.get("/api/account/export", headers=users[0][1]).status_code == 429
    with pytest.raises(LookupError):
        account_archive(database, "missing-owner")


@pytest.mark.parametrize("archive_disabled", [False, True])
def test_prediction_failure_never_logs_or_returns_raw_internal_error(
    tmp_path, caplog, monkeypatch, archive_disabled
):
    from io import BytesIO

    from PIL import Image

    from foodlogger.classifier import ModelUnavailable

    class BrokenClassifier:
        name = "mock"

        def predict(self, image):
            try:
                raise ValueError("private-diet-secret internal token fixture")
            except ValueError as cause:
                raise ModelUnavailable("private-diet-secret unavailable") from cause

    monkeypatch.setenv("FOODLOGGER_ACCOUNT_EXPORT_DISABLED", "1" if archive_disabled else "0")
    app = create_app(
        tmp_path / "logs.sqlite3",
        classifier=BrokenClassifier(),
        settings=Settings.from_environment(),
    )
    with TestClient(app) as client:
        account = client.post(
            "/api/auth/register",
            headers={"X-FoodLogger-Request": "1", "X-FoodLogger-Client": "mobile"},
            json={"username": "alice", "password": PASSWORD},
        ).json()
        image = BytesIO()
        Image.new("RGB", (2, 2)).save(image, format="PNG")
        response = client.post(
            "/api/predict",
            headers={"Authorization": "Bearer " + account["session_token"]},
            files={"file": ("test.png", image.getvalue(), "image/png")},
        )
        assert response.status_code == 503
        assert "private-diet-secret" not in response.text
        assert "private-diet-secret" not in caplog.text
        assert "Classifier unavailable" in caplog.text


@pytest.mark.parametrize(
    "value, expected", [(None, 200), ("0", 200), ("false", 200), ("1", 503), ("true", 503)]
)
def test_account_export_stop_switch_preserves_auth_csv_and_owner_data(
    privacy_client, monkeypatch, value, expected
):
    from foodlogger import privacy

    _, database, users = privacy_client
    seed_private_data(database, users[0][0])
    if value is None:
        monkeypatch.delenv("FOODLOGGER_ACCOUNT_EXPORT_DISABLED", raising=False)
    else:
        monkeypatch.setenv("FOODLOGGER_ACCOUNT_EXPORT_DISABLED", value)
    archive_reads = []
    original = privacy.account_archive

    def measured(*args):
        archive_reads.append(True)
        return original(*args)

    monkeypatch.setattr(privacy, "account_archive", measured)
    with TestClient(create_app(database, settings=Settings.from_environment())) as client:
        assert client.get("/api/account/export").status_code == 401
        response = client.get("/api/account/export", headers=users[0][1])
        assert response.status_code == expected
        assert len(archive_reads) == (1 if expected == 200 else 0)
        csv = client.get("/api/export?day=2026-10-13", headers=users[0][1])
        assert csv.status_code == 200 and "Private meal" in csv.text
    # Switching off is reversible; it does not erase or migrate account data.
    assert original(database, users[0][0])["data"]["meals"][0]["calories"] == 133.5


def test_account_export_stop_switch_rejects_invalid_configuration(monkeypatch):
    monkeypatch.setenv("FOODLOGGER_ACCOUNT_EXPORT_DISABLED", "maybe")
    with pytest.raises(RuntimeError, match="FOODLOGGER_ACCOUNT_EXPORT_DISABLED"):
        Settings.from_environment()


def test_oversized_archive_stops_reading_before_materializing_large_account(
    privacy_client, monkeypatch
):
    from contextlib import contextmanager
    from datetime import date

    from foodlogger import privacy
    from foodlogger.schemas import CustomMealCreate
    from foodlogger.storage import Journal

    _, database, users = privacy_client
    owner = users[0][0]
    meal = CustomMealCreate(
        name="Valid large metadata",
        grams=100,
        day=date(2026, 10, 18),
        meal_type="lunch",
        nutrition=dict(calories=100, protein=1, carbs=2, fat=3),
        raw_nutriments={f"n{i}": "x" * 120 for i in range(256)},
    )
    journal = Journal(database)
    entry = journal.prepare_custom(meal, user_id=owner)
    with database.connect() as db:
        for i in range(100):
            journal.insert_into(db, {**entry, "id": f"large-{i:03}"}, owner)
    read_rows = []
    original = database.connect

    class Rows:
        def __init__(self, cursor):
            self.cursor = cursor

        def fetchall(self):
            rows = self.cursor.fetchall()
            read_rows.append(len(rows))
            return rows

    class Connection:
        def __init__(self, connection):
            self.connection = connection

        def execute(self, sql, parameters=()):
            cursor = self.connection.execute(sql, parameters)
            return Rows(cursor) if "FROM meals WHERE" in sql else cursor

    @contextmanager
    def measured():
        with original() as db:
            yield Connection(db)

    monkeypatch.setattr(database, "connect", measured)
    monkeypatch.setattr(privacy, "MAX_BYTES", 100_000)
    with pytest.raises(privacy.ArchiveTooLarge):
        privacy.account_archive(database, owner)
    assert sum(read_rows) <= 64, "Oversized archive fetched the whole account before rejecting it"


def test_archive_pages_preserve_all_rows_and_total_row_limit(privacy_client, monkeypatch):
    from foodlogger import privacy

    _, database, users = privacy_client
    owner = users[0][0]
    seed_private_data(database, owner)
    with database.connect() as db:
        for i in range(8):
            db.execute(
                "INSERT INTO meals SELECT ?,day,meal_type,food_id,name,emoji,grams,calories,"
                "protein,carbs,fat,created_at,user_id,details FROM meals WHERE id=?",
                (f"page-{i}", owner + "-meal"),
            )
    monkeypatch.setattr(privacy, "PAGE_ROWS", 2, raising=False)
    result = privacy.account_archive(database, owner)
    assert {r["id"] for r in result["data"]["meals"]} == {owner + "-meal"} | {
        f"page-{i}" for i in range(8)
    }
    monkeypatch.setattr(privacy, "MAX_ROWS", 8)
    with pytest.raises(privacy.ArchiveTooLarge):
        privacy.account_archive(database, owner)
