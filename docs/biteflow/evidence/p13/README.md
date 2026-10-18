# P13 local evidence

`commands.jsonl` is the actual execution ledger; each named log records stdout/stderr, including failed attempts. Larger logs may be stored as `.log.gz` without changing their contents (apart from documented synthetic-token redaction). `run.py` strips ambient provider/DB/Expo configuration, forces AI defaults off and uses loopback fixtures. PostgreSQL runs use only the owned disposable database; its connection file is removed before commit. No `.env` was archived.

- `restore-results.json`: full-table counts/SHA256 before restore, after explicit new-write reconciliation, and after erasure reconciliation, both SQLite and PostgreSQL.
- `performance.json`: actual synthetic samples, warmup/sample counts, environment and limits; no production/model-quality comparison.
- `dependency-npm.log`, `dependency-summary.json`, `dependency-paths.log`, `dependency-available.json`: npm advisory totals, upstream families, affected chains, available package versions at check time.
- `dependency-python-installed.log`: audit of installed Python environment, not a lockfile or production image.
- `secret-scan.json`, `log-redactions.json`: narrow current-source pattern coverage and explicit synthetic fixture redactions.
- `native-counts.json`: parsed JVM XML and focused Android lint result. Swift results are in command logs.
- `source-inventory.json`, final `manifest.json`, `changed-files.txt`: exact sources, absence of new schema changes, artifact identities and changed-file list.
- `progress.md`, final `review.md`: archived decisions and independent review after implementation.

Intended RED regressions are failures, not final test successes. Setup/assertion mistakes remain visible. Full native dependency lint and npm audit remain failures. iOS precompiled and source-mode attempts fail in the installed compiler/dependency interface; the experimental setting was reverted. Signed physical device, hosted CI/staging, live AI/quota verification and held-out photo/OCR evaluation were NOT RUN. See checkpoint/matrix for acceptance boundaries.

Artifacts are local validation packages, with loopback API and unverified native flags off. Android Release uses the existing debug key; iOS simulator/ad-hoc signing is not device/App Store signing. Do not distribute these as a production release.
