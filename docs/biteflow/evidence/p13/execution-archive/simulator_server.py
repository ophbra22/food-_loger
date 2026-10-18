from pathlib import Path
from datetime import date
import uvicorn
from foodlogger.app import create_app
from foodlogger.security import Settings
from foodlogger.schemas import MealCreate
from foodlogger.nutrition import Catalog
from foodlogger.storage import Journal
root=Path(__file__).parent
app=create_app(root/'simulator.sqlite3',settings=Settings(ai_enabled=False,goals_enabled=True,tracking_enabled=True,trends_enabled=True))
auth=app.state.auth
with auth.database.connect() as db: count=db.execute('SELECT count(*) AS n FROM users').fetchone()['n']
if not count:
 user,_=auth.register('p13-user','local-simulator-password')
 Journal(auth.database).add(MealCreate(food_id='banana',grams=150,day=date.today(),meal_type='lunch'),Catalog(),user_id=user['id'])
uvicorn.run(app,host='127.0.0.1',port=8765,access_log=False)
