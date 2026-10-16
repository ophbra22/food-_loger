"""Disposable P11 PostgreSQL rollback and backup/restore; exact local target only."""
import os, subprocess
from pathlib import Path
import psycopg
from foodlogger.database import Database, DatabaseUnavailable
from foodlogger.auth import AuthStore
from foodlogger.health import Health
from foodlogger.health_connect import HealthConnect, ConnectImport
from uuid import uuid4
url=os.environ['FOODLOGGER_TEST_DATABASE_URL']
assert '@127.0.0.1:55421/biteflow_p11_test?' in url
from psycopg.conninfo import conninfo_to_dict
options=conninfo_to_dict(url)
appurl=f"postgresql://foodlogger_app:local-test-app-password@127.0.0.1:55421/{options['dbname']}?sslmode=disable"
with psycopg.connect(appurl) as conn:assert conn.execute('SELECT current_user').fetchone()[0]=='foodlogger_app'
with psycopg.connect(url) as conn:conn.execute('GRANT INSERT,UPDATE ON foodlogger.health_connect_imports TO foodlogger_app')
db=Database(appurl);owner,_=AuthStore(db).register('rollback_p11_'+uuid4().hex[:6],'fixture-only-password');owner=owner['id'];service=Health(db)
water=uuid4().hex
with db.connect() as conn:
 conn.execute("INSERT INTO tracking_entries(user_id,id,kind,value,occurred_at,local_date,timezone_id,source,external_id,version,deleted,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",(owner,water,'water',250,'2026-10-15T09:00:00+00:00','2026-10-15','UTC','manual',None,1,0,'2026-10-15T09:00:00+00:00','2026-10-15T09:00:00+00:00'))
live=service.reconcile(owner)
assert len(live['items'])==1 and live['items'][0]['revision']==1
with db.connect() as conn:conn.execute('UPDATE tracking_entries SET deleted=1,version=2 WHERE user_id=? AND id=?',(owner,water))
first=service.reconcile(owner)
assert first['items'][0]['deleted'] and first['items'][0]['revision']==2 and first['items'][0]['id']==live['items'][0]['id']
connect=HealthConnect(db)
body=ConnectImport(events=[dict(operation="upsert",modified_at="2026-10-16T00:00:00Z",external_id=str(uuid4()),kind='weight',value=70,start='2026-10-15T09:00:00Z',end='2026-10-15T09:00:00Z',source_bundle='com.example.scale',timezone_id='UTC')])
assert connect.import_changes(owner,body)['weight_dates']==['2026-10-15']
deleted_id=str(uuid4())
connect.import_changes(owner,ConnectImport(events=[dict(operation='delete',external_id=deleted_id)]))
imported=connect.imports(owner)
with psycopg.connect(url) as conn:
 before={table:conn.execute('SELECT * FROM foodlogger.'+table+' WHERE user_id=%s ORDER BY 1,2',(owner,)).fetchall() for table in ['health_scopes','health_exports','health_connect_imports','tracking_entries']}

with psycopg.connect(url) as conn:conn.execute(Path('docs/biteflow/rollback-p11.sql').read_text())
assert connect.imports(owner)==imported
try:connect.import_changes(owner,ConnectImport(events=[dict(**body.events[0].model_dump(exclude={"value","modified_at"}),value=71,modified_at="2026-10-17T00:00:00Z")]))
except DatabaseUnavailable:pass
else:raise AssertionError('rollback did not block reconciliation writes')
with psycopg.connect(url) as conn:conn.execute('GRANT INSERT,UPDATE ON foodlogger.health_connect_imports TO foodlogger_app')
assert service.reconcile(owner)==first
assert connect.import_changes(owner,body)['weight_dates']==[]
assert connect.imports(owner)==imported
with psycopg.connect(url) as conn:
 assert conn.execute("SELECT count(*) FROM foodlogger.health_connect_imports WHERE user_id=%s",(owner,)).fetchone()[0]==2
backup=subprocess.check_output(['docker','exec','biteflow-p11-local','pg_dump','-U','postgres','-d','biteflow_p11_test','--schema=foodlogger','--no-owner'])
subprocess.run(['docker','exec','biteflow-p11-local','createdb','-U','postgres','biteflow_p11_restore_test'],check=True)
try:
 subprocess.run(['docker','exec','-i','biteflow-p11-local','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','biteflow_p11_restore_test'],input=backup,stdout=subprocess.DEVNULL,check=True)
 with psycopg.connect(url.replace('biteflow_p11_test?','biteflow_p11_restore_test?')) as conn:
  for table,rows in before.items():assert conn.execute('SELECT * FROM foodlogger.'+table+' WHERE user_id=%s ORDER BY 1,2',(owner,)).fetchall()==rows
 print('P11 write pause, readable provenance, retained scope/sample identity/revision-2 tombstone/import receipt and tracking rows: PASS after backup/restore')
finally:subprocess.run(['docker','exec','biteflow-p11-local','dropdb','-U','postgres','biteflow_p11_restore_test'],check=True)
