# P14 local measurement preparation implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline with one final fresh-context review. The user explicitly approved local work following the roadmap; do not ask again for implementation permission. Preserve the actual-release gate for full P14 acceptance.

**Goal:** Prepare honest, offline adoption/reliability reports and a traceable evidence-gap backlog, without collecting telemetry or inventing post-release results.
**Architecture:** Add a pure Python aggregate contract/analyzer plus a local reporting command. Existing app, API, storage, authentication and native paths remain untouched.
**Tech Stack:** Python3.11 stdlib, existing pytest/Ruff; no dependencies added.
**Spec:** `p14-design.md`; `roadmap.md` P14-A/B; `requirements/BiteFlow_IMPLEMENTATION_PLAN_EN.md` P14 and measurement requirements; `p13-privacy.md`, `p13-release-plan.md`.

## Global Constraints

Base `6c1825e9b581e0736040f68260d5591f1a2f6a45`; isolated worktree, local `codex/biteflow-p14`. AI mocked/off, no production/hosted operations, push/merge/deploy, telemetry activation or fabricated observed metrics. Keep all inherited gates and P13 rollback/security fixes. No schema/native/app/API changes. Full P14 remains BLOCKED without actual release/observed evidence.

## Review Focus

- Missing/zero/partial data must not create successful adoption or reliability claims; preserve denominator and coverage distinctions (Task1).
- Contradictory counts, bool/nonfinite/oversized numbers, duplicate keys and unknown/raw-content fields must fail without reflecting sensitive input (Tasks1/2).
- Histogram tails and empty cohorts must not manufacture exact percentiles or successful thresholds (Task1).
- Synthetic or merely declared observations and a commit string must never become verified release evidence; none cannot carry numeric observations (Tasks1/2).
- Invalid input, existing output paths and HTML content must not corrupt evidence, overwrite user files or execute/load remote content (Task2).

### Task 1: aggregate contract and deterministic analysis

**Files:** create `src/foodlogger/measurement.py`, `tests/test_measurement.py`.
**Interfaces:** `empty_bundle() -> dict`; `analyze(bundle: dict) -> dict`; `InvalidMeasurement(ValueError)`. Fixed metric catalogue covers photo completion/latency, ingredient/portion/text/OCR corrections, confirmation abandonment, repeat latency, logged days/week, recipe/water/goal usage, provider attempts/429/USD cost, crash-free sessions, save failures, DB latency, Health duplicates, sync reconciliation, widget refresh and migration failures.
- [x] Add meaningful failing tests for no data vs true zero, hand-calculated rates/weekly mean/USD, partial coverage, histogram quantile bounds/overflow, invalid shapes/numbers/windows/privacy fields and evidence-kind restrictions. Run `.venv/bin/python -m pytest tests/test_measurement.py -q`; expect missing functionality RED.
- [x] Implement strict bounded aggregates and deterministic results; run targeted tests, Ruff and full Python suite with owned disposable PostgreSQL. Expect zero failures. Commit code/tests/design/plan.

### Task 2: offline dashboards, protocol, backlog and checkpoint

**Files:** create `src/foodlogger/measurement_report.py`, `scripts/report_release_metrics.py`, `tests/test_measurement_report.py`, `docs/biteflow/p14-measurement-protocol.md`, `p14-backlog.md`, `p14-open-gates.md`, `p14-checkpoint.md`, fixtures/evidence under `docs/biteflow/evidence/p14/`; update roadmap status with precise local-only evidence.
**Interfaces:** consumes `empty_bundle`, `analyze`, `InvalidMeasurement`; command `PYTHONPATH=src python scripts/report_release_metrics.py --output NEW_DIRECTORY [--input AGGREGATE_JSON]` writes `report.json`, `dashboard.html`, `backlog.md`. Input cap256KiB, duplicate-key rejection, generic invalid-input errors, no existing output overwrite. Output includes computed input SHA256; observed provenance remains unverified.
- [x] Add failing subprocess tests for default empty report, labeled synthetic math, supplied-observation disclaimer, malformed/private/duplicate/oversized input, existing output preservation and escaped standalone HTML. Expect missing command/report functionality RED.
- [x] Implement report/CLI; write metric/threshold/feedback protocol and evidence-backed backlog from actual missing instrumentation/gates. Generate separately labeled empty and synthetic artifacts. Expect targeted/full Python/browser/mobile tests, typecheck/lint and package check to pass; no native code changes require new physical acceptance claims.
- [x] Commit code/docs/evidence; complete one immutable-range independent review. Fix confirmed Important/Critical findings once with RED→GREEN plus full affected suites, archive decisions/review/results, remove only owned scratch resources. Keep local branch; no integration/deploy. Report local preparation versus BLOCKED actual P14 exit.
