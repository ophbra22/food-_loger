"""Offline, unverified aggregate analysis. No telemetry collection or release certification."""

import re
from copy import deepcopy
from datetime import datetime
from decimal import Decimal

MAX_COUNT = 1_000_000_000
MAX_DURATION_MS = 86_400_000
MAX_BUCKETS = 64

# ID, display label, kind, displayed unit. Definitions/cohorts live in the protocol.
METRICS = (
    ("photo_to_save_rate", "Photo-to-save completion", "rate", "%"),
    ("photo_to_save_latency_ms", "Photo-to-save latency", "histogram", "ms bounds"),
    ("ingredient_correction_rate", "Ingredient corrections", "rate", "%"),
    ("portion_correction_rate", "Portion corrections", "rate", "%"),
    ("text_correction_rate", "Text corrections", "rate", "%"),
    ("ocr_correction_rate", "OCR corrections", "rate", "%"),
    ("confirmation_abandonment_rate", "Confirmation abandonment", "rate", "%"),
    ("repeat_log_latency_ms", "Repeat-log latency", "histogram", "ms bounds"),
    ("logged_days_per_user_week", "Logged days per eligible user-week", "mean", "days/week"),
    ("recipe_uses", "Recipe uses", "count", "uses"),
    ("water_uses", "Water uses", "count", "uses"),
    ("goal_uses", "Goal uses", "count", "uses"),
    ("provider_attempts", "Provider attempts", "count", "attempts"),
    ("provider_429_rate", "Provider 429 responses", "rate", "%"),
    ("provider_cost_usd", "Accounted provider cost", "cost", "USD"),
    ("crash_free_session_rate", "Crash-free sessions", "rate", "%"),
    ("save_failure_rate", "Save failures", "rate", "%"),
    ("db_query_latency_ms", "Database query latency", "histogram", "ms bounds"),
    ("health_duplicate_rate", "Health duplicates", "rate", "%"),
    ("sync_reconciliation_rate", "Sync reconciliation success", "rate", "%"),
    ("widget_refresh_attempts", "Widget refresh attempts", "count", "attempts"),
    ("migration_failure_rate", "Migration failures", "rate", "%"),
)


class InvalidMeasurement(ValueError):
    """Deliberately omits input values that may contain private data."""

    def __init__(self):
        super().__init__("Invalid aggregate bundle.")


def _require(condition):
    if not condition:
        raise InvalidMeasurement()


def _keys(value, expected):
    _require(type(value) is dict and value.keys() == set(expected))


def _count(value):
    _require(type(value) is int and 0 <= value <= MAX_COUNT)
    return value


def _digest(value, length):
    _require(value is None or (type(value) is str and re.fullmatch(f"[0-9a-f]{{{length}}}", value)))


def empty_bundle() -> dict:
    return {
        "schema_version": 1,
        "evidence_kind": "none",
        "window": None,
        "release_commit": None,
        "source_sha256": None,
        "metrics": {},
    }


def _validate_envelope(bundle):
    _keys(bundle, empty_bundle())
    _require(type(bundle["schema_version"]) is int and bundle["schema_version"] == 1)
    kind = bundle["evidence_kind"]
    _require(type(kind) is str and kind in ("none", "synthetic", "unverified_observation"))
    _require(type(bundle["metrics"]) is dict)
    _require(set(bundle["metrics"]).issubset({m[0] for m in METRICS}))
    _digest(bundle["release_commit"], 40)
    _digest(bundle["source_sha256"], 64)
    if kind == "none":
        _require(bundle == empty_bundle())
        return
    window = bundle["window"]
    _keys(window, ("start", "end"))
    dates = []
    for value in (window["start"], window["end"]):
        _require(
            type(value) is str and re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", value)
        )
        try:
            dates.append(datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ"))
        except ValueError:
            raise InvalidMeasurement() from None
    _require(dates[0] < dates[1])
    if kind == "unverified_observation":
        _require(bundle["release_commit"] is not None and bundle["source_sha256"] is not None)


def _histogram(aggregate):
    buckets = aggregate["buckets"]
    _require(type(buckets) is list and 1 <= len(buckets) <= MAX_BUCKETS)
    previous = 0
    total = _count(aggregate["overflow"])
    for bucket in buckets:
        _keys(bucket, ("upper_bound_ms", "count"))
        upper = bucket["upper_bound_ms"]
        _require(type(upper) is int and previous < upper <= MAX_DURATION_MS)
        previous = upper
        total += _count(bucket["count"])
    _count(total)
    quantiles = {}
    if total:
        for name, percentile in (("p50", 50), ("p95", 95)):
            rank = (percentile * total + 99) // 100
            cumulative = 0
            quantiles[name] = {"greater_than_ms": previous}
            for bucket in buckets:
                cumulative += bucket["count"]
                if cumulative >= rank:
                    quantiles[name] = {"upper_bound_ms": bucket["upper_bound_ms"]}
                    break
    return total, quantiles or None


def _aggregate(kind, aggregate):
    fields = {
        "rate": ("numerator", "denominator"),
        "mean": ("numerator", "denominator"),
        "count": ("count",),
        "cost": ("total_usd",),
        "histogram": ("buckets", "overflow"),
    }
    _keys(aggregate, ("coverage", *fields[kind]))
    coverage = aggregate["coverage"]
    _require(type(coverage) is str and coverage in ("complete", "partial"))
    samples = None
    if kind in ("rate", "mean"):
        numerator, samples = _count(aggregate["numerator"]), _count(aggregate["denominator"])
        _require(numerator <= samples * (7 if kind == "mean" else 1))
        value = None if samples == 0 else numerator / samples * (100 if kind == "rate" else 1)
    elif kind == "count":
        value = _count(aggregate["count"])
    elif kind == "cost":
        cost = aggregate["total_usd"]
        _require(type(cost) is str and len(cost) <= 17)
        _require(re.fullmatch(r"(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,6})?", cost))
        _require(Decimal(cost) <= MAX_COUNT)
        value = cost
    else:
        samples, value = _histogram(aggregate)
    status = "partial" if coverage == "partial" else "no_samples" if samples == 0 else "available"
    return status, samples, value if status == "available" else None


def analyze(bundle: dict) -> dict:
    """Validate and summarize declared aggregates; never infer verification or readiness."""
    _validate_envelope(bundle)
    rows = []
    for name, label, kind, unit in METRICS:
        aggregate = bundle["metrics"].get(name)
        if name in bundle["metrics"]:
            status, samples, value = _aggregate(kind, aggregate)
        else:
            status, samples, value = "not_measured", None, None
        rows.append(
            {
                "id": name,
                "label": label,
                "kind": kind,
                "unit": unit,
                "status": status,
                "sample_count": samples,
                "value": value,
                "aggregate": deepcopy(aggregate),
            }
        )
    notices = {
        "none": "No observations supplied. All release and measurement gates remain open.",
        "synthetic": (
            "SYNTHETIC VALIDATION ONLY. These are invented test inputs, not post-release metrics."
        ),
        "unverified_observation": (
            "UNVERIFIED declared observations. Digests and coverage are supplied claims, "
            "not verified provenance, consent, cohort eligibility or release approval."
        ),
    }
    return {
        "schema_version": 1,
        "evidence_kind": bundle["evidence_kind"],
        "notice": notices[bundle["evidence_kind"]],
        "acceptance": "BLOCKED",
        "window": deepcopy(bundle["window"]),
        "declared_release_commit": bundle["release_commit"],
        "declared_source_sha256": bundle["source_sha256"],
        "metrics": rows,
    }
