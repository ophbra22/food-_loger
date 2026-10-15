"""Owned disposable PostgreSQL only: permission rollback and backup restoration."""
import os,subprocess
from pathlib import Path
import psycopg
from datetime import date
from foodlogger.database import Database,DatabaseUnavailable
from foodlogger.auth import AuthStore
from foodlogger.storage import Journal
from foodlogger.tracking import Tracking,TrackingBody
url=os.environ['FOODLOGGER_TEST_DATABASE_URL']
assert '@127.0.0.1:' in url and '/biteflow_p07_test?' in url
appurl=url.replace('postgres@','foodlogger_app:local-test-app-password@')
db=Database(appurl);auth=AuthStore(db);Journal(db)
owner,_=auth.register('rollback_fixture','fixture-only-password')
s=Tracking(db);body=TrackingBody(value=250,occurred_at='2026-10-11T09:00:00+03:00',local_date='2026-10-11',timezone_id='Asia/Jerusalem')
s.create(owner['id'],'water',body,'rollback-measurement')
with psycopg.connect(url) as conn: conn.execute(Path('docs/biteflow/rollback-p07.sql').read_text())
assert s.list(owner['id'],'water',date(2026,10,11),date(2026,10,11))['total']==250
try:s.create(owner['id'],'water',body,'blocked-measurement')
except DatabaseUnavailable:pass
else:raise AssertionError('rollback failed to block writes')
with psycopg.connect(url) as conn:conn.execute('GRANT INSERT,UPDATE,DELETE ON foodlogger.tracking_entries,foodlogger.tracking_receipts TO foodlogger_app')
s.create(owner['id'],'water',body,'reenabled-measurement')
assert s.list(owner['id'],'water',date(2026,10,11),date(2026,10,11))['total']==500
backup=subprocess.check_output(['docker','exec','biteflow-p07-local','pg_dump','-U','postgres','-d','biteflow_p07_test','--schema=foodlogger','--no-owner'])
subprocess.run(['docker','exec','biteflow-p07-local','createdb','-U','postgres','biteflow_p07_restore_test'],check=True)
subprocess.run(['docker','exec','-i','biteflow-p07-local','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','biteflow_p07_restore_test'],input=backup,stdout=subprocess.DEVNULL,check=True)
with psycopg.connect(url.replace('/biteflow_p07_test?','/biteflow_p07_restore_test?')) as conn:
 assert conn.execute('SELECT sum(value) FROM foodlogger.tracking_entries WHERE user_id=%s',(owner['id'],)).fetchone()[0]==500
print('PASS: read history during write rollback; denied new write; reenabled write; pg_dump restored measurement rows in separate disposable database.')

subprocess.run(['docker','exec','biteflow-p07-local','dropdb','-U','postgres','biteflow_p07_restore_test'],check=True)
