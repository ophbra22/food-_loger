from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from foodlogger.app import create_app
from foodlogger.classifier import ModelUnavailable


class UnavailableClassifier:
    name = "unavailable-test-model"

    def predict(self, image):
        raise ModelUnavailable("Model missing. Run foodlogger download-model.")


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path / "test.sqlite3", UnavailableClassifier())) as client:
        yield client


def test_catalog_and_estimate(client):
    assert len(client.get("/api/foods").json()["foods"]) >= 20
    result = client.get("/api/nutrition", params={"food_id": "banana", "grams": 150})
    assert result.status_code == 200
    assert result.json()["calories"] == 133.5
    assert client.get("/api/nutrition?food_id=banana&grams=0").status_code == 422
    assert client.get("/api/nutrition?food_id=unknown&grams=100").status_code == 404


def test_journal_create_summary_export_and_delete(client):
    meal = {"food_id": "banana", "grams": 150, "day": "2026-10-08", "meal_type": "breakfast"}
    response = client.post("/api/meals", json=meal)
    assert response.status_code == 201
    entry = response.json()
    day = client.get("/api/meals?day=2026-10-08").json()
    assert day["summary"]["calories"] == 133.5
    assert day["meals"][0]["id"] == entry["id"]
    assert client.get("/api/meals?day=2026-10-09").json()["summary"]["count"] == 0
    exported = client.get("/api/export?day=2026-10-08")
    assert "Banana" in exported.text
    assert "133.5" in exported.text
    assert "attachment" in exported.headers["content-disposition"]
    assert client.delete(f"/api/meals/{entry['id']}").status_code == 204
    assert client.delete(f"/api/meals/{entry['id']}").status_code == 404


def test_invalid_meal_never_reaches_storage(client):
    meal = {"food_id": "banana", "grams": -1, "day": "2026-10-08", "meal_type": "breakfast"}
    assert client.post("/api/meals", json=meal).status_code == 422
    assert client.get("/api/meals?day=not-a-date").status_code == 422
    meal["grams"] = 100
    meal["food_id"] = "unknown"
    assert client.post("/api/meals", json=meal).status_code == 404


def test_invalid_upload_and_oversized_request(client):
    assert client.post("/api/predict", files={"file": ("fake.jpg", b"fake")}).status_code == 422
    response = client.post("/api/predict", content=b"x" * (9 * 1024 * 1024))
    assert response.status_code == 413


def test_missing_model_is_explicit_and_manual_logging_still_works(client):
    image = BytesIO()
    Image.new("RGB", (50, 50), "yellow").save(image, format="PNG")
    result = client.post("/api/predict", files={"file": ("test.png", image.getvalue())})
    assert result.status_code == 503
    assert "download-model" in result.json()["detail"]
    assert client.get("/api/foods").status_code == 200


def test_health_does_not_require_model_download(client):
    assert client.get("/api/health").json()["status"] == "ok"


@pytest.mark.parametrize("day", [0, "0", "2026-10-08T00:00:00", "2026-1-8"])
def test_journal_dates_are_strict_iso_strings(client, day):
    meal = {"food_id": "banana", "grams": 100, "day": day, "meal_type": "breakfast"}
    assert client.post("/api/meals", json=meal).status_code == 422
    assert client.get("/api/meals", params={"day": str(day)}).status_code == 422
    assert client.get("/api/export", params={"day": str(day)}).status_code == 422
