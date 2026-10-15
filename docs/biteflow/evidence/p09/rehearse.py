"""Disposable local PG16 migration rollback/backup restoration; never production."""
import os, subprocess
from pathlib import Path
import psycopg
from foodlogger.database import Database, DatabaseUnavailable
from foodlogger.auth import AuthStore
from foodlogger.habits import Habits,HabitPreferences
url=os.environ['FOODLOGGER_TEST_DATABASE_URL']
assert '@127.0.0.1:55419/biteflow_p09_test?' in url
appurl=url.replace('postgres@','foodlogger_app:local-test-app-password@')
db=Database(appurl);owner,_=AuthStore(db).register('rollback_p09','fixture-only-password');owner=owner['id']
s=Habits(db);s.put_preferences(owner,HabitPreferences(expected_version=0,lunch='12:00',muted=True))
with psycopg.connect(url) as conn:conn.execute(Path('docs/biteflow/rollback-p09.sql').read_text())
assert s.preferences(owner)['lunch']=='12:00'
try:s.put_preferences(owner,HabitPreferences(expected_version=1))
except DatabaseUnavailable:pass
else:raise AssertionError('rollback failed to block writes')
with psycopg.connect(url) as conn:conn.execute('GRANT INSERT,UPDATE ON foodlogger.reminder_preferences,foodlogger.reminder_devices,foodlogger.reminder_attempts TO foodlogger_app')
s.put_preferences(owner,HabitPreferences(expected_version=1,lunch='12:00',muted=True))
backup=subprocess.check_output(['docker','exec','biteflow-p09-local','pg_dump','-U','postgres','-d','biteflow_p09_test','--schema=foodlogger','--no-owner'])
subprocess.run(['docker','exec','biteflow-p09-local','createdb','-U','postgres','biteflow_p09_restore_test'],check=True)
try:
 subprocess.run(['docker','exec','-i','biteflow-p09-local','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','biteflow_p09_restore_test'],input=backup,stdout=subprocess.DEVNULL,check=True)
 with psycopg.connect(url.replace('/biteflow_p09_test?','/biteflow_p09_restore_test?')) as conn:
  body=conn.execute('SELECT body FROM foodlogger.reminder_preferences WHERE user_id=%s',(owner,)).fetchone()[0]
  assert '12:00' in body and 'true' in body
  for table in ('reminder_preferences','reminder_devices','reminder_attempts'):
   assert conn.execute('SELECT relrowsecurity FROM pg_class WHERE oid=%s::regclass',('foodlogger.'+table,)).fetchone()[0]
 print('PASS: additive migration, readable opt-ins during write rollback, denied writes, reenabled writes, full private schema backup/restoration and RLS retained.')
finally:subprocess.run(['docker','exec','biteflow-p09-local','dropdb','-U','postgres','biteflow_p09_restore_test'],check=True)
