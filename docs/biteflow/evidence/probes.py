"""P00 probes; temporary SQLite only. No network or provider invocations."""
import os
for key in list(os.environ):
    if key == 'DATABASE_URL' or key.startswith(('FOODLOGGER_', 'GEMINI_', 'APPLE_')):
        os.environ.pop(key)
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from fastapi.testclient import TestClient
from foodlogger.app import create_app
from foodlogger.nutrition_reference import scale_nutrients, aggregate
from foodlogger.vision import VisionUnavailable
class NeverCall:
    name='p00-no-network'; model='disabled'
    def recognize(self, *args): raise AssertionError('Provider call forbidden')
from foodlogger.meal_analysis import AnalysisService
with TemporaryDirectory() as temp:
    with TestClient(create_app(Path(temp)/'audit.db', analyzer=AnalysisService(provider=NeverCall()))) as client:
        account=client.post('/api/auth/register',json={'username':'p00fixture','password':'p00-disposable-password'},headers={'X-FoodLogger-Request':'1','X-FoodLogger-Client':'mobile'}).json()
        client.headers['Authorization']='Bearer '+account['session_token']
        payload={'day':'2026-10-13','meal_type':'lunch','analysis_id':'p00-fixture','foods':[{'id':'one','name':'Synthetic test food','grams':100,'manual_nutrition':{'calories':100,'protein':10,'carbs':10,'fat':2},'confirmed':True}]}
        hdr={'Idempotency-Key':'p00-analyzed-delete-retry'}
        first=client.post('/api/meals/analyzed',json=payload,headers=hdr)
        mid=first.json()['meals'][0]['id']
        deleted=client.delete('/api/meals/'+mid)
        replay=client.post('/api/meals/analyzed',json=payload,headers=hdr)
        print(json.dumps({'probe':'analyzed retry after all components deleted','first':first.status_code,'delete':deleted.status_code,'replay':replay.status_code,'day_count':client.get('/api/meals?day=2026-10-13').json()['summary']['count']}))
        hdr={'Idempotency-Key':'p00-legacy-payload-change'}
        body={'food_id':'banana','grams':100,'day':'2026-10-13','meal_type':'snack'}
        first=client.post('/api/meals',json=body,headers=hdr)
        replay=client.post('/api/meals',json={**body,'grams':200},headers=hdr)
        print(json.dumps({'probe':'legacy retry same key changed amount','first':first.status_code,'retry':replay.status_code,'requested_grams':200,'returned_grams':replay.json()['grams']}))
    rows=[scale_nutrients({'calories':1.4,'protein':0,'carbs':0,'fat':0},10) for _ in range(3)]
    print(json.dumps({'probe':'intermediate rounding synthetic values','item_calories':[r['calories'] for r in rows],'current_total':aggregate(rows)['calories'],'full_precision_total':1.4*30/100,'round_once_total':0.4}))
