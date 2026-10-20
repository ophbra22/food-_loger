import json
from datetime import UTC, datetime
from io import BytesIO

import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from foodlogger.ai_gateway import BudgetPolicy
from foodlogger.analysis_schemas import AnalysisOptions
from foodlogger.app import create_app
from foodlogger.meal_analysis import AnalysisService
from foodlogger.security import Settings
from foodlogger.vision import GeminiVision, OllamaVision, VisionUnavailable


def photo(color="orange"):
    stream = BytesIO()
    Image.new("RGB", (400, 300), color).save(stream, "JPEG")
    return stream.getvalue()


def observed():
    return {
        "meal_name": "Lunch",
        "status": "food",
        "warnings": [],
        "foods": [
            {
                "id": "chicken",
                "name": "Chicken breast",
                "search_name": "chicken breast",
                "preparation": "grilled",
                "region": "left plate",
                "dish_type": "single",
                "visible_ingredients": [],
                "estimated_weight_g": 160,
                "weight_min_g": 155,
                "weight_max_g": 165,
                "confidence": "medium",
                "alternatives": [],
                "question": None,
            },
            {
                "id": "rice",
                "name": "White rice",
                "search_name": "rice white",
                "preparation": "cooked",
                "region": "right plate",
                "dish_type": "single",
                "visible_ingredients": [],
                "estimated_weight_g": 180,
                "weight_min_g": 130,
                "weight_max_g": 250,
                "confidence": "high",
                "alternatives": [],
                "question": None,
            },
        ],
    }


def response(output=None):
    return {
        "done": True,
        "done_reason": "stop",
        "model": "test-model",
        "prompt_eval_count": 100,
        "eval_count": 200,
        "message": {"role": "assistant", "content": json.dumps(output or observed())},
    }


def service(handler=None):
    client = httpx.Client(
        transport=httpx.MockTransport(
            handler or (lambda request: httpx.Response(200, json=response()))
        )
    )
    return AnalysisService(OllamaVision(client=client, sleep=lambda _: None))


def test_real_pipeline_schema_reference_portion_and_no_narrow_fake_range():
    result = service().analyze([photo()], AnalysisOptions(), "alice", "request-test-0001")
    assert len(result.foods) == 2
    assert all(f.reference.id.startswith("fdc:") for f in result.foods)
    assert result.foods[0].weight_min_g <= 104
    assert result.foods[0].weight_max_g >= 216
    assert result.total["calories"] == round(sum(f.nutrients["calories"] for f in result.foods), 1)
    assert result.complete_nutrition
    assert "low_detail" in result.warnings


def test_cache_is_private_and_key_reuse_with_new_content_conflicts():
    count = 0

    def handler(request):
        nonlocal count
        count += 1
        return httpx.Response(200, json=response())

    analyzer = service(handler)
    first = analyzer.analyze([photo()], AnalysisOptions(), "alice", "request-test-0001")
    assert analyzer.analyze([photo()], AnalysisOptions(), "alice", "request-test-0001") == first
    assert count == 1
    analyzer.analyze([photo()], AnalysisOptions(), "bob", "request-test-0001")
    assert count == 2
    with pytest.raises(ValueError, match="different"):
        analyzer.analyze([photo("blue")], AnalysisOptions(), "alice", "request-test-0001")


def test_unknown_dish_preserves_missing_nutrients_and_targeted_question():
    data = observed()
    data["foods"] = [
        {
            **data["foods"][0],
            "search_name": "unicorn mystery dish",
            "confidence": "low",
            "question": "What is in this stew?",
        }
    ]
    result = service(lambda _: httpx.Response(200, json=response(data))).analyze(
        [photo()], AnalysisOptions(), "alice", "request-test-0001"
    )
    assert result.foods[0].reference is None
    assert result.total["calories"] is None
    assert not result.complete_nutrition
    assert result.foods[0].requires_confirmation
    assert result.foods[0].question == "What is in this stew?"


def test_omelette_and_roll_photo_use_real_references_and_scale_without_inventing_values():
    data = observed()
    data["foods"][0].update(
        name="חביתה",
        search_name="omelette",
        preparation="fried",
        estimated_weight_g=120,
        weight_min_g=90,
        weight_max_g=160,
        question="Was cheese or oil added?",
    )
    data["foods"][1].update(
        name="לחמנייה",
        search_name="bread roll",
        preparation="baked",
        estimated_weight_g=70,
        weight_min_g=50,
        weight_max_g=90,
    )
    result = service(lambda _: httpx.Response(200, json=response(data))).analyze(
        [photo()], AnalysisOptions(language="he"), "alice", "omelette-photo-regression"
    )
    egg, roll = result.foods
    assert egg.reference.id == "fdc:172185"
    assert egg.estimated_weight_g == 120
    assert egg.nutrients == {"calories": 184.8, "protein": 12.7, "carbs": 0.8, "fat": 14.0}
    assert roll.reference.id == "fdc:174078"
    assert result.complete_nutrition
    assert all(f.requires_confirmation and f.match_confidence == "medium" for f in result.foods)
    assert egg.question == "Was cheese or oil added?"
    assert "hidden_ingredients" in result.warnings
    assert egg.reference.source == "USDA FoodData Central"
    assert egg.reference.source_version and egg.reference.source_url.endswith("/172185/nutrients")


def test_second_view_is_same_meal_and_exif_not_sent():
    def handler(request):
        body = json.loads(request.content)
        assert str(request.url) == "http://127.0.0.1:11434/api/chat"
        assert len(body["messages"][1]["images"]) == 2
        assert body["stream"] is False
        assert "same meal" in body["messages"][0]["content"]
        assert "nutrition_source" not in json.dumps(body["format"])
        return httpx.Response(200, json=response())

    assert (
        len(
            service(handler)
            .analyze(
                [photo(), photo("red")],
                AnalysisOptions(plate_diameter_cm=26),
                "a",
                "request-test-0001",
            )
            .foods
        )
        == 2
    )


@pytest.mark.parametrize(
    "upstream",
    [
        httpx.Response(401, text="secret provider detail"),
        httpx.Response(200, json={"status": "incomplete", "output": []}),
        httpx.Response(
            200,
            json={
                "status": "completed",
                "output": [{"type": "message", "content": [{"type": "refusal", "refusal": "no"}]}],
            },
        ),
        httpx.Response(200, json=response({**observed(), "invented": "field"})),
    ],
)
def test_upstream_failures_never_return_mock_success_or_leak_details(upstream):
    with pytest.raises(VisionUnavailable) as caught:
        service(lambda _: upstream).analyze([photo()], AnalysisOptions(), "a", "request-test-0001")
    assert "secret" not in str(caught.value)


def test_transient_error_retry_and_no_food_abstention():
    calls = 0

    def handler(request):
        nonlocal calls
        calls += 1
        if calls == 1:
            return httpx.Response(429)
        return httpx.Response(
            200,
            json=response(
                {"status": "no_food", "meal_name": "No food", "foods": [], "warnings": []}
            ),
        )

    result = service(handler).analyze([photo()], AnalysisOptions(), "a", "request-test-0001")
    assert result.status == "no_food" and not result.foods
    assert calls == 2


def register(client, username):
    r = client.post(
        "/api/auth/register",
        json={"username": username, "password": "test-long-password-2026"},
        headers={"X-FoodLogger-Request": "1", "X-FoodLogger-Client": "mobile"},
    )
    assert r.status_code == 201, r.text
    return {"Authorization": "Bearer " + r.json()["session_token"]}


def test_authenticated_analysis_save_retry_and_account_isolation(tmp_path):
    mocked = GeminiVision(
        api_key="mock-key",
        free_tier_confirmed=True,
        client=httpx.Client(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    200,
                    json={
                        "candidates": [
                            {
                                "finishReason": "STOP",
                                "content": {"parts": [{"text": json.dumps(observed())}]},
                            }
                        ]
                    },
                )
            )
        ),
    )
    app = create_app(
        tmp_path / "db",
        analyzer=AnalysisService(mocked),
        settings=Settings(ai_enabled=True, ai_project_id="fixture"),
    )
    app.state.ai_gateway.configure(
        BudgetPolicy(
            project_id="fixture",
            model=mocked.model,
            enabled=True,
            verified_at=datetime.now(UTC),
            daily_limit=10,
            rpm=10,
            input_tpm=10000,
            max_input_tokens=100,
            photo_reserve=10,
            user_daily_limit=10,
            feature_daily_limits={"photo": 10},
        )
    )
    with TestClient(app) as client:
        files = {"file": ("meal.jpg", photo(), "image/jpeg")}
        assert client.post("/api/analyze-meal", files=files).status_code == 401
        headers = register(client, "alice")
        headers["Idempotency-Key"] = "meal-analysis-key-001"
        result = client.post("/api/analyze-meal", files=files, headers=headers)
        assert result.status_code == 200, result.text
        data = result.json()
        payload = {
            "day": "2026-10-13",
            "meal_type": "lunch",
            "analysis_id": data["analysis_id"],
            "foods": [
                {
                    "id": f["id"],
                    "name": f["name"],
                    "grams": f["estimated_weight_g"],
                    "reference_id": f["reference"]["id"],
                    "confirmed": True,
                }
                for f in data["foods"]
            ],
        }
        saved = client.post("/api/meals/analyzed", json=payload, headers=headers)
        assert saved.status_code == 201, saved.text
        repeated = client.post("/api/meals/analyzed", json=payload, headers=headers)
        assert repeated.status_code == 200 and repeated.json() == saved.json()
        assert len(saved.json()["meals"]) == 2
        entries = client.get("/api/meals?day=2026-10-13", headers=headers).json()
        assert entries["summary"]["count"] == 2
        assert entries["summary"]["calories"] == data["total"]["calories"]
        payload["foods"][0]["grams"] = 100
        assert client.post("/api/meals/analyzed", json=payload, headers=headers).status_code == 409
        bob = register(client, "bobby")
        assert client.get("/api/meals?day=2026-10-13", headers=bob).json()["meals"] == []


def test_invalid_image_config_and_atomic_save_validation(tmp_path, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with TestClient(create_app(tmp_path / "db")) as client:
        headers = register(client, "alice")
        headers["Idempotency-Key"] = "meal-analysis-key-001"
        bad = client.post("/api/analyze-meal", files={"file": ("x", b"bad")}, headers=headers)
        assert bad.status_code == 422
        unavailable = client.post(
            "/api/analyze-meal", files={"file": ("x", photo())}, headers=headers
        )
        assert unavailable.status_code == 503 and "policy" in unavailable.json()["detail"]
        payload = {
            "day": "2026-10-13",
            "meal_type": "lunch",
            "analysis_id": "test",
            "foods": [
                {
                    "id": "a",
                    "name": "Chicken",
                    "grams": 160,
                    "reference_id": "fdc:171477",
                    "confirmed": True,
                },
                {
                    "id": "b",
                    "name": "Unknown",
                    "grams": 100,
                    "reference_id": "fdc:fake",
                    "confirmed": True,
                },
            ],
        }
        assert client.post("/api/meals/analyzed", json=payload, headers=headers).status_code == 422
        assert client.get("/api/meals?day=2026-10-13", headers=headers).json()["meals"] == []
