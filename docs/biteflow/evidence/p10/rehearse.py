"""Disposable P10 PostgreSQL rollback and backup/restore; exact local target only."""
import os, subprocess
from pathlib import Path
import psycopg
from foodlogger.database import Database, DatabaseUnavailable
from foodlogger.auth import AuthStore
from foodlogger.health import Health, HealthImport
from uuid import uuid4
url=os.environ['FOODLOGGER_TEST_DATABASE_URL']
assert '@127.0.0.1:55420/biteflow_p10_test?' in url
appurl=url.replace('postgres@','foodlogger_app:local-test-app-password@')
db=Database(appurl);owner,_=AuthStore(db).register('rollback_p10_'+uuid4().hex[:6],'fixture-only-password');owner=owner['id'];service=Health(db)
water=uuid4().hex
with db.connect() as conn:
 conn.execute("INSERT INTO tracking_entries(user_id,id,kind,value,occurred_at,local_date,timezone_id,source,external_id,version,deleted,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",(owner,water,'water',250,'2026-10-15T09:00:00+00:00','2026-10-15','UTC','manual',None,1,0,'2026-10-15T09:00:00+00:00','2026-10-15T09:00:00+00:00'))
live=service.reconcile(owner)
assert len(live['items'])==1 and live['items'][0]['revision']==1
with db.connect() as conn:conn.execute('UPDATE tracking_entries SET deleted=1,version=2 WHERE user_id=? AND id=?',(owner,water))
first=service.reconcile(owner)
assert first['items'][0]['deleted'] and first['items'][0]['revision']==2 and first['items'][0]['id']==live['items'][0]['id']
body=HealthImport(samples=[dict(external_id=str(uuid4()),kind='weight',value=70,start='2026-10-15T09:00:00Z',end='2026-10-15T09:00:00Z',source_bundle='com.example.scale',timezone_id='UTC')])
assert service.import_samples(owner,body)['weight_dates']==['2026-10-15']
imported=service.imports(owner)
with psycopg.connect(url) as conn:
 before={table:conn.execute('SELECT * FROM foodlogger.'+table+' WHERE user_id=%s ORDER BY 1,2',(owner,)).fetchall() for table in ['health_scopes','health_exports','health_imports','tracking_entries']}

with psycopg.connect(url) as conn:conn.execute(Path('docs/biteflow/rollback-p10.sql').read_text())
assert service.imports(owner)==imported
try:service.reconcile(owner)
except DatabaseUnavailable:pass
else:raise AssertionError('rollback did not block reconciliation writes')
with psycopg.connect(url) as conn:conn.execute('GRANT INSERT,UPDATE ON foodlogger.health_scopes,foodlogger.health_exports,foodlogger.health_imports TO foodlogger_app')
assert service.reconcile(owner)==first
backup=subprocess.check_output(['docker','exec','biteflow-p10-local','pg_dump','-U','postgres','-d','biteflow_p10_test','--schema=foodlogger','--no-owner'])
subprocess.run(['docker','exec','biteflow-p10-local','createdb','-U','postgres','biteflow_p10_restore_test'],check=True)
try:
 subprocess.run(['docker','exec','-i','biteflow-p10-local','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','biteflow_p10_restore_test'],input=backup,stdout=subprocess.DEVNULL,check=True)
 with psycopg.connect(url.replace('biteflow_p10_test?','biteflow_p10_restore_test?')) as conn:
  for table,rows in before.items():assert conn.execute('SELECT * FROM foodlogger.'+table+' WHERE user_id=%s ORDER BY 1,2',(owner,)).fetchall()==rows
 print('P10 write pause, readable provenance, retained scope/sample identity/revision-2 tombstone/import receipt and tracking rows: PASS after backup/restore')
finally:subprocess.run(['docker','exec','biteflow-p10-local','dropdb','-U','postgres','biteflow_p10_restore_test'],check=True)
