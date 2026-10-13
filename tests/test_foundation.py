"""Additive migration/backfill on disposable SQLite; original snapshots never change."""

import json
import sqlite3
from datetime import date

import pytest

from foodlogger.auth import AuthStore
from foodlogger.nutrition import Catalog
from foodlogger.schemas import MealCreate
from foodlogger.storage import Journal

PASSWORD = "local-test-password-2026"


def seed(tmp_path):
    journal = Journal(tmp_path / "journal.db")
    auth = AuthStore(journal.database)
    alice, _ = auth.register("alice", PASSWORD)
    bob, _ = auth.register("bob", PASSWORD)
    entry = journal.add(
        MealCreate(food_id="banana", grams=123.4, day="2026-10-12", meal_type="snack"),
        Catalog(),
        user_id=alice["id"],
    )
    return journal, auth, alice, bob, entry


def test_resumable_additive_backfill_preserves_original_rows_and_legacy_days(tmp_path):
    from foodlogger.foundation import Foundation

    journal, auth, alice, bob, entry = seed(tmp_path)
    f = Foundation(journal.database)
    before = journal.list(date(2026, 10, 12), user_id=alice["id"])
    assert f.available()
    first = f.backfill_batch(limit=1)
    assert first["processed"] == 1
    restarted = Foundation(journal.database)
    assert restarted.backfill_batch(limit=1)["processed"] == 0
    assert journal.list(date(2026, 10, 12), user_id=alice["id"]) == before
    groups = restarted.list_groups(alice["id"], "2026-10-12")
    assert len(groups) == 1
    assert groups[0]["occurred_at"] is None and groups[0]["timezone_id"] is None
    assert groups[0]["snapshot"]["meals"] == before
    assert restarted.list_groups(bob["id"], "2026-10-12") == []
    auth.delete_account(alice["id"], PASSWORD)
    assert restarted.list_groups(alice["id"], "2026-10-12") == []


def test_failed_batch_rolls_back_and_resume_does_not_rewrite_nutrition(tmp_path, monkeypatch):
    from foodlogger.foundation import Foundation

    journal, _, alice, _, _ = seed(tmp_path)
    f = Foundation(journal.database)
    real = f.record_group

    def fail(*args, **kwargs):
        real(*args, **kwargs)
        raise RuntimeError("simulated crash")

    monkeypatch.setattr(f, "record_group", fail)
    with pytest.raises(RuntimeError):
        f.backfill_batch()
    assert f.list_groups(alice["id"], "2026-10-12") == []
    monkeypatch.setattr(f, "record_group", real)
    assert f.backfill_batch()["processed"] == 1
    assert f.list_groups(alice["id"], "2026-10-12")[0]["snapshot"]["meals"][0]["grams"] == 123.4


def test_owner_constraints_and_original_schema_constraints_remain(tmp_path):
    from foodlogger.foundation import Foundation

    journal, _, alice, bob, entry = seed(tmp_path)
    f = Foundation(journal.database)
    f.backfill_batch()
    group = f.list_groups(alice["id"], "2026-10-12")[0]
    with pytest.raises(sqlite3.IntegrityError), journal.connect() as db:
        db.execute(
            "INSERT INTO meal_group_items (entry_id,user_id,group_id) VALUES (?,?,?)",
            ("other", bob["id"], group["id"]),
        )
    with pytest.raises(sqlite3.IntegrityError), journal.connect() as db:
        db.execute("UPDATE meals SET calories=NULL WHERE id=?", (entry["id"],))
    with journal.connect() as db:
        assert db.execute("SELECT COUNT(*) AS n FROM foundation_migrations").fetchone()["n"] == 1
        assert (
            json.loads(db.execute("SELECT snapshot FROM meal_groups").fetchone()["snapshot"])[
                "schema_version"
            ]
            == "legacy-v1"
        )
