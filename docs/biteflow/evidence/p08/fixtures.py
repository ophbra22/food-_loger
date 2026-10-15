"""Generate synthetic contract fixtures through local HTTP routes; no provider/network."""
import sys,json,tempfile
from pathlib import Path
sys.path.insert(0,str(Path.cwd()/'tests'))
from fastapi.testclient import TestClient
from foodlogger.app import create_app
from foodlogger.security import Settings
from test_meal_analysis_pipeline import register
from test_recommendations import food,prefs,review
from test_trends import meal
with tempfile.TemporaryDirectory() as d:
 with TestClient(create_app(Path(d)/'fixtures.db',settings=Settings(canonical_writes=True,library_enabled=True,recipe_writes=True,goals_enabled=True,insights_enabled=True,recommendations_enabled=True,recommendation_writes=True))) as c:
  h=register(c,'fixture_owner')
  for day,cal in [('11',100),('13',200),('14',500)]:meal(c,h,'2026-10-'+day,cal)
  assert c.put('/api/goals',headers=h,json=dict(effective_local_date='2026-10-11',timezone_id='UTC',allow_past=True,expected_version=0,calorie_target=1000,protein_g=50)).status_code==200
  assert prefs(c,h,allergy_status='declared',allergens=['milk']).status_code==200
  for i,name in enumerate(['Fixture chicken bowl','Fixture lentil bowl']):
   e=food(c,h,name,'recipe-fixture-key-'+str(i));assert review(c,h,e).status_code==200
  result={}
  for language in ('en','he'):
   result[language]={}
   for feature,url in [('insight','insights?week_start=2026-10-11'),('recommendation','recommendations?day=2026-10-14')]:
    r=c.get('/api/'+url+'&language='+language,headers=h);assert r.status_code==200,r.text
    result[language][feature]=r.json()
  Path('mobile/src/test-fixtures/advice.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('Generated EN/HE synthetic HTTP insight and 500kcal/40g milk-restricted recommendation contracts; no provider configured.')
