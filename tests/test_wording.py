"""Mock-only optional wording cannot change facts, IDs, privacy or gateway limits."""

import json

import httpx
import pytest
from test_ai_gateway import setup_gateway


def fixture():
    return dict(
        schema_version=1,
        revision="a" * 64,
        language="en",
        week_start="2026-10-11",
        trends=dict(
            current=dict(
                statistics=dict(
                    logged_days=3,
                    unlogged_days=4,
                    average=dict(calories=200, protein=10, carbs=None, fat=1),
                    calorie_in_range=1,
                    calorie_eligible_days=3,
                )
            ),
            previous=dict(statistics=dict(average=dict(calories=150, protein=8, carbs=10, fat=1))),
        ),
        protein_achievement=dict(met=1, eligible=3, logged=3),
        sentences=[
            dict(id="coverage", text="Recorded on 3 days."),
            dict(id="caution", text="Logs may be incomplete."),
        ],
        ai_status="not_requested",
    )


def service(tmp_path, mode="valid", **policy_changes):
    from foodlogger.wording import GeminiWording, Wording

    gateway, owner, _ = setup_gateway(tmp_path)
    gateway.configure(
        gateway.policy().model_copy(
            update={
                "feature_daily_limits": {"photo": 10, "insight": 6, "recommendation": 6},
                "max_input_tokens": 20000,
                "input_tpm": 1000000,
                **policy_changes,
            }
        )
    )
    captured = []

    def handler(request):
        payload = json.loads(request.content)
        data = json.loads(payload["contents"][0]["parts"][0]["text"])
        captured.append(data)
        if mode == "timeout":
            raise httpx.ReadTimeout("fixture timeout")
        if mode == "429":
            return httpx.Response(429)
        result = dict(
            revision=data["revision"],
            numbers=data["numbers"],
            candidate_ids=data["candidate_ids"],
            choices=[dict(id=s["id"], variant=1) for s in data["sentences"]],
        )
        if mode == "number":
            result["numbers"]["logged_days"] = 7
        if mode == "candidate":
            result["candidate_ids"] = ["invented-food"]
        if mode == "prose":
            result["advice"] = "Skip meals; breakfast was low protein."
        if mode == "missing_caution":
            result["choices"] = result["choices"][:-1]
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {"finishReason": "STOP", "content": {"parts": [{"text": json.dumps(result)}]}}
                ],
                "usageMetadata": {"promptTokenCount": 50, "candidatesTokenCount": 20},
            },
        )

    provider = GeminiWording(
        api_key="mock-test-key",
        free_tier_confirmed=True,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    return Wording(gateway, provider, enabled=True), gateway, owner, captured


def test_valid_wording_retains_all_facts_caches_and_accounts_feature(tmp_path):
    wording, gateway, owner, captured = service(tmp_path)
    doc = fixture()
    result = wording.enhance(owner, "insight", "wording-request-key", doc)
    assert (
        result["ai_status"] == "used"
        and result["sentences"][0]["text"] != doc["sentences"][0]["text"]
    )
    assert (
        result["trends"] == doc["trends"]
        and result["protein_achievement"] == doc["protein_achievement"]
    )
    assert wording.enhance(owner, "insight", "another-request-key", doc) == result
    assert gateway.summary()["used_requests"] == 1
    with gateway.database.connect() as db:
        row = db.execute("SELECT feature,input_tokens,output_tokens FROM ai_attempts").fetchone()
        assert dict(row) == dict(feature="insight", input_tokens=50, output_tokens=20)
    assert "owner" not in json.dumps(captured) and "allergens" not in json.dumps(captured)


@pytest.mark.parametrize(
    "mode", ["number", "candidate", "prose", "missing_caution", "timeout", "429"]
)
def test_bad_or_unavailable_wording_preserves_usable_template(tmp_path, mode):
    wording, gateway, owner, _ = service(tmp_path, mode)
    doc = fixture()
    result = wording.enhance(owner, "insight", "wording-failure-key", doc)
    assert result["sentences"] == doc["sentences"] and result["trends"] == doc["trends"]
    assert result["ai_status"] in ("unavailable", "quota")
    assert gateway.summary()["used_requests"] == 1


def test_exhausted_quota_keeps_templates_without_provider_attempt(tmp_path):
    wording, gateway, owner, captured = service(
        tmp_path, feature_daily_limits={"photo": 10, "insight": 0}
    )
    result = wording.enhance(owner, "insight", "wording-no-budget-key", fixture())
    assert result["ai_status"] == "quota" and result["sentences"] == fixture()["sentences"]
    assert captured == [] and gateway.summary()["used_requests"] == 0


def test_recommendation_wording_never_sends_allergy_list_or_food_names(tmp_path):
    wording, gateway, owner, captured = service(tmp_path)
    doc = dict(
        schema_version=1,
        revision="b" * 64,
        language="he",
        preferences={"allergens": ["milk"]},
        remaining={"calories": 500, "protein": 40, "carbs": None, "fat": None},
        choices=[
            {
                "entry": {"kind": "recipe", "id": "a" * 32, "name": "private secret meal"},
                "servings": 2,
                "nutrition": {"values": {"energy_kcal": 500, "protein_g": 40}},
            }
        ],
        warnings=["check_ingredients"],
        ai_status="not_requested",
    )
    result = wording.enhance(owner, "recommendation", "wording-recommend-key", doc)
    assert result["choices"] == doc["choices"] and result["ai_status"] == "used"
    sent = json.dumps(captured)
    assert "private secret meal" not in sent and "milk" not in sent and "allergens" not in sent
    assert gateway.summary()["used_requests"] == 1


def test_http_wording_stale_revision_and_disabled_fallback(tmp_path):
    from fastapi.testclient import TestClient
    from test_meal_analysis_pipeline import register
    from test_trends import meal

    from foodlogger.app import create_app
    from foodlogger.security import Settings

    class NeverProvider:
        def payload(self, _):
            raise AssertionError("Disabled or stale wording must not reach a provider")

    with TestClient(
        create_app(
            tmp_path / "http.db",
            settings=Settings(insights_enabled=True),
            wording_provider=NeverProvider(),
        )
    ) as c:
        h = register(c, "alice")
        doc = c.get("/api/insights?week_start=2026-10-11", headers=h).json()
        body = dict(date="2026-10-11", language="en", expected_revision=doc["revision"])
        headers = {**h, "Idempotency-Key": "wording-api-request"}
        r = c.post("/api/wording/insight", headers=headers, json=body)
        assert r.status_code == 200 and r.json()["ai_status"] == "disabled"
        assert r.json()["trends"] == doc["trends"]
        meal(c, h, "2026-10-11", 100)
        assert c.post("/api/wording/insight", headers=headers, json=body).status_code == 409
        assert c.post("/api/wording/insight", json=body).status_code == 401
        assert c.post("/api/wording/insight", headers=h, json=body).status_code == 422
