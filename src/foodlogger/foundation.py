"""Additive journal metadata; no implicit PostgreSQL DDL or historical recalculation."""

import json
import re
from datetime import UTC, datetime
from pathlib import Path

from foodlogger.storage import _entry_id

MIGRATION = "p01-journal-v1"
SCHEMA = Path(__file__).parent / "data" / "foundation.sql"


def lock_owner(database, db, user_id):
    """One lock order for save, edit, delete, backfill and account erasure."""
    if not database.postgres:
        db.execute("BEGIN IMMEDIATE")
    row = db.execute(
        "SELECT id FROM users WHERE id = ?" + (" FOR UPDATE" if database.postgres else ""),
        (user_id,),
    ).fetchone()
    if row is None:
        import sqlite3

        raise sqlite3.IntegrityError("Account no longer exists.")


def ensure_sqlite_foundation(database):
    if database.postgres:
        return
    with database.connect() as db:
        if not db.execute("SELECT 1 FROM sqlite_master WHERE name='meals'").fetchone():
            return
        for statement in SCHEMA.read_text().split(";"):
            if statement.strip():
                db.execute(statement)
        db.execute(
            "INSERT INTO foundation_migrations(name,applied_at) VALUES (?,?) "
            "ON CONFLICT(name) DO NOTHING",
            (MIGRATION, datetime.now(UTC).isoformat()),
        )
        for statement in (Path(__file__).parent / "data" / "ai_gateway.sql").read_text().split(";"):
            if statement.strip():
                db.execute(statement)
        db.execute(
            "INSERT INTO foundation_migrations(name,applied_at) VALUES (?,?) "
            "ON CONFLICT(name) DO NOTHING",
            ("p01-ai-v1", datetime.now(UTC).isoformat()),
        )


class Foundation:
    def __init__(self, database):
        self.database = database

    def available(self):
        with self.database.connect() as db:
            if self.database.postgres:
                exists = db.execute(
                    "SELECT to_regclass('foodlogger.foundation_migrations') AS name"
                ).fetchone()["name"]
            else:
                exists = db.execute(
                    "SELECT 1 FROM sqlite_master WHERE name='foundation_migrations'"
                ).fetchone()
            return bool(
                exists
                and db.execute(
                    "SELECT 1 FROM foundation_migrations WHERE name=?", (MIGRATION,)
                ).fetchone()
            )

    def ready_for_owner(self, user_id):
        if not self.available():
            return False
        with self.database.connect() as db:
            return not db.execute(
                "SELECT 1 FROM meals m WHERE m.user_id=? AND NOT EXISTS "
                "(SELECT 1 FROM meal_group_items i WHERE i.entry_id=m.id "
                "AND i.user_id=m.user_id) LIMIT 1",
                (user_id,),
            ).fetchone()

    def record_group(
        self, db, user_id, group_id, entries, *, snapshot=None, occurred_at=None, timezone_id=None
    ):
        now = datetime.now(UTC).isoformat()
        old = db.execute(
            "SELECT snapshot FROM meal_groups WHERE user_id=? AND id=?", (user_id, group_id)
        ).fetchone()
        if old:
            saved = json.loads(old["snapshot"])
            known = {row["id"] for row in saved.get("meals", [])}
            saved.setdefault("meals", []).extend(row for row in entries if row["id"] not in known)
            db.execute(
                "UPDATE meal_groups SET snapshot=? WHERE user_id=? AND id=?",
                (json.dumps(saved, ensure_ascii=False), user_id, group_id),
            )
        else:
            saved = snapshot or {
                "schema_version": "legacy-v1",
                "calculation_version": "historical",
                "warnings": ["legacy_time_unknown", "historical_totals_preserved"],
                "meals": entries,
            }
            db.execute(
                "INSERT INTO meal_groups(user_id,id,local_date,occurred_at,timezone_id,snapshot) "
                "VALUES (?,?,?,?,?,?)",
                (
                    user_id,
                    group_id,
                    entries[0]["day"],
                    occurred_at,
                    timezone_id,
                    json.dumps(saved, ensure_ascii=False),
                ),
            )
        for entry in entries:
            db.execute(
                "INSERT INTO meal_group_items(entry_id,user_id,group_id) VALUES (?,?,?) "
                "ON CONFLICT(entry_id) DO NOTHING",
                (entry["id"], user_id, group_id),
            )
        return now

    def backfill_batch(self, limit=100):
        """Retryable bounded batch over unmapped rows; interrupted transactions leave no progress.

        Old anonymous rows remain private and are deliberately not attached to a real user.
        Re-scanning unmapped rows also handles concurrent old writers without a lost cursor.
        """
        from foodlogger.storage import Journal

        if not 1 <= limit <= 1000:
            raise ValueError("Batch limit must be 1–1000.")
        processed = 0
        with self.database.connect() as db:
            if not self.database.postgres:
                db.execute("BEGIN IMMEDIATE")
            rows = db.execute(
                "SELECT m.* FROM meals m JOIN users u ON u.id=m.user_id "
                "WHERE NOT EXISTS (SELECT 1 FROM meal_group_items i "
                "WHERE i.entry_id=m.id AND i.user_id=m.user_id) "
                "ORDER BY m.user_id,m.id LIMIT ?",
                (limit,),
            ).fetchall()
            for row in rows:
                owner = row["user_id"]
                if self.database.postgres:
                    if not db.execute(
                        "SELECT id FROM users WHERE id=? FOR UPDATE", (owner,)
                    ).fetchone():
                        continue
                    # A competing batch may have completed this row while this one waited.
                    if db.execute(
                        "SELECT 1 FROM meal_group_items WHERE entry_id=? AND user_id=?",
                        (row["id"], owner),
                    ).fetchone():
                        continue
                entry = Journal._public(row)
                group_id = entry["details"].get("group_id")
                if not isinstance(group_id, str) or not re.fullmatch(r"[a-f0-9]{32}", group_id):
                    group_id = _entry_id(owner, "legacy:" + entry["id"])
                self.record_group(db, owner, group_id, [entry])
                processed += 1
            db.execute(
                "INSERT INTO foundation_jobs(name,processed,updated_at) VALUES (?,?,?) "
                "ON CONFLICT(name) DO UPDATE SET "
                "processed=foundation_jobs.processed+excluded.processed, "
                "updated_at=excluded.updated_at",
                ("journal-groups", processed, datetime.now(UTC).isoformat()),
            )
        return {"processed": processed}

    def list_groups(self, user_id, day):
        with self.database.connect() as db:
            rows = db.execute(
                "SELECT * FROM meal_groups WHERE user_id=? AND local_date=? "
                "AND deleted_at IS NULL ORDER BY id",
                (user_id, day),
            ).fetchall()
        return [self.public(row) for row in rows]

    @staticmethod
    def public(row):
        result = dict(row)
        result.pop("user_id")
        result["snapshot"] = json.loads(result["snapshot"])
        return result
