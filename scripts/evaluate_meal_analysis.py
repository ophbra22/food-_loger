"""Measured small-sample baseline/vision evaluation. No fabricated successes.

python scripts/evaluate_meal_analysis.py --mode baseline
python scripts/evaluate_meal_analysis.py --mode vision  # confirmed free Gemini project
Only licensed manifest images are uploaded. Weighed labels are NEVER sent to vision.
"""

import argparse
import hashlib
import json
import os
import re
import statistics
import time
from datetime import UTC, datetime
from pathlib import Path

from foodlogger.analysis_schemas import AnalysisOptions
from foodlogger.classifier import Classifier, ModelUnavailable
from foodlogger.images import decode_image
from foodlogger.meal_analysis import AnalysisService
from foodlogger.nutrition import Catalog
from foodlogger.vision import VisionQuotaExceeded, VisionUnavailable

ROOT = Path("evaluations/meal_analysis")
LABELS = {
    "sausage": ["sausage"],
    "spinach": ["spinach"],
    "almond": ["almond"],
    "apple": ["apple"],
    "yam": ["yam", "sweet potato"],
    "honeydew": ["honeydew"],
    "potato": ["potato"],
    "bacon": ["bacon"],
    "cauliflower": ["cauliflower"],
    "steak": ["steak", "beef"],
    "chicken": ["chicken"],
    "oatmeal": ["oatmeal", "porridge"],
    "cantaloupe": ["cantaloupe", "rockmelon"],
    "grape": ["grape"],
    "blackberry": ["blackberr"],
    "strawberry": ["strawberr"],
    "raspberry": ["raspberr"],
    "egg": ["egg"],
}


def canonical(name):
    text = name.lower().replace("_", " ")
    # Match at word starts so 'grape' does not match a substring in an unrelated word.
    for label, aliases in LABELS.items():
        if any(re.search(r"\b" + re.escape(alias), text) for alias in aliases):
            return label
    return text


def detection(expected, predicted):
    remaining = [canonical(x) for x in expected]
    tp = 0
    for name in predicted:
        label = canonical(name)
        if label in remaining:
            remaining.remove(label)
            tp += 1
    return {"tp": tp, "fp": len(predicted) - tp, "fn": len(remaining)}


def summarize(rows):
    successful = [row for row in rows if row.get("status") == "ok"]
    counts = {
        k: sum(row.get("detection", {}).get(k, 0) for row in successful) for k in ["tp", "fp", "fn"]
    }

    def ratio(a, b):
        return None if b == 0 else a / b

    values = {
        k: [
            row["absolute_error"][k]
            for row in successful
            if row.get("absolute_error", {}).get(k) is not None
        ]
        for k in ["grams", "calories", "protein", "fat", "carbs"]
    }
    return {
        "completed": len(successful),
        "failed_or_blocked": len(rows) - len(successful),
        "completion_rate": ratio(len(successful), len(rows)),
        **counts,
        "precision": ratio(counts["tp"], counts["tp"] + counts["fp"]),
        "recall": ratio(counts["tp"], counts["tp"] + counts["fn"]),
        "end_to_end_recall": (
            ratio(counts["tp"], sum(row["expected_food_count"] for row in rows))
            if rows and all(row.get("expected_food_count") is not None for row in rows)
            else None
        ),
        "missed_item_rate": ratio(counts["fn"], counts["tp"] + counts["fn"]),
        "false_discovery_rate": ratio(counts["fp"], counts["tp"] + counts["fp"]),
        "mean_latency_ms": statistics.mean([r["elapsed_ms"] for r in successful])
        if successful
        else None,
        "mean_absolute_error": {k: statistics.mean(v) if v else None for k, v in values.items()},
        "error_sample_counts": {k: len(v) for k, v in values.items()},
        "paid_api_cost_usd": 0,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["baseline", "vision"], required=True)
    parser.add_argument("--output")
    parser.add_argument("--interval-seconds", type=float, default=13)
    args = parser.parse_args()
    if args.interval_seconds < 0:
        parser.error("--interval-seconds must be nonnegative")
    env = Path(".env")
    if env.exists():
        for line in env.read_text().splitlines():
            name, sep, value = line.partition("=")
            if sep and name in {"GEMINI_API_KEY", "FOODLOGGER_GEMINI_FREE_TIER_CONFIRMED"}:
                os.environ.setdefault(name, value.strip().strip('"'))
    manifest = json.loads((ROOT / "manifest.json").read_text())
    engine = Classifier(Catalog()) if args.mode == "baseline" else AnalysisService()
    rows = []
    quota_exhausted = False
    for case in manifest["cases"]:
        row = {
            "id": case["id"],
            "expected_food_count": (
                len(case["visible_food_labels"])
                if case["visible_food_labels"] is not None
                else None
            ),
        }
        if quota_exhausted:
            rows.append({**row, "status": "blocked", "reason": "Quota reached"})
            continue
        if rows and args.mode == "vision":
            time.sleep(args.interval_seconds)
        image = (ROOT / case["file"]).read_bytes()
        if hashlib.sha256(image).hexdigest() != case["sha256"]:
            raise ValueError("Evaluation image hash changed: " + case["id"])
        begin = time.perf_counter()
        try:
            if args.mode == "baseline":
                with decode_image(image) as decoded:
                    output = engine.predict(decoded)
                predicted = (
                    [output["candidates"][0]["name"]] if output["status"] == "recognized" else []
                )
                absolute_error = {}  # Baseline has no automatic portion or nutrient estimate.
            else:
                result = engine.analyze(
                    [image], AnalysisOptions(language="en"), "public-evaluation", case["id"]
                )
                output = result.model_dump()
                predicted = [f.search_name for f in result.foods]
                absolute_error = {}
                if case["expected_status"] != "no_food":
                    estimate = {
                        **result.total,
                        "grams": sum(f.estimated_weight_g for f in result.foods),
                    }
                    for key, actual in case["reference_total"].items():
                        absolute_error[key] = (
                            None if estimate[key] is None else abs(estimate[key] - actual)
                        )
            row.update(
                status="ok",
                elapsed_ms=round((time.perf_counter() - begin) * 1000),
                predicted=predicted,
                output=output,
                absolute_error=absolute_error,
            )
            if case["visible_food_labels"] is not None:
                row["detection"] = detection(case["visible_food_labels"], predicted)
            rows.append(row)
            print(case["id"], row["elapsed_ms"], predicted, flush=True)
        except (VisionUnavailable, ModelUnavailable) as error:
            quota_exhausted = isinstance(error, VisionQuotaExceeded)
            cause = error.__cause__
            upstream_status = getattr(getattr(cause, "response", None), "status_code", None)
            rows.append(
                {
                    **row,
                    "status": "failed",
                    "reason": str(error),
                    "cause_type": type(cause).__name__ if cause else None,
                    "upstream_status": upstream_status,
                    "elapsed_ms": round((time.perf_counter() - begin) * 1000),
                }
            )
            print(case["id"], "failed", str(error), upstream_status, flush=True)
    report = {
        "mode": args.mode,
        "evaluated_at": datetime.now(UTC).isoformat(),
        "provider": getattr(getattr(engine, "provider", None), "name", None),
        "model": getattr(getattr(engine, "provider", None), "model", None),
        "manifest_sha256": hashlib.sha256((ROOT / "manifest.json").read_bytes()).hexdigest(),
        "summary": summarize(rows),
        "results": rows,
        "limitations": [
            "8-image convenience sample, not representative accuracy.",
            "Presence labels reviewed by implementation agent; no independent human adjudication.",
            "Alias matching is a transparent label proxy, not an LLM judge.",
            "Precision/recall are conditional on successful responses. End-to-end recall "
            "counts failed/blocked images as missed expected components.",
            "Baseline provides at most one accepted item and no weight estimate.",
            "Zero paid API calls; electricity and hardware costs are not measured.",
            *manifest["coverage_gaps"],
        ],
    }
    path = Path(args.output) if args.output else ROOT / (args.mode + "-report.json")
    path.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report["summary"], indent=2))


if __name__ == "__main__":
    main()
