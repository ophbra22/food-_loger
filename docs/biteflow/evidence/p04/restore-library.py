"""Private synthetic PostgreSQL P04 backup/restore rehearsal."""
import os,sys,subprocess
from pathlib import Path
sys.path.insert(0,str(Path('tests').resolve()))
import psycopg
from psycopg.conninfo import conninfo_to_dict
from urllib.parse import quote
from test_postgres import database as database_fixture
from test_meal_service import DRAFT
from test_recipes import recipe_body
from foodlogger.auth import AuthStore
from foodlogger.database import Database
from foodlogger.storage import Journal
from foodlogger.library import Library,Favorite
from foodlogger.recipes import Recipes,RecipeBody,RecipePatch
from foodlogger.copying import Copying,CopyRequest
from foodlogger.meal_service import MealService,MealConflict
from foodlogger.domain import MealDraft
source=os.environ['FOODLOGGER_TEST_DATABASE_URL'];options=conninfo_to_dict(source)
assert options['host']=='127.0.0.1' and options['dbname']=='biteflow_p04_test'
generator=database_fixture.__wrapped__();db=next(generator)
auth=AuthStore(db);owner,_=auth.register('restore_fixture','synthetic-password-2026');owner=owner['id']
service=MealService(Journal(db));recipes=Recipes(db);library=Library(db)
recipe,_=recipes.create(owner,RecipeBody(**recipe_body()),'restore-recipe-create');recipes.patch(owner,recipe['id'],RecipePatch(**{**recipe_body(),'name':'Changed'},expected_version=1));library.favorite(owner,Favorite(kind='recipe',id=recipe['id']))
meal,_=service.create(MealDraft(**DRAFT),owner,'restore-original-meal');copy=Copying(service)
selection={'source_day':DRAFT['local_date'],'sources':[{'id':meal['id'],'version':1}],'destination_date':'2026-10-14','timezone_id':'Asia/Jerusalem','times':{meal['id']:{'wall_time':'12:30:00'}}}
preview,_=copy.run(owner,CopyRequest(action='preview',**selection));confirm=CopyRequest(action='confirm',confirmed=True,preview_token=preview['preview_token'],drafts=preview['drafts'],**selection)
copied,_=copy.run(owner,confirm,'restore-copied-meals')
sql=subprocess.check_output(['docker','exec','biteflow-p04-pg','pg_dump','-U','postgres','-d','biteflow_p04_test','--schema=foodlogger','--no-owner'])
with psycopg.connect(source,autocommit=True) as admin:admin.execute('CREATE DATABASE biteflow_p04_restore_test')
try:
 subprocess.run(['docker','exec','-i','biteflow-p04-pg','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','biteflow_p04_restore_test'],input=sql,check=True,stdout=subprocess.DEVNULL)
 restored=Database(f"postgresql://foodlogger_app:{quote('local-test-app-password')}@127.0.0.1:{options['port']}/biteflow_p04_restore_test?sslmode=disable")
 assert Recipes(restored).versions(owner,recipe['id'])==recipes.versions(owner,recipe['id'])
 assert Library(restored).list(owner,favorites=True)==library.list(owner,favorites=True)
 restored_meals=MealService(Journal(restored));restored_copy=Copying(restored_meals)
 assert restored_copy.run(owner,confirm,'restore-copied-meals')==(copied,False)
 assert restored_meals.get(meal['id'],owner)==meal
 saved=copied['groups'][0];restored_meals.delete(saved['id'],owner,1)
 try:restored_copy.run(owner,confirm,'restore-copied-meals');raise AssertionError('Tombstone bypass')
 except MealConflict:pass
 print('PASS: exact recipe versions/items, favorite, source/copy snapshots and parent/child receipts restored under restricted application role; replay deduplicates; deleted copy cannot resurrect.')
finally:
 with psycopg.connect(source,autocommit=True) as admin:admin.execute('DROP DATABASE biteflow_p04_restore_test')
 generator.close()
