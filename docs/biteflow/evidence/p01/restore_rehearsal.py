"""Disposable-only backup rehearsal; no production environment is consulted."""
import hashlib
import json
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path
sys.path.insert(0, str(Path.cwd() / 'tests'))
from test_meal_service import DRAFT
from foodlogger.domain import MealDraft
from foodlogger.meal_service import MealService
from foodlogger.storage import Journal
from foodlogger.auth import AuthStore
from foodlogger.database import Database
from foodlogger.foundation import Foundation
from foodlogger.schemas import MealCreate
from foodlogger.nutrition import Catalog

def seed(database):
    journal = Journal(database)
    auth = AuthStore(journal.database)
    owner, _ = auth.register('restore_fixture', 'disposable-restore-password')
    service = MealService(journal)
    draft = MealDraft(**DRAFT)
    group, created = service.create(draft, owner['id'], 'restore-receipt-key')
    assert created
    for day in ('2026-10-12','2026-10-13'):
        entry=journal.add(MealCreate(food_id='banana',grams=100,day=day,meal_type='snack'),Catalog(),user_id=owner['id'])
        with journal.connect() as db:
            db.execute('UPDATE meals SET details=? WHERE id=?',(json.dumps({**entry['details'],'group_id':'f'*32}),entry['id']))
    assert Foundation(journal.database).backfill_batch()=={'processed':1,'quarantined':1}
    return owner['id'], group

def snapshot(db):
    tables = ['meals', 'users', 'meal_groups', 'meal_group_items', 'save_receipts', 'ai_projects', 'ai_attempts', 'foundation_migrations', 'foundation_jobs', 'foundation_issues']
    data = {}
    with db.connect() as conn:
        for table in tables:
            rows = [dict(r) for r in conn.execute('SELECT * FROM ' + table).fetchall()]
            data[table] = sorted(json.dumps(r, sort_keys=True, default=str) for r in rows)
    serialized = json.dumps(data, sort_keys=True).encode()
    return {'sha256': hashlib.sha256(serialized).hexdigest(), 'counts': {k:len(v) for k,v in data.items()}}

with tempfile.TemporaryDirectory(prefix='biteflow-p01-restore-') as directory:
    original, copied = Path(directory)/'original.db', Path(directory)/'restored.db'
    owner, group = seed(original)
    before = snapshot(Database(original))
    with sqlite3.connect(original) as source, sqlite3.connect(copied) as destination:
        source.backup(destination)
    assert snapshot(Database(copied)) == before
    restored = MealService(Journal(copied))
    replay, created = restored.create(MealDraft(**DRAFT), owner, 'restore-receipt-key')
    assert not created and replay == group
    assert Foundation(Database(copied)).backfill_batch()['processed'] == 0
    print(json.dumps({'engine':'SQLite','backup_restore':'PASS','receipt_replay':'PASS',**before}))
    # Exact loopback container/DB only. No inherited DATABASE_URL.
    container = 'biteflow-p01-pg'
    source_db = 'biteflow_p01_test'
    restored_db = 'biteflow_p01_restore_test'
    dsn = 'postgresql://postgres:p01-local-test-only@127.0.0.1:59237/'
    source = Database(dsn+source_db+'?sslmode=disable')
    owner, group = seed(source)
    before = snapshot(source)
    dump = Path(directory)/'disposable.dump'
    with dump.open('wb') as out:
        subprocess.run(['docker','exec',container,'pg_dump','-U','postgres','-d',source_db,'--format=custom','--schema=foodlogger'],stdout=out,check=True)
    subprocess.run(['docker','exec',container,'createdb','-U','postgres',restored_db],check=True)
    try:
        with dump.open('rb') as data:
            subprocess.run(['docker','exec','-i',container,'pg_restore','-U','postgres','-d',restored_db,'--exit-on-error'],stdin=data,check=True)
        restored = Database(dsn+restored_db+'?sslmode=disable')
        assert snapshot(restored) == before
        replay, created = MealService(Journal(restored)).create(MealDraft(**DRAFT), owner, 'restore-receipt-key')
        assert not created and replay == group
        assert Foundation(restored).backfill_batch()['processed'] == 0
        print(json.dumps({'engine':'PostgreSQL16','backup_restore':'PASS','receipt_replay':'PASS',**before}))
    finally:
        subprocess.run(['docker','exec',container,'dropdb','-U','postgres',restored_db],check=True)
