import json

import httpx
import pytest

from foodlogger.analysis_schemas import AnalysisOptions
from foodlogger.vision import GeminiVision, VisionQuotaExceeded, VisionUnavailable


def test_gemini_uses_images_schema_and_header_secret_without_user_identity():
    def respond(request):
        assert request.url.host == "generativelanguage.googleapis.com"
        assert not request.url.query
        assert request.headers["x-goog-api-key"] == "test-secret"
        body = json.loads(request.content)
        assert body["store"] is False
        assert len(body["contents"][0]["parts"]) == 3
        schema = body["generationConfig"]["responseJsonSchema"]
        assert (
            schema["properties"]["foods"]["items"]["properties"]["estimated_weight_g"]["type"]
            == "number"
        )
        assert "$ref" not in json.dumps(schema)
        assert "maxItems" not in json.dumps(schema)
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
                                            "meal_name": "Empty plate",
                                            "status": "no_food",
                                            "foods": [],
                                            "warnings": [],
                                        }
                                    )
                                }
                            ]
                        },
                    }
                ],
                "usageMetadata": {"promptTokenCount": 42, "candidatesTokenCount": 20},
            },
        )

    engine = GeminiVision(
        api_key="test-secret",
        free_tier_confirmed=True,
        client=httpx.Client(transport=httpx.MockTransport(respond)),
    )
    result, usage = engine.recognize([b"one", b"two"], AnalysisOptions())
    assert result.status == "no_food" and usage["input_tokens"] == 42


def test_unknown_billing_state_never_sends_a_request():
    calls = []
    engine = GeminiVision(
        api_key="test",
        free_tier_confirmed=False,
        client=httpx.Client(transport=httpx.MockTransport(lambda r: calls.append(r))),
    )
    with pytest.raises(VisionUnavailable, match="Free Tier"):
        engine.recognize([b"photo"], AnalysisOptions())
    assert calls == []


def test_free_quota_exhaustion_does_not_retry_or_change_provider():
    calls = []

    def respond(request):
        calls.append(request)
        return httpx.Response(429, json={"error": {"message": "private detail"}})

    engine = GeminiVision(
        api_key="test",
        free_tier_confirmed=True,
        client=httpx.Client(transport=httpx.MockTransport(respond)),
    )
    with pytest.raises(VisionQuotaExceeded):
        engine.recognize([b"photo"], AnalysisOptions())
    assert len(calls) == 1


@pytest.mark.parametrize(
    "body",
    [
        [],
        {"candidates": []},
        {"candidates": [{"finishReason": "MAX_TOKENS"}]},
        {"candidates": [{"finishReason": "SAFETY"}]},
    ],
)
def test_gemini_incomplete_or_refused_output_fails_closed(body):
    engine = GeminiVision(
        api_key="test",
        free_tier_confirmed=True,
        client=httpx.Client(
            transport=httpx.MockTransport(lambda _: httpx.Response(200, json=body))
        ),
    )
    with pytest.raises(VisionUnavailable):
        engine.recognize([b"photo"], AnalysisOptions())
