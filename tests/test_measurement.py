"""Offline aggregate arithmetic: synthetic data only, never observed release metrics."""

import copy

import pytest

from foodlogger.measurement import InvalidMeasurement, analyze, empty_bundle


def bundle(metrics=None, kind="synthetic"):
    return {
        "schema_version": 1,
        "evidence_kind": kind,
        "window": {"start": "2026-01-01T00:00:00Z", "end": "2026-01-08T00:00:00Z"},
        "release_commit": None,
        "source_sha256": None,
        "metrics": metrics or {},
    }


def ratio(n, d, coverage="complete"):
    return {"coverage": coverage, "numerator": n, "denominator": d}


def row(report, name):
    return next(r for r in report["metrics"] if r["id"] == name)


def test_empty_has_no_window_or_metrics_and_never_implies_success():
    report = analyze(empty_bundle())
    assert report["acceptance"] == "BLOCKED"
    assert report["evidence_kind"] == "none"
    assert report["window"] is None
    assert len(report["metrics"]) == 22
    assert all(r["value"] is None and r["status"] == "not_measured" for r in report["metrics"])


def test_rates_means_cost_and_explicit_zero_have_distinct_units():
    report = analyze(
        bundle(
            {
                "photo_to_save_rate": ratio(3, 4),
                "save_failure_rate": ratio(0, 100),
                "logged_days_per_user_week": ratio(9, 2),
                "provider_cost_usd": {"coverage": "complete", "total_usd": "0.012345"},
                "widget_refresh_attempts": {"coverage": "complete", "count": 0},
            }
        )
    )
    assert row(report, "photo_to_save_rate")["value"] == 75
    assert row(report, "photo_to_save_rate")["sample_count"] == 4
    assert row(report, "save_failure_rate")["value"] == 0
    assert row(report, "logged_days_per_user_week")["value"] == 4.5
    assert row(report, "provider_cost_usd")["value"] == "0.012345"
    assert row(report, "widget_refresh_attempts")["value"] == 0
    assert row(report, "recipe_uses")["value"] is None
    assert report["acceptance"] == "BLOCKED"


def test_zero_samples_and_partial_coverage_are_inconclusive():
    report = analyze(
        bundle(
            {
                "crash_free_session_rate": ratio(0, 0),
                "photo_to_save_rate": ratio(3, 4, "partial"),
                "recipe_uses": {"coverage": "partial", "count": 20},
                "provider_cost_usd": {"coverage": "partial", "total_usd": "1.50"},
            }
        )
    )
    assert row(report, "crash_free_session_rate")["status"] == "no_samples"
    assert row(report, "photo_to_save_rate")["sample_count"] == 4
    for name in (
        "crash_free_session_rate",
        "photo_to_save_rate",
        "recipe_uses",
        "provider_cost_usd",
    ):
        assert row(report, name)["value"] is None
    assert row(report, "recipe_uses")["status"] == "partial"


def histogram(counts=(1, 3), overflow=0, coverage="complete"):
    return {
        "coverage": coverage,
        "buckets": [
            {"upper_bound_ms": 100, "count": counts[0]},
            {"upper_bound_ms": 500, "count": counts[1]},
        ],
        "overflow": overflow,
    }


def test_histogram_quantiles_are_bounds_not_exact_percentiles():
    result = row(analyze(bundle({"repeat_log_latency_ms": histogram()})), "repeat_log_latency_ms")
    assert result["sample_count"] == 4
    assert result["value"] == {"p50": {"upper_bound_ms": 500}, "p95": {"upper_bound_ms": 500}}


def test_histogram_overflow_cannot_be_reported_as_upper_bound():
    result = row(
        analyze(bundle({"db_query_latency_ms": histogram((1, 0), 19)})), "db_query_latency_ms"
    )
    assert result["value"] == {"p50": {"greater_than_ms": 500}, "p95": {"greater_than_ms": 500}}
    assert result["sample_count"] == 20


@pytest.mark.parametrize("coverage,status", [("complete", "no_samples"), ("partial", "partial")])
def test_histogram_empty_or_partial_has_no_quantiles(coverage, status):
    r = row(
        analyze(bundle({"db_query_latency_ms": histogram((0, 0), 0, coverage)})),
        "db_query_latency_ms",
    )
    assert r["value"] is None
    assert r["status"] == status


@pytest.mark.parametrize(
    "value", [True, False, -1, 1.5, float("nan"), float("inf"), "1", None, 1_000_000_001]
)
def test_invalid_counts_rejected_without_echoing(value):
    with pytest.raises(InvalidMeasurement, match="^Invalid aggregate bundle\\.$"):
        analyze(bundle({"save_failure_rate": ratio(value, 2)}))


@pytest.mark.parametrize(
    "metrics",
    [
        {"save_failure_rate": ratio(3, 2)},
        {"save_failure_rate": ratio(1, 0)},
        {"logged_days_per_user_week": ratio(15, 2)},
        {"logged_days_per_user_week": ratio(1, 0)},
        {"recipe_uses": {"coverage": "estimated", "count": 1}},
        {"recipe_uses": {"coverage": "complete", "count": 1, "user_id": "private"}},
        {"private_meal": {"count": 1}},
        {"db_query_latency_ms": {"coverage": "complete", "buckets": [], "overflow": 0}},
        {
            "db_query_latency_ms": {
                "coverage": "complete",
                "buckets": [{"upper_bound_ms": 1, "count": 1}] * 2,
                "overflow": 0,
            }
        },
        {
            "db_query_latency_ms": {
                "coverage": "complete",
                "buckets": [{"upper_bound_ms": 2, "count": 1}, {"upper_bound_ms": 1, "count": 1}],
                "overflow": 0,
            }
        },
        {
            "db_query_latency_ms": {
                "coverage": "complete",
                "buckets": [{"upper_bound_ms": 0, "count": 1}],
                "overflow": 0,
            }
        },
        {"db_query_latency_ms": histogram((1_000_000_000, 1), 0)},
    ],
)
def test_contradictory_or_unknown_aggregates_rejected(metrics):
    with pytest.raises(InvalidMeasurement):
        analyze(bundle(metrics))


@pytest.mark.parametrize(
    "cost", ["-1", "NaN", "Infinity", "1e9", "0.0000001", "1000000001", 1.5, True, "01", "<script>"]
)
def test_cost_requires_bounded_explicit_decimal_usd(cost):
    with pytest.raises(InvalidMeasurement):
        analyze(bundle({"provider_cost_usd": {"coverage": "complete", "total_usd": cost}}))


@pytest.mark.parametrize(
    "change",
    [
        {"schema_version": True},
        {"schema_version": 2},
        {"user_id": "private"},
        {"evidence_kind": "production_verified"},
        {"evidence_kind": "none"},
        {"window": None},
        {"metrics": []},
        {"window": {"start": "2026-01-08T00:00:00Z", "end": "2026-01-01T00:00:00Z"}},
        {"window": {"start": "2026-01-01", "end": "2026-01-02"}},
        {"window": {"start": "2026-01-01T00:00:00Z", "end": "2026-01-01T00:00:00Z"}},
        {"window": {"start": "2026-02-30T00:00:00Z", "end": "2026-03-02T00:00:00Z"}},
        {"release_commit": "not-a-hash"},
        {"source_sha256": "https://private.example"},
    ],
)
def test_invalid_envelope_rejected(change):
    b = bundle()
    b.update(change)
    with pytest.raises(InvalidMeasurement):
        analyze(b)


def test_declared_observations_require_digests_but_never_become_verified():
    b = bundle({"save_failure_rate": ratio(0, 100)}, "unverified_observation")
    with pytest.raises(InvalidMeasurement):
        analyze(b)
    b.update(release_commit="a" * 40, source_sha256="b" * 64)
    report = analyze(b)
    assert report["evidence_kind"] == "unverified_observation"
    assert report["acceptance"] == "BLOCKED"
    assert "unverified" in report["notice"].lower()
    assert row(report, "save_failure_rate")["value"] == 0


def test_analyzer_does_not_mutate_input_or_alias_aggregate():
    b = bundle({"save_failure_rate": ratio(0, 100)})
    before = copy.deepcopy(b)
    report = analyze(b)
    assert b == before
    row(report, "save_failure_rate")["aggregate"]["numerator"] = 2
    assert b == before


def test_none_cannot_contain_observations_even_with_empty_window():
    b = empty_bundle()
    b["metrics"] = {"recipe_uses": {"coverage": "complete", "count": 0}}
    with pytest.raises(InvalidMeasurement):
        analyze(b)
