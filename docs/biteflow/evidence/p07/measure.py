"""Deterministic synthetic local query workload; no providers or hosted operations."""
import json, tempfile, time, statistics
from datetime import date, timedelta
from pathlib import Path
from foodlogger.database import Database
from foodlogger.storage import Journal
from foodlogger.auth import AuthStore
from foodlogger.trends import Trends
with tempfile.TemporaryDirectory() as tmp:
 db=Database(Path(tmp)/'perf.db');Journal(db);auth=AuthStore(db);owner,_=auth.register('fixture','fixture-only-password')
 with db.connect() as c:
  for n in range(12000):
   day=str(date(2024,1,1)+timedelta(days=n%1000))
   c.execute("INSERT INTO meals(id,user_id,day,meal_type,food_id,name,emoji,grams,calories,protein,carbs,fat,created_at,details) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",(str(n),owner['id'],day,'snack','custom','fixture','',100,100,10,10,5,day+'T12:00:00Z','{}'))
  plans={name:[dict(r) for r in c.execute(sql,params).fetchall()] for name,sql,params in [
   ('meals','EXPLAIN QUERY PLAN SELECT * FROM meals WHERE user_id=? AND day BETWEEN ? AND ?',(owner['id'],'2026-08-01','2026-09-30')),
   ('tracking','EXPLAIN QUERY PLAN SELECT * FROM tracking_entries WHERE user_id=? AND kind=? AND deleted=0 AND local_date BETWEEN ? AND ?',(owner['id'],'water','2026-08-01','2026-09-30'))]}
 durations=[]
 for _ in range(20):
  start=time.perf_counter();result=Trends(db).get(owner['id'],date(2026,9,1),date(2026,9,30));durations.append((time.perf_counter()-start)*1000)
 print(json.dumps(dict(rows=12000,runs=20,period_dates=30,comparison_dates=30,median_ms=statistics.median(durations),max_ms=max(durations),plans=plans),indent=2))
