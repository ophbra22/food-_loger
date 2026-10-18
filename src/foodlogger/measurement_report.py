"""Local-only report generation from bounded, strictly shaped aggregate JSON."""

import argparse
import hashlib
import json
import sys
from html import escape
from pathlib import Path

from foodlogger.measurement import InvalidMeasurement, analyze, empty_bundle

MAX_INPUT_BYTES = 256 * 1024


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise InvalidMeasurement()
        result[key] = value
    return result


def _reject_constant(_value):
    raise InvalidMeasurement()


def load_report(source: Path | None) -> dict:
    """Input hashes identify bytes only; they do not establish trustworthy provenance."""
    digest = None
    if source is None:
        bundle = empty_bundle()
    else:
        if not source.is_file():
            raise InvalidMeasurement()
        with source.open("rb") as stream:
            raw = stream.read(MAX_INPUT_BYTES + 1)
        if len(raw) > MAX_INPUT_BYTES:
            raise InvalidMeasurement()
        bundle = json.loads(
            raw.decode("utf-8"), object_pairs_hook=_unique_object, parse_constant=_reject_constant
        )
        digest = hashlib.sha256(raw).hexdigest()
    report = analyze(bundle)
    report["input_sha256"] = digest
    return report


def _display(value):
    if value is None:
        return "—"
    if isinstance(value, float):
        return f"{value:.6g}"
    if isinstance(value, dict):
        return json.dumps(value, sort_keys=True)
    return str(value)


def render_html(report: dict) -> str:
    """A script-free, self-contained dashboard; all displayed values are escaped."""

    def cell(value):
        return escape(_display(value), quote=True)

    rows = []
    for metric in report["metrics"]:
        rows.append(
            "<tr>"
            + "".join(
                f"<td>{cell(value)}</td>"
                for value in (
                    metric["label"],
                    metric["status"],
                    metric["value"],
                    metric["unit"],
                    metric["sample_count"],
                    metric["aggregate"],
                )
            )
            + "</tr>"
        )
    provenance = "".join(
        f"<dt>{cell(label)}</dt><dd>{cell(report[field])}</dd>"
        for label, field in (
            ("Evidence kind", "evidence_kind"),
            ("UTC window [start, end)", "window"),
            ("Input bytes SHA256 (computed)", "input_sha256"),
            ("Release commit (declared, unverified)", "declared_release_commit"),
            ("Source SHA256 (declared, unverified)", "declared_source_sha256"),
        )
    )
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" 
content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>BiteFlow P14 — local measurement preparation</title>
<style>body{{font:16px system-ui,sans-serif;line-height:1.5;
margin:2rem;color:#172b32;background:#fafaf7}}
h1{{font-size:1.8rem}}.notice{{padding:1rem;border:3px solid #805400;background:#fff4d6}}
table{{border-collapse:collapse;width:100%}}
th,td{{padding:.6rem;text-align:left;
border:1px solid #77878b;vertical-align:top}}
th{{background:#e6eeec}}.scroll{{overflow:auto}}dd{{overflow-wrap:anywhere;margin-bottom:.6rem}}
caption{{text-align:left;font-weight:bold;margin:.8rem 0}}</style></head><body>
<h1>BiteFlow measurement dashboard</h1>
<div class="notice"><strong>P14 acceptance: {cell(report["acceptance"])}</strong>
<p>{cell(report["notice"])}</p></div>
<p>Offline preparation only. No collector, telemetry activation or release authorization.
A supplied digest and complete coverage label are declarations, not verification.</p>
<dl>{provenance}</dl>
<p>Missing, partial and zero-sample values remain unavailable (—). An explicit zero is shown only
for a complete declared aggregate. Sample counts are denominators or histogram observations;
counts and USD totals have no implied population denominator.</p>
<div class="scroll" tabindex="0" role="region" aria-label="Measurement table">
<table><caption>Declared aggregate metrics — no acceptance thresholds evaluated</caption>
<thead><tr><th scope="col">Metric</th><th scope="col">Status</th><th scope="col">Value</th>
<th scope="col">Unit</th><th scope="col">Samples</th>
<th scope="col">Declared aggregate and coverage</th>
</tr></thead><tbody>{"".join(rows)}</tbody></table></div>
<p>Latency p50/p95 values are nearest-rank bucket upper bounds, never exact percentiles.
An overflow quantile has only a greater-than bound. Rates are descriptive, not causal or retention
estimates. No baseline comparison, provider quota, population adoption or production readiness 
is inferred.</p>
<p>Use the P14 measurement protocol and inherited gate register
before reviewing actual observations.
Privacy approval, eligible cohorts, approved thresholds and comparable baselines 
remain human gates.</p>
</body></html>\n"""


def render_backlog(report: dict) -> str:
    lines = [
        "# P14 measurement evidence gaps",
        "",
        report["notice"],
        "",
        "**Acceptance: BLOCKED.** This is an evidence checklist, not observed product findings.",
        "",
        "1. Obtain a verified release record and privacy/monitoring approval before collection.",
        "2. Verify lineage, consent/cohort, UTC window, deduplication and coverage externally.",
        "3. Predeclare baseline, thresholds and eligible samples; review adverse evidence.",
        "4. Agree follow-up scope with the product owner; no automatic rollout decision.",
        "",
        "| Metric | Declared status | Required evidence |",
        "|---|---|---|",
    ]
    for metric in report["metrics"]:
        status = metric["status"]
        action = (
            "Obtain approved observations; synthetic/local validation supplies none."
            if report["evidence_kind"] != "unverified_observation"
            else "Verify provenance/coverage and compare only to approved comparable baseline."
            if status == "available"
            else "Resolve missing/partial/empty evidence before interpreting results."
        )
        lines.append(f"| {metric['id']} | {status} | {action} |")
    return "\n".join(lines) + "\n"


def write_report(report: dict, output: Path) -> None:
    # Validate/render before creating anything. Exclusive directory/file creation never
    # reuses existing output, even a symlink. Interrupted writes may leave an incomplete
    # NEW directory; consumers must require all three files and a successful exit.
    files = {
        "report.json": json.dumps(report, indent=2, ensure_ascii=True, allow_nan=False) + "\n",
        "dashboard.html": render_html(report),
        "backlog.md": render_backlog(report),
    }
    output.mkdir(mode=0o700)
    for name, content in files.items():
        with (output / name).open("x", encoding="utf-8") as stream:
            stream.write(content)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="Prepare offline, unverified P14 aggregate reports."
    )
    parser.add_argument("--input", type=Path, help="Approved aggregate JSON; omitted means no data")
    parser.add_argument(
        "--output", type=Path, required=True, help="New directory; never overwritten"
    )
    args = parser.parse_args(argv)
    try:
        write_report(load_report(args.input), args.output)
    except (OSError, ValueError, RecursionError):
        print("Cannot create report: invalid input or unavailable output.", file=sys.stderr)
        return 2
    print("Local report created. P14 acceptance remains BLOCKED.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
