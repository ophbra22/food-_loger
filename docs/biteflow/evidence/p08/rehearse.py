"""Owned disposable PG16 only: additive P08 rollback preserves restrictions and reviews."""
import os,subprocess
from pathlib import Path
import psycopg
from foodlogger.database import Database,DatabaseUnavailable
from foodlogger.auth import AuthStore
from foodlogger.recommendations import Recommendations,PreferenceBody,SourceReview,source_revision
from foodlogger.recipes import Recipes,RecipeBody
import sys
sys.path.insert(0,str(Path.cwd()/'tests'))
from test_recipes import recipe_body
url=os.environ['FOODLOGGER_TEST_DATABASE_URL']
assert '@127.0.0.1:' in url and '/biteflow_p08_test?' in url
appurl=url.replace('postgres@','foodlogger_app:local-test-app-password@')
db=Database(appurl);owner,_=AuthStore(db).register('rollback_p08_final','fixture-only-password');owner=owner['id']
s=Recommendations(db)
p=s.put_preferences(owner,PreferenceBody(allergy_status='declared',allergens=['milk'],expected_version=0))
entry,_=Recipes(db).create(owner,RecipeBody.model_validate(recipe_body()),'rollback-p08-recipe')
s.put_review(owner,'recipe',entry['id'],SourceReview(source_revision=source_revision(entry),expected_version=0,expected_preferences_version=p["version"],ingredients_reviewed=True,allergens=[],suitable_diets=[]))
with psycopg.connect(url) as conn:conn.execute(Path('docs/biteflow/rollback-p08.sql').read_text())
assert s.preferences(owner)['allergens']==['milk'] and len(s.sources(owner)['items'])==1
try:s.put_preferences(owner,PreferenceBody(expected_version=p['version']))
except DatabaseUnavailable:pass
else:raise AssertionError('rollback did not block writes')
with psycopg.connect(url) as conn:conn.execute('GRANT INSERT,UPDATE,DELETE ON foodlogger.recommendation_preferences,foodlogger.recommendation_source_reviews TO foodlogger_app')
s.put_preferences(owner,PreferenceBody(expected_version=p['version'],allergy_status='declared',allergens=['milk']))
backup=subprocess.check_output(['docker','exec','biteflow-p08-local','pg_dump','-U','postgres','-d','biteflow_p08_test','--schema=foodlogger','--no-owner'])
subprocess.run(['docker','exec','biteflow-p08-local','createdb','-U','postgres','biteflow_p08_restore_test'],check=True)
try:
 subprocess.run(['docker','exec','-i','biteflow-p08-local','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','biteflow_p08_restore_test'],input=backup,stdout=subprocess.DEVNULL,check=True)
 with psycopg.connect(url.replace('/biteflow_p08_test?','/biteflow_p08_restore_test?')) as conn:
  assert 'milk' in conn.execute('SELECT body FROM foodlogger.recommendation_preferences WHERE user_id=%s',(owner,)).fetchone()[0]
  assert conn.execute('SELECT count(*) FROM foodlogger.recommendation_source_reviews WHERE user_id=%s',(owner,)).fetchone()[0]==1
 print('PASS: preferences/reviews readable during write rollback; denied write; reenabled write; pg_dump restored both private tables in separate owned database.')
finally:subprocess.run(['docker','exec','biteflow-p08-local','dropdb','-U','postgres','biteflow_p08_restore_test'],check=True)
