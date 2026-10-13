"""Disposable UI-test server. Never reads DATABASE_URL or the normal journal."""
import asyncio
import json
from pathlib import Path

from fastapi.responses import JSONResponse
from foodlogger.app import create_app

ROOT = Path(__file__).resolve().parents[2]
CONTROL = ROOT / 'runtime/stabilization-control.json'
app = create_app(ROOT / 'runtime/stabilization.sqlite3')

@app.middleware('http')
async def faults(request, call_next):
    try:
        flags = json.loads(CONTROL.read_text())
    except (FileNotFoundError, ValueError):
        flags = {}
    if request.url.path == '/api/meals' and request.method == 'GET':
        await asyncio.sleep(flags.get('day_delay', 0))
        if flags.get('day_fail'):
            return JSONResponse({'detail': 'Injected test outage'}, status_code=503)
    if request.url.path.startswith('/api/meals') and request.method == 'POST' and flags.get('expire_save'):
        app.state.auth.revoke_session(request.headers.get('authorization','').removeprefix('Bearer '))
    response = await call_next(request)
    if request.method == 'POST' and request.url.path.startswith('/api/meals') and flags.get('lose_save_response'):
        return JSONResponse({'detail': 'Injected response loss after commit'}, status_code=503)
    return response
