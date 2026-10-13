# P00 evidence bundle

Captured on 2026-10-13 for source commit `9198d94e003e1aefff2ccfd44e741eb21efa7d5e`. These files record a local audit, not staging or production certification. See [current-state.md](../current-state.md) for interpretation and limitations.

- `commands.json` and `extra-commands.json`: exact argument arrays, working directories and exit codes. Matching `.log` files contain actual output. All listed checks exited 0; skipped tests remain explicitly skipped.
- `fixture-verification.json`: image hash checks, recalculated historical report summaries, source identity and installed tool/package versions. Historical result arithmetic is not proof of a new provider run.
- `photo-baseline.json` and `.log`: fresh local legacy classifier evaluation on eight existing images. This does not evaluate the current default Gemini mobile pipeline.
- `probes.py` and `.log`: audit-only observations of retry/deletion behavior and intermediate rounding, using temporary SQLite and an injected provider that must never be called. This is not a product patch or a regression suite.
- `artifact-manifest.json`: exact audit-file inventory, byte counts and SHA-256 hashes. Paths are repository-relative. The manifest lists itself without a recursive self-hash.

## Execution environment and safety boundaries

The audit runner removed inherited `DATABASE_URL`, `FOODLOGGER_*`, `GEMINI_*`, `APPLE_*` and `EXPO_*` from each child environment, then set only explicit local flags. It set `PYTHONDONTWRITEBYTECODE=1`, `CI=1`, `EXPO_NO_TELEMETRY=1` and `EXPO_OFFLINE=1`. Local dependencies already existed; none were installed or updated. Commands below describe completed runs, not authorization for future external operations.

Browser tests additionally set `FOODLOGGER_RUN_BROWSER_TESTS=1`; they launched a loopback server against temporary SQLite. PostgreSQL fixture setup was not enabled because it drops the private schema and role on its target test database. No production database was contacted.

The Python package build used a clean `git archive HEAD` snapshot at `/tmp/biteflow-p00-audit/source`; build artifacts went to `/tmp/biteflow-p00-audit/python-dist`. The photo evaluator used that snapshot without an `.env`, its source on `PYTHONPATH`, and the verified existing weight file `/Users/braude/.keras/models/foodlogger_mobilenet_v2_1.0_224.h5` via `FOODLOGGER_WEIGHTS`. No weight download or provider call occurred.

Expo export wrote only to `/tmp/biteflow-p00-audit/mobile-export` with an explicit loopback API URL and offline/telemetry settings. It produced JavaScript/Hermes bundles, not signed native archives. The temporary build directories are convenience outputs and may expire; retained logs/reports are in this bundle.

The 17 backend skips comprise 5 browser tests (subsequently passed separately), 9 PostgreSQL tests, 2 LiteRT tests and 1 training smoke test. Mobile Jest output contains a Watchman recrawl warning; all 107 tests passed. Do not count deselected or skipped tests as passed.

Provider account inspection was read-only and failed with network/520 errors. No key values, account billing changes, model calls, production operations, migrations or deployments are included in this bundle. Local paths and original compiler output are retained for reproducibility.
