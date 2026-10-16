"""Loopback-only synthetic widget smoke. No real AI provider can be constructed."""
import os
from pathlib import Path
for key in list(os.environ):
 if key=='DATABASE_URL' or key.startswith(('FOODLOGGER_','GEMINI_','APPLE_')):os.environ.pop(key)
os.environ.update(FOODLOGGER_DB=str(Path('.superpowers/sdd/p12-plan/widget-smoke.sqlite3').resolve()),FOODLOGGER_AI_ENABLED='0',FOODLOGGER_GOALS_ENABLED='1',FOODLOGGER_TRACKING_ENABLED='1')
from foodlogger.app import create_app
import uvicorn
uvicorn.run(create_app(),host='127.0.0.1',port=8765,log_level='warning')
