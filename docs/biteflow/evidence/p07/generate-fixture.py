import json
from pathlib import Path
from datetime import date
from foodlogger.trends import period
entries=[dict(day='2026-10-11',calories=100,protein=10,carbs=20,fat=1,details={}),dict(day='2026-10-13',calories=200,protein=20,carbs=30,fat=2,details={})]
measurements=[dict(id='a',kind='weight',value=70,local_date='2026-10-11',occurred_at='2026-10-11T09:00:00Z',source='manual'),dict(id='b',kind='weight',value=69.5,local_date='2026-10-13',occurred_at='2026-10-13T09:00:00Z',source='manual')]
goals={'revisions':[]}
current=period(date(2026,10,11),date(2026,10,17),entries,measurements,goals)
previous=period(date(2026,10,4),date(2026,10,10),[],[],goals)
Path('mobile/src/test-fixtures/trends.json').write_text(json.dumps(dict(schema_version=1,current=current,previous=previous,comparison={k:None for k in current['statistics']['average']},comparison_basis='preceding_equal_length'),indent=2)+'\n')
