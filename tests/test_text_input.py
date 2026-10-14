"""Text proposals remain unsaved, explicit about unknown quantities and source uncertainty."""

import json
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient
from test_ai_gateway import setup_gateway
from test_meal_analysis_pipeline import register

from foodlogger.app import create_app
from foodlogger.security import Settings


def analyze(client, headers, text, **extra):
    return client.post(
        "/api/analyze-text",
        headers={**headers, "Idempotency-Key": "text-analysis-key-0001"},
        json={
            "text": text,
            "language": "en",
            "local_date": "2026-10-14",
            "meal_category": "lunch",
            **extra,
        },
    )


@pytest.fixture
def client(tmp_path):
    with TestClient(
        create_app(tmp_path / "text.db", settings=Settings(canonical_writes=True))
    ) as client:
        yield client


def test_required_phrases_scoping_and_unknown_household_measures(client):
    h = register(client, "alice")
    for case in json.loads(Path("tests/fixtures/text-phrases.json").read_text()):
        response = analyze(client, h, case["text"])
        assert response.status_code == 200, response.text
        result = response.json()
        assert [f["name"] for f in result["foods"]] == case["names"]
        assert [f["amount"] for f in result["foods"]] == case["amounts"]
        assert result["ai_status"] == "not_needed"
        assert all(not f["confirmed"] for f in result["foods"])
    result = analyze(client, h, "חצי פיתה עם חומוס וביצה קשה", language="he").json()
    assert result["foods"][0]["quantity"] == 0.5
    assert result["foods"][0]["unit"] == "piece"
    assert result["foods"][0]["question"] and result["draft"] is None
    assert client.get("/api/meals?day=2026-10-14&schema_version=2", headers=h).json()["meals"] == []


def test_catalog_provenance_unknowns_and_canonical_ready_envelope(client):
    h = register(client, "alice")
    known = analyze(client, h, "200g chicken").json()
    assert known["foods"][0]["references"]
    assert known["draft"]["input_method"] == "text"
    assert known["draft"]["items"][0]["portion"]["normalized_g"] == 200
    assert known["draft"]["items"][0]["source"]["provider"] == "USDA FoodData Central"
    unknown = analyze(client, h, "250ml milk and 0.25g zorbfood").json()
    assert unknown["foods"][0]["amount"] == ""  # no implicit ml->g density
    assert unknown["foods"][0]["quantity"] == 250
    assert unknown["foods"][1]["reference"] is None
    assert unknown["foods"][1]["question"]
    assert unknown["foods"][1]["nutrition_per_100"]["energy_kcal"] is None


@pytest.mark.parametrize(
    "value", ["", " " * 20, "x" * 2001, "\u0000 rice", ", ".join(["rice"] * 16)]
)
def test_bounded_invalid_input(client, value):
    assert analyze(client, register(client, "alice"), value).status_code == 422


@pytest.mark.parametrize("text", ["0g rice", "-2g rice", "1/0 cup rice", "3000g rice"])
def test_invalid_quantities_are_not_guessed(client, text):
    r = analyze(client, register(client, "alice"), text)
    assert r.status_code == 422, r.text


def test_auth_and_ai_off_preserve_manual_path(client):
    assert analyze(client, {}, "rice").status_code == 401
    h = register(client, "alice")
    r = analyze(client, h, "some strange mixed dish", allow_ai=True).json()
    assert r["ai_status"] == "disabled" and len(r["foods"]) == 1 and r["foods"][0]["question"]
    assert "text" in client.get("/api/capabilities", headers=h).json()


def mock_service(tmp_path, handler, **policy_changes):
    from foodlogger.text_input import GeminiText, TextService

    gateway, owner, _ = setup_gateway(tmp_path)
    policy = gateway.policy().model_copy(
        update={"max_input_tokens": 20000, "input_tpm": 1000000, **policy_changes}
    )
    gateway.configure(policy)
    provider = GeminiText(
        api_key="mock-test-key",
        free_tier_confirmed=True,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    return TextService(gateway, provider, ai_enabled=True), gateway, owner


def test_budgeted_ambiguity_one_attempt_schema_and_no_nutrition_from_model(tmp_path):
    from foodlogger.text_input import TextRequest

    calls = []

    def handler(req):
        calls.append(req)
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps(
                                        {
                                            "foods": [
                                                {"text": "mystery green", "search_name": "spinach"}
                                            ]
                                        }
                                    )
                                }
                            ]
                        },
                    }
                ],
                "usageMetadata": {"promptTokenCount": 100, "candidatesTokenCount": 30},
            },
        )

    service, gateway, owner = mock_service(tmp_path, handler)
    request = TextRequest(
        text="mystery green", local_date="2026-10-14", meal_category="lunch", allow_ai=True
    )
    result = service.analyze(request, owner, "text-fallback-key-001")
    assert (
        result["ai_status"] == "used"
        and result["foods"][0]["reference"]["source"] == "USDA FoodData Central"
    )
    assert result["foods"][0]["amount"] == "" and result["foods"][0]["confirmed"] is False
    assert len(calls) == 1 and gateway.summary()["features"]["text"] == 1
    # A retry may keep the deterministic proposal, but cannot consume another attempt.
    assert service.analyze(request, owner, "text-fallback-key-001")["ai_status"] == "unavailable"
    assert len(calls) == 1


@pytest.mark.parametrize("mode", ["429", "timeout", "bad_schema", "oversized", "exhausted"])
def test_failed_ai_is_counted_once_and_deterministic_result_survives(tmp_path, mode):
    from foodlogger.text_input import TextRequest

    calls = []

    def handler(req):
        calls.append(req)
        if mode == "timeout":
            raise httpx.ReadTimeout("mock timeout", request=req)
        if mode == "429":
            return httpx.Response(429)
        if mode == "oversized":
            return httpx.Response(200, content=b"x" * 66000)
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [
                                {
                                    "text": (
                                        '{"foods":[{"text":"made up",'
                                        '"search_name":"rice","calories":10}]}'
                                    )
                                }
                            ]
                        },
                    }
                ]
            },
        )

    service, gateway, owner = mock_service(
        tmp_path,
        handler,
        feature_daily_limits={"photo": 10, "text": 0}
        if mode == "exhausted"
        else {"text": 6, "photo": 10},
    )
    result = service.analyze(
        TextRequest(
            text="strange bowl", local_date="2026-10-14", meal_category="lunch", allow_ai=True
        ),
        owner,
        "text-fallback-key-002",
    )
    assert result["foods"][0]["name"] == "strange bowl" and result["draft"] is None
    assert result["ai_status"] in {"unavailable", "quota"}
    assert len(calls) == (0 if mode == "exhausted" else 1)
    assert gateway.summary()["features"]["text"] == len(calls)


def test_simple_phrase_never_enters_ai_even_when_requested(tmp_path):
    from foodlogger.text_input import TextRequest

    def reject(req):
        raise AssertionError("Ordinary phrase must not call AI")

    service, gateway, owner = mock_service(tmp_path, reject)
    result = service.analyze(
        TextRequest(
            text="200g chicken with rice and salad",
            local_date="2026-10-14",
            meal_category="lunch",
            allow_ai=True,
        ),
        owner,
        "text-fallback-key-003",
    )
    assert result["ai_status"] == "not_needed" and gateway.summary()["used_requests"] == 0
