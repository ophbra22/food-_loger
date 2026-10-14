import json

import httpx
import pytest
from test_ai_gateway import setup_gateway

from foodlogger.label_input import (
    GeminiLabel,
    LabelObservation,
    LabelService,
    normalize_label,
    parse_label_text,
)
from foodlogger.vision import VisionUnavailable


def observation(fields=None, **extra):
    return LabelObservation.model_validate(
        {
            "name": "Test label",
            "columns": [
                {
                    "quantity": 100,
                    "basis": "g",
                    "fields": fields
                    or [
                        {
                            "nutrient": "energy_kcal",
                            "value": "95",
                            "unit": "kcal",
                            "evidence": "95 kcal",
                            "confidence": "high",
                        }
                    ],
                }
            ],
            **extra,
        }
    )


def test_kcal_kj_sodium_salt_missing_and_uncertain():
    fields = [
        {"nutrient": k, "value": v, "unit": u, "evidence": v + " " + u, "confidence": c}
        for k, v, u, c in [
            ("energy_kcal", "95", "kcal", "high"),
            ("energy_kj", "399", "kJ", "high"),
            ("sodium_mg", "0.35", "g", "high"),
            ("salt_g", "0.9", "g", "high"),
            ("protein_g", "<0.5", "g", "high"),
            ("fat_g", "5", "g", "low"),
        ]
    ]
    r = normalize_label(observation(fields))
    assert r["product"]["nutrition"]["calories"] == 95
    assert r["product"]["nutrition"]["sodium"] == 0.35
    assert r["product"]["nutrition"]["protein"] is None and r["product"]["nutrition"]["fat"] is None
    assert r["confirmed"] is False and r["observations"]["columns"][0]["fields"] == fields
    assert "protein" in r["product"]["missing_nutrients"] and r["warnings"]


def test_per_serving_and_dual_basis_preserved_never_add_columns():
    raw = observation().model_dump()
    raw["columns"][0]["quantity"] = 25
    raw["columns"][0]["fields"][0]["value"] = "100"
    raw["columns"].append(
        {
            "quantity": 100,
            "basis": "g",
            "fields": [
                {
                    "nutrient": "energy_kcal",
                    "value": "410",
                    "unit": "kcal",
                    "evidence": "410",
                    "confidence": "high",
                }
            ],
        }
    )
    r = normalize_label(LabelObservation.model_validate(raw))
    assert r["product"]["nutrition"]["calories"] == 410
    assert len(r["observations"]["columns"]) == 2 and r["product"]["serving_quantity"] == 25
    assert "conflicting_columns" in r["warnings"]
    r = normalize_label(LabelObservation.model_validate({**raw, "columns": raw["columns"][:1]}))
    assert r["product"]["nutrition"]["calories"] == 400
    with pytest.raises(ValueError):
        normalize_label(
            LabelObservation.model_validate(
                {**raw, "columns": [{**raw["columns"][0], "quantity": None}]}
            )
        )


def test_hebrew_english_transcription_and_unknown_units():
    for text in [
        "Test\nper 100 ml\nenergy 418.4 kJ\nprotein 3 g\nsalt 0.5 g",
        "מוצר\nל-100 מ״ל\nאנרגיה 418.4 ק״גול\nחלבונים 3 גרם\nמלח 0.5 גרם",
    ]:
        r = normalize_label(parse_label_text(text))
        assert r["product"]["basis_unit"] == "ml"
        assert r["product"]["nutrition"]["calories"] == 100
        assert r["product"]["nutrition"]["sodium"] == 0.2
    with pytest.raises(ValueError):
        parse_label_text("nutrition without a known basis")
    r = normalize_label(parse_label_text("Test\n100 g\nprotein 3 oz\nfat ? g"))
    assert r["product"]["nutrition"]["protein"] is None


@pytest.mark.parametrize("bad", ["NaN", "Infinity", "-1", "1e100", "101"])
def test_bad_mass_is_unknown_not_trusted(bad):
    r = normalize_label(
        observation(
            [
                {
                    "nutrient": "protein_g",
                    "value": bad,
                    "unit": "g",
                    "evidence": bad,
                    "confidence": "high",
                }
            ]
        )
    )
    assert r["product"]["nutrition"]["protein"] is None


def test_gateway_ocr_is_mocked_metered_once_and_disabled_is_fail_closed(tmp_path):
    gateway, owner, _ = setup_gateway(tmp_path)
    gateway.configure(
        gateway.policy().model_copy(
            update={
                "feature_daily_limits": {"photo": 5, "ocr": 2},
                "max_input_tokens": 20000,
                "input_tpm": 1000000,
            }
        )
    )
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {"parts": [{"text": observation().model_dump_json()}]},
                    }
                ],
                "usageMetadata": {"promptTokenCount": 100, "candidatesTokenCount": 50},
            },
        )

    provider = GeminiLabel(
        api_key="mock-test-key",
        free_tier_confirmed=True,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    with pytest.raises(VisionUnavailable):
        LabelService(gateway, provider).extract(b"fixture", "en", owner, "label-test-key-001")
    assert not calls
    service = LabelService(gateway, provider, enabled=True)
    result = service.extract(b"fixture", "he", owner, "label-test-key-001")
    assert result["product"]["nutrition"]["calories"] == 95 and result["confirmed"] is False
    with pytest.raises(VisionUnavailable):
        service.extract(b"fixture", "he", owner, "label-test-key-001")
    assert len(calls) == 1 and gateway.summary()["features"]["ocr"] == 1


def test_upload_and_transcription_are_authenticated_unsaved_and_bounded(tmp_path):
    from fastapi.testclient import TestClient
    from test_meal_analysis_pipeline import register

    from foodlogger.app import create_app
    from foodlogger.security import Settings

    with TestClient(create_app(tmp_path / "labels.db", settings=Settings())) as c:
        assert c.post("/api/labels/parse", json={"text": "X\n100 g"}).status_code == 401
        h = register(c, "alice")
        r = c.post(
            "/api/labels/parse",
            headers=h,
            json={"text": "Product 250 g\nper 100 g\nprotein 10 g\nenergy 95 kcal"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["product"]["nutrition"]["protein"] == 10
        assert r.json()["observations"]["columns"][0]["quantity"] == "100"
        assert c.post("/api/labels/parse", headers=h, json={"text": "x" * 8001}).status_code == 422
        assert (
            c.post(
                "/api/labels/extract",
                headers={**h, "Idempotency-Key": "label-request-test"},
                files={"file": ("x.jpg", b"bad", "image/jpeg")},
            ).status_code
            == 503
        )
        assert c.get("/api/meals?day=2026-10-14", headers=h).json()["meals"] == []


def test_duplicate_observations_cannot_restore_a_conflicting_field():
    fields = [
        {
            "nutrient": "protein_g",
            "value": str(i),
            "unit": "g",
            "evidence": str(i),
            "confidence": "high",
        }
        for i in [1, 2, 3]
    ]
    assert normalize_label(observation(fields))["product"]["nutrition"]["protein"] is None


def test_real_israeli_product_table_transcription_fixture():
    from pathlib import Path

    fixture = json.loads(
        Path("tests/fixtures/biteflow/israeli-label-transcription.json").read_text()
    )
    result = normalize_label(parse_label_text(fixture["transcription"]))
    for key, value in fixture["expected"].items():
        assert result["product"]["nutrition"][key] == value
    assert result["product"]["nutrition"]["saturated_fat"] is None


def test_mocked_image_upload_orientation_cache_owner_and_failures(tmp_path):
    import base64
    from datetime import UTC, datetime
    from io import BytesIO

    from fastapi.testclient import TestClient
    from PIL import Image
    from test_meal_analysis_pipeline import register

    from foodlogger.app import create_app
    from foodlogger.security import Settings

    gateway, _, _ = setup_gateway(tmp_path)
    policy = gateway.policy().model_copy(
        update={
            "feature_daily_limits": {"photo": 5, "ocr": 5},
            "max_input_tokens": 30000,
            "input_tpm": 1000000,
            "verified_at": datetime.now(UTC),
        }
    )
    calls = []

    def handler(request):
        image = Image.open(
            BytesIO(
                base64.b64decode(
                    json.loads(request.content)["contents"][0]["parts"][1]["inlineData"]["data"]
                )
            )
        )
        calls.append(image.size)
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [{"text": observation(rotation=90).model_dump_json()}]
                        },
                    }
                ]
            },
        )

    provider = GeminiLabel(
        api_key="mock",
        free_tier_confirmed=True,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    app = create_app(
        tmp_path / "uploads.db",
        settings=Settings(ai_enabled=True, ai_project_id="fixture-project", label_ai_enabled=True),
        label_provider=provider,
    )
    app.state.ai_gateway.configure(policy)
    data = BytesIO()
    exif = Image.Exif()
    exif[274] = 6
    Image.new("RGB", (30, 50)).save(data, "JPEG", exif=exif)
    with TestClient(app) as c:
        a = register(c, "alice")
        b = register(c, "bob")

        def upload(headers, key):
            return c.post(
                "/api/labels/extract",
                headers={**headers, "Idempotency-Key": key},
                files={"file": ("label.jpg", data.getvalue(), "image/jpeg")},
                data={"language": "he"},
            )

        r = upload(a, "label-upload-key-001")
        assert r.status_code == 200, r.text
        assert r.json()["observations"]["rotation"] == 90 and not r.json()["cached"]
        assert upload(a, "label-upload-key-001").json()["cached"]
        assert not upload(b, "label-upload-key-002").json()["cached"]
        assert calls == [(50, 30), (50, 30)]
        assert app.state.ai_gateway.summary()["features"]["ocr"] == 2
        assert (
            c.post(
                "/api/labels/extract",
                headers={**a, "Idempotency-Key": "label-upload-bad-01"},
                files={"file": ("bad.jpg", b"not-image", "image/jpeg")},
            ).status_code
            == 422
        )


@pytest.mark.parametrize("failure", ["429", "timeout", "malformed", "oversized"])
def test_label_provider_failures_are_bounded_counted_and_do_not_retry(tmp_path, failure):
    from foodlogger.vision import VisionQuotaExceeded

    gateway, owner, _ = setup_gateway(tmp_path)
    gateway.configure(
        gateway.policy().model_copy(
            update={
                "feature_daily_limits": {"ocr": 5},
                "max_input_tokens": 20000,
                "input_tpm": 1000000,
            }
        )
    )
    calls = []

    def handler(request):
        calls.append(request)
        if failure == "timeout":
            raise httpx.ReadTimeout("mock", request=request)
        if failure == "429":
            return httpx.Response(429)
        if failure == "oversized":
            return httpx.Response(200, content=b"x" * 65537)
        return httpx.Response(200, json={"candidates": []})

    provider = GeminiLabel(
        api_key="mock",
        free_tier_confirmed=True,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    with pytest.raises((ValueError, httpx.HTTPError, VisionQuotaExceeded)):
        LabelService(gateway, provider, enabled=True).extract(
            b"fixture", "he", owner, "label-failure-key-01"
        )
    assert len(calls) == 1 and gateway.summary()["used_requests"] == 1


def test_nutrient_line_is_not_a_declared_label_basis():
    for text in ["Food\nprotein 3 g\nfat 2 g", "Rice 500 g\nprotein 8 g\nfat 1 g"]:
        with pytest.raises(ValueError):
            parse_label_text(text)
