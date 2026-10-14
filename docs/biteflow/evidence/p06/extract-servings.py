import json,zipfile,hashlib,sys
from pathlib import Path
sys.path.insert(0,'src')
from foodlogger.food_providers import reference_version
archive=Path('/Users/braude/Documents/projects/food-_loger/runtime/meal-analysis/FoodData_Central_sr_legacy_food_json_2018-04.zip')
sha=hashlib.sha256(archive.read_bytes()).hexdigest()
metadata=json.loads(Path('src/foodlogger/data/usda_reference.json').read_text())
assert sha in [a['sha256'] for a in metadata['archives']]
with zipfile.ZipFile(archive) as z: data=json.loads(z.read(next(n for n in z.namelist() if n.endswith('.json'))))
rows=[]
selected={168878,170189,174915,173424,171287,173944,171688}
for food in next(iter(data.values())):
 if food['fdcId'] not in selected: continue
 for p in food.get('foodPortions',[]):
  label=p.get('modifier',''); unit=p['measureUnit']['name']; name=label.lower()
  if 'small' in name: unit='small'
  elif 'medium' in name: unit='medium'
  elif 'large' in name: unit='large'
  elif 'tbsp' in name: unit='tablespoon'
  elif 'tsp' in name: unit='teaspoon'
  elif 'cup' in name: unit='cup'
  elif 'slice' in name: unit='slice'
  elif 'piece' in name: unit='piece'
  else: continue
  amount=p['gramWeight']/p['amount']
  rows.append(dict(id=f"usda-sr2018:{p['id']}",food_id=f"fdc:{food['fdcId']}",source_version=reference_version(),unit=unit,label=label[:40],basis='g',amount=amount,confidence='source_reported',evidence={'source_url':f"https://fdc.nal.usda.gov/food-details/{food['fdcId']}/nutrients",'archive_sha256':sha,'portion_id':p['id'],'raw_label':label,'raw_amount':p['amount'],'raw_grams':p['gramWeight']}))
  if unit=='cup' and food['fdcId']==168878:
   for u,d in [('tablespoon',16),('teaspoon',48)]:
    original=next(r for r in rows if r['id']==f"usda-sr2018:{p['id']}")
    rows.append({**original,'id':original['id']+':'+u,'unit':u,'label':'US '+u,'amount':amount/d,'confidence':'derived','evidence':{**original['evidence'],'derivation':f'US customary cup / {d}; source food only'}})
Path('src/foodlogger/data/servings.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print(len(rows),'records',[(r['food_id'],r['unit'],r['amount']) for r in rows])
