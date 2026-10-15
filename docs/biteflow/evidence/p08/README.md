# P08 evidence — local, mocked, no deployment

Full report: [checkpoint](../../p08-checkpoint.md). Review: [review.md](review.md). Decisions: [ledger.md](ledger.md). Exact command arrays, cwd, exit codes and timings: [commands.jsonl](commands.jsonl). The final docs commit is identified in the handoff; implementation candidate55f6409..146ee99, review-fixbe15f77.

## Final executed results

- `postgres-reviewed.log`:495 passes/9 skips,504 collected. Includes24 real disposable-PG16 integration cases. Main run skips6 browser +2 LiteRT +1 TensorFlow.
- `browser-final.log`:6 passes,498 deselected. **501 distinct Python cases passed;3 optional model cases NOT RUN.** No double-counting focused/candidate runs.
- `mobile-final.log`:293 passes,58 suites,0 failed/skipped.
- `types-final.log`, `lint-final.log`: TypeScript and Expo lint pass,0 lint warnings/errors.
- `ruff-reviewed.log`, `format-reviewed.log`: all checks pass,93 formatted files.
- `package-final.log`, `wheel-contents.txt`: wheel/sdist built; P08 modules and private SQL present.
- `export-final.log`: web +iOS/Android Hermes bundles exported. Checksums in `build-artifacts.json`; generated binaries are not committed.
- `ios-native-c.log`: successful unsigned Debug simulator build,246.38s. Complete18MB output preserved losslessly in `ios-native-c.log.gz`; text tail retains build verdict. Native graph unchanged by subsequent TS-only review fixes; final Hermes export verifies corrected JS. No physical device/signing/release claim.
- `android-native-c.log`: exit1, Java runtime unavailable. No APK. Gate remains BLOCKED.
- `postgres-recovery-reviewed.log`: permission pause, preserved restrictions/reviews, denied writes, restored grants, `pg_dump` restore to separate owned DB all pass. The logged permission failure is the deliberately asserted write denial.
- `preview-ready.log`:4 synthetic component previews pass with0 browser runtime errors; `insight-{en,he}.png` and `recommendation-{en,he}.png`. They render actual RN components with API-generated fixture data. A preview selection produces a200g editable unsaved recipe. These do not prove physical RTL/accessibility or full navigation.

No configured Python static typechecker, hosted CI/Python matrix, hosted DB, live AI/provider/quota verification, physical-device E2E, signed release, free-runtime Docker image smoke, optional ML tests, fresh registry audit or photo benchmark was run. Do not reinterpret NOT RUN as PASS.

## Regression / red-green record

`backend-baseline.log`:444 passed32 skipped without PG/browser opts. `mobile-baseline.log`:263/53 suites. P07 historical full counts are separate.

Initial implementation RED logs cover absent routes/modules and the erasure cache fence. Recommendation implementation exposed assignment-validation recursion and a wrong sort column; corrected green logs and full PostgreSQL run retained. Schema readiness RED showed a missing review table could still advertise availability; fixed. One formatting edit introduced19 collection errors; repaired before the full green run. The first native route typecheck failed before generated routes refreshed. Early lint imports/line widths and one ref cleanup warning were corrected.

Review: `review-privacy-red.log`2 real erasure-race failures→`review-privacy-green.log`11 recommendation passes. `review-mobile-red.log`13 failures across signed targets/stale selection/draft preservation→`review-mobile-green-final.log`26 focused passes. A shared mutable test fixture initially obscured the signed-value assertion; `review-signed-isolated-red.log` explicitly reruns the corrected fixture with the old validator (4 failures), then the fix is restored and green verified. Subsequent test typing and React Compiler ref-write lint failures are retained in `types-reviewed.log`/`lint-reviewed.log`; final types/lint/full mobile run pass. No second independent review.

Preview failures were harness discovery: Metro CI mode did not discover a newly created entry until restarted with that file present. No product fix was inferred from an empty preview. The first restore rehearsal misread the recipe repository's `(entry, created)` return; corrected and rerun, then rerun again for the final revision-fence contract.

## Reproduction boundaries

`run.py` strips inherited `DATABASE_URL` and FOODLOGGER/GEMINI/APPLE/EXPO variables, sets offline/CI/loopback, and logs stdout/stderr. `postgres*` runs require a local-only `postgres-url` file created for an **owned disposable** PostgreSQL database. This run used postgres16-alpine, container `biteflow-p08-local`, bound only `127.0.0.1:49778`, database `biteflow_p08_test`. The test fixture creates restricted roles and applies P01–P08 migrations there. Never supply a hosted or valuable database; these are destructive test fixtures. The DSN file and owned container are removed at completion.

`fixtures.py` generates synthetic contract JSON through local FastAPI TestClient; no model is configured. `preview.py` reconstructs `mobile/p08-preview.tsx` from the archived preview entry; start offline Metro8918 after creating that file because CI disables watching; the script removes it afterward. `rehearse.py` asserts the local hostname/database, preserves data during permission rollback, restores a backup into `biteflow_p08_restore_test`, and drops only that owned restore DB. `cleanup-*` logs document resource cleanup. No production modification, push, merge, deployment or real AI call occurred.
