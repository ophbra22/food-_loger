"""Owned disposable PostgreSQL backup/restore drill; never a hosted connection."""
import json,os,subprocess
from pathlib import Path
from urllib.parse import urlsplit
from foodlogger.database import Database
from foodlogger.auth import AuthStore
from foodlogger.storage import Journal
from foodlogger.private_products import PrivateProducts,ProductBody
p=Path('.superpowers/sdd/roadmap')
dsn=os.environ['FOODLOGGER_TEST_DATABASE_URL'];url=urlsplit(dsn)
assert url.hostname=='127.0.0.1' and url.path=='/biteflow_p06_test'
assert json.loads((p/'postgres-setup.json').read_text())['port']==str(url.port)
db=Database(dsn);Journal(db);auth=AuthStore(db)
owner,_=auth.register('p06restoreproof','local-test-restore-only-password')
products=PrivateProducts(db)
body=ProductBody.model_validate({'confirmed':True,'expected_version':0,'item':{'id':'restored','display_name':'Restore fixture','portion':{'quantity':100,'unit':'g','normalized_g':100},'nutrition_per_100':{'basis':'g','energy_kcal':50},'source':{'provider':'label','verified_status':'user_confirmed'}}})
products.save(owner['id'],'d'*32,body,'restore-fixture-key-01')
body.expected_version=1;body.item.nutrition_per_100.energy_kcal=60
products.save(owner['id'],'d'*32,body,'restore-fixture-key-02')
products.cache_put(owner['id'],'e'*64,{'fixture':'owner-only'})
before=[products.get(owner['id'],'d'*32,v) for v in (1,2)]
backup=p/'p06-restore.dump'
with backup.open('wb') as f:subprocess.run(['docker','exec','biteflow-p06-postgres','pg_dump','-U','postgres','-d','biteflow_p06_test','-Fc'],stdout=f,check=True)
subprocess.run(['docker','exec','biteflow-p06-postgres','createdb','-U','postgres','biteflow_p06_restore_test'],check=True)
with backup.open('rb') as f:subprocess.run(['docker','exec','-i','biteflow-p06-postgres','pg_restore','-U','postgres','-d','biteflow_p06_restore_test','--exit-on-error'],stdin=f,check=True)
restored=PrivateProducts(Database(dsn.replace('/biteflow_p06_test?','/biteflow_p06_restore_test?')))
assert before==[restored.get(owner['id'],'d'*32,v) for v in (1,2)]
assert restored.cache_get(owner['id'],'e'*64)=={'fixture':'owner-only'}
assert restored.cache_get('another-owner','e'*64) is None
result={'backup_restore':'PASS','private_versions':2,'immutable_values':[50,60],'cache_owner_isolation':'PASS','backup_bytes':backup.stat().st_size,'production_touched':False}
(p/'restore-result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
