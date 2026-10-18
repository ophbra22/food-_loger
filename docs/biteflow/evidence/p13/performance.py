"""Synthetic local timings; no AI, remote network, or production performance claim."""

import json
import math
import platform
import statistics
import time
from pathlib import Path

from fastapi.testclient import TestClient

from foodlogger.app import create_app
from foodlogger.security import Settings

root = Path(__file__).resolve().parents[4]
path = root / ".superpowers/sdd/p13-plan/performance.sqlite3"
assert not path.exists()
app = create_app(path, settings=Settings(ai_enabled=False, goals_enabled=True,
                                       tracking_enabled=True, trends_enabled=True))
results = {}
with TestClient(app) as client:
    credentials = client.post("/api/auth/register", json={"username": "perf-fixture", "password": "local-perf-password"},
                              headers={"X-Foodlogger-Request": "1", "X-Foodlogger-Client": "mobile"}).json()
    headers = {"Authorization": "Bearer " + credentials["session_token"], "X-Foodlogger-Request": "1"}
    client.cookies.clear()
    actions = {
        "save": lambda: client.post("/api/meals", headers=headers, json={"food_id": "banana", "grams": 100, "day": "2026-10-18", "meal_type": "lunch"}),
        "day": lambda: client.get("/api/daily-summary?date=2026-10-18", headers=headers),
        "trends_7_days": lambda: client.get("/api/trends?from=2026-10-12&to=2026-10-18", headers=headers),
    }
    for name, action in actions.items():
        # Exactly three warmups then thirty measured calls; saves grow the fixture.
        for _ in range(3):
            response = action()
            assert response.is_success, response.text
        elapsed = []
        failures = 0
        for _ in range(30):
            start = time.perf_counter()
            response = action()
            elapsed.append((time.perf_counter() - start) * 1000)
            failures += int(not response.is_success)
        results[name] = {"n": 30, "warmups": 3, "failures": failures,
                         "p50_ms": round(statistics.median(elapsed), 3),
                         "p95_ms": round(sorted(elapsed)[math.ceil(.95 * len(elapsed)) - 1], 3),
                         "samples_ms": [round(x, 3) for x in elapsed]}
    start = time.perf_counter()
    archive = client.get("/api/account/export", headers=headers)
    assert archive.is_success
    results["archive"] = {"n": 1, "warmups": 0, "ms": round((time.perf_counter()-start)*1000,3), "bytes": len(archive.content)}
results["environment"] = {"platform": platform.platform(), "python": platform.python_version(), "transport": "TestClient in-process SQLite", "fixture": "1 user, 33 saved bananas; native builds may run concurrently", "recognition": "NOT RUN", "production": "NOT RUN"}
(Path(__file__).parent / "performance.json").write_text(json.dumps(results, indent=2) + "\n")
print(json.dumps({k: {x: y for x, y in v.items() if x != "samples_ms"} for k,v in results.items()}))
assert all(v.get("failures", 0) == 0 for v in results.values())
