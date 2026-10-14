"""P02 nullable/tiny data must survive storage and never masquerade as complete."""

import sqlite3
from copy import deepcopy
from datetime import date

import pytest
from fastapi.testclient import TestClient
from test_meal_service import DAY, DRAFT, PASSWORD, setup_journal

from foodlogger.app import create_app
from foodlogger.domain import MealDraft
from foodlogger.meal_service import MealService
from foodlogger.security import Settings


def partial_draft():
    data = deepcopy(DRAFT)
    data["items"][0]["portion"] = {"quantity": 0.1, "unit": "g", "normalized_g": 0.1}
    data["items"][0]["nutrition_per_100"]["protein_g"] = None
    return MealDraft(**data)


def test_partial_tiny_save_replay_and_known_totals(tmp_path):
    journal, alice, _ = setup_journal(tmp_path)
    service = MealService(journal)
    group, created = service.create(partial_draft(), alice, "partial-test-key")
    assert created
    assert service.create(partial_draft(), alice, "partial-test-key") == (group, False)
    rows = journal.list(date.fromisoformat(DAY), user_id=alice)
    assert rows[0]["grams"] == 0.1
    assert rows[0]["protein"] is None
    assert rows[0]["calories"] == 0.0014
    totals = journal.summary(date.fromisoformat(DAY), user_id=alice)
    assert totals["protein"] is None and totals["known_totals"]["protein"] == 0
    assert totals["partial"]["protein"] is True
    assert service.delete_component(rows[0]["id"], alice)


def test_versioned_day_read_blocks_legacy_and_exports_unknown_blank(tmp_path):
    with TestClient(
        create_app(tmp_path / "api.db", settings=Settings(canonical_writes=True))
    ) as client:
        account = client.post(
            "/api/auth/register",
            json={"username": "alice", "password": PASSWORD},
            headers={"X-FoodLogger-Client": "mobile", "X-FoodLogger-Request": "1"},
        ).json()
        headers = {
            "Authorization": "Bearer " + account["session_token"],
            "Idempotency-Key": "partial-http-test",
        }
        caps = client.get("/api/capabilities", headers=headers).json()
        assert caps["partial_core_writes"] and caps["tiny_portion_writes"]
        payload = {**partial_draft().model_dump(mode="json"), "confirmed": True}
        saved = client.post("/api/meal-logs", json=payload, headers=headers)
        assert saved.status_code == 201, saved.text
        old = client.get("/api/meals", params={"day": DAY}, headers=headers)
        assert old.status_code == 409
        assert "upgrade" in old.json()["detail"].lower()
        new = client.get("/api/meals", params={"day": DAY, "schema_version": 2}, headers=headers)
        assert new.status_code == 200
        assert new.json()["summary"]["protein"] is None
        assert new.json()["summary"]["partial"]["protein"] is True
        import csv
        import io

        row = next(
            csv.DictReader(
                io.StringIO(client.get("/api/export", params={"day": DAY}, headers=headers).text)
            )
        )
        assert row["protein"] == "" and row["calories"] == "0.0014"


def test_offline_sqlite_migration_preserves_rows_and_dependencies(tmp_path):
    from foodlogger.partial_migration import migrate_sqlite
    from foodlogger.storage import Journal

    journal, alice, _ = setup_journal(tmp_path)
    MealService(journal).create(MealDraft(**DRAFT), alice, "before-migration-key")
    # Reconstruct the legacy constraints to rehearse an actual existing v1 file.
    with sqlite3.connect(journal.path) as db:
        db.execute("PRAGMA writable_schema=ON")
        sql = db.execute("SELECT sql FROM sqlite_master WHERE name='meals'").fetchone()[0]
        sql = sql.replace("grams >= 0.0001", "grams >= 1")
        for key in ("calories", "protein", "carbs", "fat"):
            sql = sql.replace(f"{key} REAL", f"{key} REAL NOT NULL")
        db.execute("UPDATE sqlite_master SET sql=? WHERE name='meals'", (sql,))
        db.execute("PRAGMA writable_schema=OFF")
    before = journal.list(date.fromisoformat(DAY), user_id=alice)
    backup = tmp_path / "before.db"
    migrate_sqlite(journal.path, backup)
    assert Journal(journal.path).list(date.fromisoformat(DAY), user_id=alice) == before
    with sqlite3.connect(journal.path) as db:
        assert db.execute("PRAGMA foreign_key_check").fetchall() == []
        assert db.execute("SELECT count(*) FROM save_receipts").fetchone()[0] == 1
        assert (
            db.execute(
                "SELECT count(*) FROM sqlite_master WHERE name='meals_require_owner'"
            ).fetchone()[0]
            == 1
        )
    MealService(Journal(journal.path)).create(partial_draft(), alice, "after-migration-key")
    assert Journal(backup).list(date.fromisoformat(DAY), user_id=alice) == before
    with pytest.raises(FileExistsError):
        migrate_sqlite(journal.path, backup)


def test_label_snapshot_round_trips_optional_metadata(tmp_path):
    journal, alice, _ = setup_journal(tmp_path)
    data = partial_draft().model_dump(mode="json")
    label = {
        "barcode": "12345670",
        "brand": "Fixture",
        "quantity": "200 ml",
        "servingQuantity": 0.1,
        "sourceUrl": "https://world.openfoodfacts.org/product/12345670",
        "missingAtLookup": ["protein"],
        "notes": ["User fixture"],
        "rawNutriments": {"fiber_100g": 1.2},
    }
    data["items"][0]["label_metadata"] = label
    group, _ = MealService(journal).create(MealDraft(**data), alice, "label-round-trip")
    assert group["snapshot"]["draft"]["items"][0]["label_metadata"] == label
    assert group["snapshot"]["meals"][0]["details"]["canonical_item"]["label_metadata"] == label


def test_full_normalized_label_metadata_is_accepted(tmp_path):
    journal, alice, _ = setup_journal(tmp_path)
    data = partial_draft().model_dump(mode="json")
    metadata = {
        "barcode": "12345670",
        "brand": "b" * 300,
        "quantity": "200 ml",
        "servingQuantity": 100,
        "sourceUrl": "https://world.openfoodfacts.org/product/12345670",
        "missingAtLookup": [],
        "notes": [],
        "rawNutriments": {f"key_{i}": -2 for i in range(256)},
    }
    data["items"][0]["label_metadata"] = metadata
    data["items"][0]["source"]["brand"] = metadata["brand"]
    group, _ = MealService(journal).create(MealDraft(**data), alice, "full-label-metadata")
    assert group["snapshot"]["draft"]["items"][0]["label_metadata"] == metadata


def test_canonical_day_row_exposes_confirmed_consumption_time(tmp_path):
    journal, alice, _ = setup_journal(tmp_path)
    data = partial_draft().model_dump(mode="json")
    data.update(occurred_at="2026-10-13T08:30:00+03:00", timezone_id="Asia/Jerusalem")
    MealService(journal).create(MealDraft(**data), alice, "consumption-time")
    row = journal.list(date.fromisoformat(DAY), user_id=alice)[0]
    assert row["details"]["occurred_at"] == data["occurred_at"]
    assert row["details"]["timezone_id"] == data["timezone_id"]


def test_exact_minimum_portion_is_inclusive(tmp_path):
    journal, alice, _ = setup_journal(tmp_path)
    data = partial_draft().model_dump(mode="json")
    data["items"][0]["portion"] = {"quantity": 0.0001, "unit": "g", "normalized_g": 0.0001}
    group, _ = MealService(journal).create(MealDraft(**data), alice, "minimum-portion-key")
    assert group["snapshot"]["meals"][0]["grams"] == 0.0001
