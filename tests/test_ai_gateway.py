"""Quota enforcement uses only disposable DBs and mocked transports."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime

import httpx
import pytest

from foodlogger.analysis_schemas import AnalysisOptions
from foodlogger.auth import AuthStore
from foodlogger.storage import Journal
from foodlogger.vision import GeminiVision, VisionQuotaExceeded, VisionUnavailable


def setup_gateway(tmp_path, **changes):
    from foodlogger.ai_gateway import AIGateway, BudgetPolicy

    journal = Journal(tmp_path / "gateway.db")
    auth = AuthStore(journal.database)
    user, _ = auth.register("alice", "local-mocked-password-2026")
    clock = [datetime(2026, 10, 13, 18, tzinfo=UTC).timestamp()]
    gateway = AIGateway(journal.database, "fixture-project", enabled=True, now=lambda: clock[0])
    policy = BudgetPolicy(
        project_id="fixture-project",
        provider="gemini-free",
        model="gemini-3.5-flash-lite",
        daily_limit=10,
        rpm=100,
        input_tpm=100000,
        photo_reserve=4,
        user_daily_limit=100,
        max_input_tokens=100,
        feature_daily_limits={"text": 6, "photo": 10},
        enabled=True,
        verified_at="2026-10-13T12:00:00Z",
        **changes,
    )
    gateway.configure(policy)
    return gateway, user["id"], clock


def test_100_atomic_requests_respect_total_and_photo_reserve_across_instances(tmp_path):
    from foodlogger.ai_gateway import AIGateway

    gateway, owner, clock = setup_gateway(tmp_path)

    def reserve(i):
        other = AIGateway(gateway.database, "fixture-project", enabled=True, now=lambda: clock[0])
        try:
            return other.reserve(owner, "text", f"request-key-{i:08}", "a" * 64, 0)
        except VisionQuotaExceeded:
            return None

    with ThreadPoolExecutor(16) as pool:
        results = list(pool.map(reserve, range(100)))
    assert sum(x is not None for x in results) == 6
    for i in range(4):
        gateway.reserve(owner, "photo", f"photo-request-{i:08}", "b" * 64, 0)
    with pytest.raises(VisionQuotaExceeded):
        gateway.reserve(owner, "photo", "exhausted-request-key", "c" * 64, 0)
    summary = gateway.summary()
    assert summary["used_requests"] == 10 and summary["photo_remaining"] == 0
    assert summary["unknown_cost_attempts"] == 10


def test_duplicate_keys_digest_conflict_release_and_uncertain_consumption(tmp_path):
    gateway, owner, _ = setup_gateway(tmp_path)
    attempt = gateway.reserve(owner, "photo", "stable-analysis-key", "a" * 64, 0)
    with pytest.raises(VisionUnavailable):
        gateway.reserve(owner, "photo", "stable-analysis-key", "a" * 64, 0)
    with pytest.raises(ValueError):
        gateway.reserve(owner, "photo", "stable-analysis-key", "b" * 64, 0)
    gateway.settle(attempt, "released")
    assert gateway.summary()["used_requests"] == 0
    second = gateway.reserve(owner, "photo", "different-analysis-key", "a" * 64, 0)
    gateway.mark_dispatched(second)
    with pytest.raises(ValueError):
        gateway.settle(second, "released")
    gateway.settle(second, "uncertain")
    assert gateway.summary()["used_requests"] == 1


def test_provider_day_reset_and_rolling_rpm_token_window(tmp_path):

    gateway, owner, clock = setup_gateway(tmp_path)
    p = gateway.policy()
    p.rpm = 1
    p.input_tpm = 100
    gateway.configure(p)
    clock[0] = datetime(2026, 10, 14, 6, 59, 59, tzinfo=UTC).timestamp()  # 23:59:59 Pacific
    gateway.reserve(owner, "photo", "last-pacific-day-key", "a" * 64, 0)
    clock[0] += 2
    assert gateway.summary()["used_requests"] == 0
    with pytest.raises(VisionQuotaExceeded):
        gateway.reserve(owner, "photo", "new-pacific-day-key", "b" * 64, 0)
    clock[0] += 60
    gateway.reserve(owner, "photo", "new-pacific-day-key", "b" * 64, 0)
    assert gateway.summary()["used_requests"] == 1


def test_retry_counts_every_transport_attempt_and_timeout_never_refunds(tmp_path):
    gateway, owner, _ = setup_gateway(tmp_path)
    calls = []

    def respond(request):
        calls.append(request)
        if len(calls) == 1:
            return httpx.Response(503, json={})
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
                                        '{"meal_name":"Empty plate","status":"no_food",'
                                        '"foods":[],"warnings":[]}'
                                    )
                                }
                            ]
                        },
                    }
                ],
                "usageMetadata": {"promptTokenCount": 42, "candidatesTokenCount": 20},
            },
        )

    provider = GeminiVision(
        api_key="mock-key",
        free_tier_confirmed=True,
        sleep=lambda _: None,
        client=httpx.Client(transport=httpx.MockTransport(respond)),
    )
    result, usage = gateway.recognize(
        provider, [b"fixture"], AnalysisOptions(), owner, "mocked-provider-key", "a" * 64
    )
    assert result.status == "no_food" and usage["input_tokens"] == 42
    assert len(calls) == 2 and gateway.summary()["used_requests"] == 2

    def timeout(request):
        raise httpx.ReadTimeout("fixture timeout")

    provider.client = httpx.Client(transport=httpx.MockTransport(timeout))
    with pytest.raises(VisionUnavailable):
        gateway.recognize(
            provider, [b"fixture"], AnalysisOptions(), owner, "timeout-provider-key", "b" * 64
        )
    assert gateway.summary()["used_requests"] == 3


def test_disabled_or_unverified_policy_never_dispatches(tmp_path):
    gateway, owner, _ = setup_gateway(tmp_path)

    def forbidden(request):
        raise AssertionError("No transport is authorized")

    provider = GeminiVision(
        api_key="mock-key",
        free_tier_confirmed=True,
        client=httpx.Client(transport=httpx.MockTransport(forbidden)),
    )
    p = gateway.policy()
    p.verified_at = None
    gateway.configure(p)
    with pytest.raises(VisionUnavailable):
        gateway.recognize(
            provider, [b"fixture"], AnalysisOptions(), owner, "disabled-provider-key", "a" * 64
        )
    assert gateway.summary()["used_requests"] == 0


def test_account_erasure_keeps_anonymous_quota_but_no_food_content(tmp_path):
    gateway, owner, _ = setup_gateway(tmp_path)
    attempt = gateway.reserve(owner, "photo", "erasure-analysis-key", "a" * 64, 0)
    gateway.mark_dispatched(attempt)
    gateway.settle(attempt, "consumed", input_tokens=42, output_tokens=20)
    AuthStore(gateway.database).delete_account(owner, "local-mocked-password-2026")
    assert gateway.summary()["used_requests"] == 1
    with gateway.database.connect() as db:
        row = dict(db.execute("SELECT * FROM ai_attempts WHERE id=?", (attempt,)).fetchone())
        assert row["user_id"] is None
        assert row["cost_microusd"] is None
        assert not ({"image", "context", "result", "prompt", "food_name"} & row.keys())


def test_dispatch_rechecks_kill_switch_and_rejects_stale_reservation(tmp_path):
    gateway, owner, clock = setup_gateway(tmp_path)
    identity = gateway.reserve(owner, "photo", "stale-reservation-key", "a" * 64, 0)
    clock[0] += 2
    with pytest.raises(VisionUnavailable):
        gateway.mark_dispatched(identity)
    fresh = gateway.reserve(owner, "photo", "disabled-reserve-key", "a" * 64, 0)
    policy = gateway.policy()
    policy.enabled = False
    gateway.configure(policy)
    with pytest.raises(VisionUnavailable):
        gateway.mark_dispatched(fresh)


def test_expired_policy_and_underestimated_tokens_disable_readiness(tmp_path):
    gateway, owner, clock = setup_gateway(tmp_path)
    identity = gateway.reserve(owner, "photo", "underestimate-key-1", "a" * 64, 0)
    gateway.mark_dispatched(identity)
    gateway.settle(identity, "consumed", input_tokens=101)
    assert gateway.summary()["enabled"] is False
    p = gateway.policy()
    p.enabled = True
    gateway.configure(p)
    clock[0] += p.verification_ttl_seconds + 1
    assert gateway.summary()["enabled"] is False


def test_analysis_cache_and_restart_do_not_spend_twice(tmp_path):
    from test_meal_analysis_pipeline import photo

    from foodlogger.meal_analysis import AnalysisService

    gateway, owner, _ = setup_gateway(tmp_path)
    calls = []

    def respond(request):
        calls.append(request)
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
                                        '{"meal_name":"Empty","status":"no_food",'
                                        '"foods":[],"warnings":[]}'
                                    )
                                }
                            ]
                        },
                    }
                ]
            },
        )

    provider = GeminiVision(
        api_key="mock-key",
        free_tier_confirmed=True,
        client=httpx.Client(transport=httpx.MockTransport(respond)),
    )
    service = AnalysisService(provider, gateway=gateway)
    first = service.analyze([photo()], AnalysisOptions(), owner, "cached-analysis-key")
    assert service.analyze([photo()], AnalysisOptions(), owner, "cached-analysis-key") == first
    assert len(calls) == 1
    with pytest.raises(VisionUnavailable):
        AnalysisService(provider, gateway=gateway).analyze(
            [photo()], AnalysisOptions(), owner, "cached-analysis-key"
        )
    assert len(calls) == 1


def test_dispatch_rejects_a_reduced_budget_policy(tmp_path):
    gateway, owner, _ = setup_gateway(tmp_path)
    identity = gateway.reserve(owner, "photo", "policy-version-key", "a" * 64, 0)
    policy = gateway.policy()
    policy.rpm = 0
    gateway.configure(policy)
    with pytest.raises(VisionUnavailable):
        gateway.mark_dispatched(identity)


def test_model_switch_between_prepare_and_reservation_never_sends(tmp_path, monkeypatch):
    gateway, owner, _ = setup_gateway(tmp_path)
    original = gateway.reserve

    def switching(*args, **kwargs):
        policy = gateway.policy()
        policy.model = "gemini-3.6-flash"
        gateway.configure(policy)
        return original(*args, **kwargs)

    monkeypatch.setattr(gateway, "reserve", switching)
    calls = []
    provider = GeminiVision(
        api_key="mock-key",
        free_tier_confirmed=True,
        client=httpx.Client(
            transport=httpx.MockTransport(lambda r: calls.append(r) or httpx.Response(500))
        ),
    )
    with pytest.raises(VisionUnavailable):
        gateway.recognize(
            provider, [b"fixture"], AnalysisOptions(), owner, "policy-switch-key", "a" * 64
        )
    assert calls == []
