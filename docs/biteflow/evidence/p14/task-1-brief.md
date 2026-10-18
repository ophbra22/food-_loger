### Task 1: aggregate contract and deterministic analysis

**Files:** create `src/foodlogger/measurement.py`, `tests/test_measurement.py`.
**Interfaces:** `empty_bundle() -> dict`; `analyze(bundle: dict) -> dict`; `InvalidMeasurement(ValueError)`. Fixed metric catalogue covers photo completion/latency, ingredient/portion/text/OCR corrections, confirmation abandonment, repeat latency, logged days/week, recipe/water/goal usage, provider attempts/429/USD cost, crash-free sessions, save failures, DB latency, Health duplicates, sync reconciliation, widget refresh and migration failures.
- [ ] Add meaningful failing tests for no data vs true zero, hand-calculated rates/weekly mean/USD, partial coverage, histogram quantile bounds/overflow, invalid shapes/numbers/windows/privacy fields and evidence-kind restrictions. Run `.venv/bin/python -m pytest tests/test_measurement.py -q`; expect missing functionality RED.
- [ ] Implement strict bounded aggregates and deterministic results; run targeted tests, Ruff and full Python suite with owned disposable PostgreSQL. Expect zero failures. Commit code/tests/design/plan.

