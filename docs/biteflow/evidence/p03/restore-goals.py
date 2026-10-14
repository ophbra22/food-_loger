"""Disposable PostgreSQL goal backup/restore rehearsal, never a configured remote DB."""
import os,sys,subprocess
from pathlib import Path
from datetime import date,timedelta
sys.path.insert(0,str(Path('tests').resolve()))
import psycopg
from psycopg.conninfo import conninfo_to_dict,make_conninfo
from test_postgres import database as database_fixture
from test_goals import TARGET
from foodlogger.auth import AuthStore
from foodlogger.goals import Goals,GoalUpdate
from foodlogger.database import Database

source=os.environ['FOODLOGGER_TEST_DATABASE_URL']
opts=conninfo_to_dict(source)
assert opts['host']=='127.0.0.1' and opts['dbname']=='biteflow_p03_test'
generator=database_fixture.__wrapped__();db=next(generator)
auth=AuthStore(db);owner,_=auth.register('restore_fixture','synthetic-password-2026')
goals=Goals(db)
first=goals.put(owner['id'],GoalUpdate(**TARGET))
future=(date.fromisoformat(TARGET['effective_local_date'])+timedelta(days=1)).isoformat()
second=goals.put(owner['id'],GoalUpdate(**{**TARGET,'effective_local_date':future,'expected_version':1,'calorie_target':2500}))
sql=subprocess.check_output(['docker','exec','biteflow-p03-pg','pg_dump','-U','postgres','-d','biteflow_p03_test','--schema=foodlogger','--no-owner'])
with psycopg.connect(source,autocommit=True) as admin:admin.execute('CREATE DATABASE biteflow_p03_restore_test')
try:
 subprocess.run(['docker','exec','-i','biteflow-p03-pg','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','biteflow_p03_restore_test'],input=sql,check=True,stdout=subprocess.DEVNULL)
 app_options=conninfo_to_dict(db.location) if hasattr(db,'location') else None
 restore=source.replace('postgres:local-test-only@','foodlogger_app:local-test-app-password@').replace('/biteflow_p03_test?','/biteflow_p03_restore_test?')
 restored=Goals(Database(restore))
 assert restored.get(owner['id'])==second
 assert restored.daily(owner['id'],TARGET['effective_local_date'])['progress']['calories']['target']==2300
 assert restored.daily(owner['id'],future)['progress']['calories']['target']==2500
 print('PASS: private PostgreSQL schema dump/restored 2 exact goal revisions; 2300 today and 2500 tomorrow preserved; application role reads verified.')
finally:
 with psycopg.connect(source,autocommit=True) as admin:admin.execute('DROP DATABASE biteflow_p03_restore_test')
 generator.close()
