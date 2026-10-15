# P09 evidence

`commands.jsonl` records actual command arguments, directory, exit status and duration. Matching named logs contain stdout/stderr. Failures and RED stages are retained, not hidden. `run.py` strips inherited database, provider and public Expo environment values, uses loopback API URL and offline/telemetry-off Expo checks. PostgreSQL commands use only the documented disposable loopback `_test` DSN; HTTP providers are blocked by the existing pytest autouse guard and injected mocks. Dependency package downloads and official documentation reads are not provider operations.

Baseline: backend 471 passed / 33 skipped; mobile 293 passed / 58 suites. P09 candidate: backend with actual local PG16 525 passed / 9 skipped; separate browser run 6 passed / 528 deselected; mobile 310 passed / 62 suites. Final reviewed counts are in the checkpoint and final logs.

`rehearse.py` verifies readable preferences during write rollback, denied writes, reenabling grants, pg_dump restoration into a second owned database, and RLS preservation. No production or hosted database is addressed. The owned Docker container is removed after checks; unrelated containers remain untouched.

NOT RUN: live AI, real push token registration/transport, physical device push journeys, hosted CI/staging, signed release installation, optional ML/LiteRT model tests. Android native command actually fails because Java is unavailable. iOS compilation outcome is recorded separately and does not prove delivery or physical-device acceptance.

Final: backend 535 passed/9 skipped; separate browser 6 passed (541 unique Python passes, 3 optional ML/LiteRT not run); mobile 312 passed/63 suites. Final build/lint/type/export/recovery results and Android blocker are in checkpoint. `ios-native.log.gz` preserves full compiler output; the text log records its uncompressed SHA256 and final lines.
