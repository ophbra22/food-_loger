"""Disposable P13 copy rehearsal. Never accepts a production connection."""

import hashlib
import json
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

from foodlogger.app import create_app
from foodlogger.auth import AuthStore
from foodlogger.database import Database
from foodlogger.security import Settings

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "tests"))
from test_privacy import PASSWORD, seed_private_data  # noqa: E402

SCRATCH = ROOT / ".superpowers/sdd/p13-plan/restore"
SCRATCH.mkdir(exist_ok=False)
CONTAINER = "biteflow-p13-postgres"
SOURCE = "biteflow_p13_test"
COPY = "biteflow_p13_restore_test"


def docker(*args, input=None):
    return subprocess.run(
        ["docker", "exec", "-i", CONTAINER, *args], input=input, check=True, capture_output=True
    ).stdout


def digest(database):
    with database.connect() as db:
        if database.postgres:
            tables = db.execute(
                "SELECT tablename AS name FROM pg_tables WHERE schemaname='foodlogger'"
            ).fetchall()
        else:
            tables = db.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            ).fetchall()
        result = {}
        for table in sorted(row["name"] for row in tables):
            assert table.replace("_", "").isalnum()
            rows = [dict(row) for row in db.execute(f'SELECT * FROM "{table}"').fetchall()]
            canonical = sorted(json.dumps(row, sort_keys=True, default=str) for row in rows)
            result[table] = {
                "rows": len(rows),
                "sha256": hashlib.sha256("\n".join(canonical).encode()).hexdigest(),
            }
        return result


def reconcile(source, restored, owner):
    baseline = digest(source)
    assert digest(restored) == baseline
    row = (owner, "post-backup", "water", 250, "2026-10-18T12:00:00Z", "2026-10-18",
           "UTC", "manual", 1, 0, "now", "now")
    insert = ("INSERT INTO tracking_entries(user_id,id,kind,value,occurred_at,local_date,"
              "timezone_id,source,version,deleted,created_at,updated_at) "
              "VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING")
    with source.connect() as db:
        db.execute(insert, row)
    after_write = digest(source)
    assert after_write != baseline and digest(restored) == baseline
    # Replaying an explicit captured synthetic write twice is idempotent.
    for _ in range(2):
        with restored.connect() as db:
            db.execute(insert, row)
    assert digest(restored) == after_write
    AuthStore(source).delete_account(owner, PASSWORD)
    after_delete = digest(source)
    assert after_delete != digest(restored)
    AuthStore(restored).delete_account(owner, PASSWORD)
    assert digest(restored) == after_delete
    with restored.connect() as db:
        assert db.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"] == 1
        assert db.execute("SELECT COUNT(*) AS n FROM tracking_entries").fetchone()["n"] == 1
        if not restored.postgres:
            assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
            assert not db.execute("PRAGMA foreign_key_check").fetchall()
    return {"baseline": baseline, "after_write": after_write, "after_delete": after_delete,
            "copy_matches": True, "write_replay_twice": True, "deletion_reconciled": True,
            "other_owner_preserved": True}


started = time.perf_counter()
app = create_app(SCRATCH / "source.sqlite3", settings=Settings(ai_enabled=False))
sqlite_source = app.state.auth.database
owners = []
for name in ("restore-alice", "restore-bobby"):
    owner, _ = app.state.auth.register(name, PASSWORD)
    owners.append(owner["id"])
    app.state.auth.create_session(owner["id"])
    seed_private_data(sqlite_source, owner["id"])
with sqlite3.connect(sqlite_source.path) as src, sqlite3.connect(SCRATCH / "copy.sqlite3") as dst:
    src.backup(dst)
results = {"sqlite": reconcile(sqlite_source, Database(SCRATCH / "copy.sqlite3"), owners[0])}
# The PostgreSQL test suite leaves one surviving synthetic owner. Assert exact state.
url = (ROOT / ".superpowers/sdd/p13-plan/postgres-url").read_text().strip()
assert "@127.0.0.1:55423/" in url and url.split("/")[-1].split("?")[0] == SOURCE
pg_source = Database(url)
with pg_source.connect() as db:
    users = db.execute("SELECT id,username FROM users ORDER BY username").fetchall()
assert len(users) == 1 and users[0]["username"] == "privacy_bob"
auth = AuthStore(pg_source)
auth.delete_account(users[0]["id"], "correct horse battery staple")
pg_owners = []
for name in ("restore-alice", "restore-bobby"):
    owner, _ = auth.register(name, PASSWORD)
    auth.create_session(owner["id"])
    pg_owners.append(owner["id"])
    seed_private_data(pg_source, owner["id"])
backup = docker("pg_dump", "-U", "postgres", "-Fc", SOURCE)
(SCRATCH / "backup.dump").write_bytes(backup)
docker("createdb", "-U", "postgres", COPY)
try:
    docker("pg_restore", "-U", "postgres", "-d", COPY, input=backup)
    results["postgres"] = reconcile(pg_source, Database(url.replace(SOURCE, COPY)), pg_owners[0])
finally:
    docker("dropdb", "-U", "postgres", COPY)
results["seconds"] = round(time.perf_counter() - started, 3)
results["scope"] = "Synthetic local copy only. Explicit example replay; not a production change-data-capture system."
(Path(__file__).parent / "restore-results.json").write_text(json.dumps(results, indent=2) + "\n")
print(json.dumps({"sqlite": "PASS", "postgres": "PASS", "seconds": results["seconds"]}))
