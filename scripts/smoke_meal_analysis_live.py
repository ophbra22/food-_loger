"""Opt-in live free-tier API → reference → edited atomic journal smoke check.

Uses a licensed public image and a temporary local database. Never writes to a
production account. This verifies the HTTP contract, not a physical iPhone UI.
"""

import json
import os
import secrets
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from fastapi.testclient import TestClient

from foodlogger.app import create_app
from foodlogger.nutrition_reference import aggregate, scale_nutrients


def main():
    for line in Path(".env").read_text().splitlines():
        name, _, value = line.partition("=")
        if name in {"GEMINI_API_KEY", "FOODLOGGER_GEMINI_FREE_TIER_CONFIRMED"}:
            os.environ.setdefault(name, value.strip().strip('"'))
    root = Path("evaluations/meal_analysis")
    case = json.loads((root / "manifest.json").read_text())["cases"][1]
    image = (root / case["file"]).read_bytes()
    with tempfile.TemporaryDirectory(prefix="biteflow-live-check-") as folder:
        with TestClient(create_app(Path(folder) / "journal.sqlite3")) as client:
            credentials = {"username": "evaluation-user", "password": secrets.token_urlsafe(24)}
            login = client.post(
                "/api/auth/register",
                json=credentials,
                headers={"X-FoodLogger-Client": "mobile", "X-FoodLogger-Request": "1"},
            )
            assert login.status_code == 201
            headers = {
                "Authorization": "Bearer " + login.json()["session_token"],
                "Idempotency-Key": "live-analysis-smoke-001",
            }
            files = {"file": ("licensed-meal.png", image, "image/png")}
            response = client.post("/api/analyze-meal", files=files, headers=headers)
            assert response.status_code == 200, (response.status_code, response.json())
            result = response.json()
            assert len(result["foods"]) >= 2 and result["complete_nutrition"]
            cached = client.post("/api/analyze-meal", files=files, headers=headers)
            assert cached.status_code == 200 and cached.json() == result
            foods = [
                {
                    "id": f["id"],
                    "name": f["name"],
                    "grams": f["estimated_weight_g"],
                    "reference_id": f["reference"]["id"],
                    "confirmed": True,
                }
                for f in result["foods"]
            ]
            # Exercise a user correction without paying for another model call.
            foods[0]["grams"] = 100
            payload = {
                "analysis_id": result["analysis_id"],
                "foods": foods,
                "day": "2026-10-13",
                "meal_type": "lunch",
            }
            headers["Idempotency-Key"] = "live-journal-smoke-0001"
            saved = client.post("/api/meals/analyzed", json=payload, headers=headers)
            assert saved.status_code == 201, saved.json()
            repeated = client.post("/api/meals/analyzed", json=payload, headers=headers)
            assert repeated.status_code == 200 and repeated.json() == saved.json()
            expected = aggregate(
                [
                    scale_nutrients(observed["reference"]["nutrition"], edited["grams"])
                    for observed, edited in zip(result["foods"], foods, strict=True)
                ]
            )
            journal = client.get("/api/meals?day=2026-10-13", headers=headers).json()
            assert journal["summary"]["count"] == len(foods)
            assert all(journal["summary"][k] == v for k, v in expected.items())
            report = {
                "verified_at": datetime.now(UTC).isoformat(),
                "status": "passed",
                "image_case": case["id"],
                "provider": result["provider"],
                "model": result["model"],
                "analysis": result,
                "edited_first_food_grams": 100,
                "saved_components": len(foods),
                "saved_total": expected,
                "checks": [
                    "authenticated real vision",
                    "cached analysis retry",
                    "reference-grounded edit",
                    "atomic save",
                    "idempotent save retry",
                    "journal count and totals",
                ],
                "scope": ("Temporary SQLite and FastAPI TestClient; no phone or production writes"),
            }
            (root / "live-api-smoke.json").write_text(json.dumps(report, indent=2) + "\n")
            print("Live API smoke passed:", len(foods), "components; totals", expected)


if __name__ == "__main__":
    main()
