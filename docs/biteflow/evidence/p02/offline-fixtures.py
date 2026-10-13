"""Fixture integrity and preparation benchmark. No model is imported or invoked."""
import hashlib,json,time
from pathlib import Path
from foodlogger.meal_analysis import prepare_image
root=Path.cwd()/ 'evaluations/meal_analysis'
manifest=json.loads((root/'manifest.json').read_text())
rows=[]
for case in manifest['cases']:
    data=(root/case['file']).read_bytes()
    assert hashlib.sha256(data).hexdigest()==case['sha256']
    start=time.perf_counter(); clean,warnings=prepare_image(data)
    rows.append({'id':case['id'],'sha256_verified':True,'input_bytes':len(data),'prepared_bytes':len(clean),'prepare_ms':round((time.perf_counter()-start)*1000,2),'warnings':warnings})
result={'scope':'Offline fixture integrity/image preparation only; not recognition performance','cases':rows,'provider_calls':0,'recognition_precision':None,'recognition_recall':None,'portion_error':None,'meal_kcal_mae':None,'coverage':None,'tokens':None,'provider_cost':None,'provider_latency':None}
(Path(__file__).parent/'photo-fixtures.json').write_text(json.dumps(result,indent=2)+'\n')
print(f'{len(rows)} fixtures verified/prepared; zero provider calls; recognition metrics unmeasured.')
