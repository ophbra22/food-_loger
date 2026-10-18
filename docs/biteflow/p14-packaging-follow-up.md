# P14 packaging verification follow-up

2026-10-18. **Authorized local fix PASS; full P14 acceptance remains BLOCKED.**

Base: `d036aaa59046276ae34f14acd80ecca4189b76ec`. Fix and regression tests: `fcc116db8287e58da9f6844ea2c36312d95157ae` on local `codex/biteflow-p14`. Subsequent changes are checkpoint/evidence documentation only. No application, API, mobile/native, schema, dependency, CI or production configuration changed.

## Defect, fix and review

The helper `docs/biteflow/evidence/p14/check-package-final.py` generated `installed-report-reviewed/report.json` but read `installed-report/report.json`. A stale successful report could mask invalid or missing fresh output; a clean run failed when the old path was absent. The helper now shares one `report_output` path between the installed CLI invocation and JSON validation. Build, isolated installation, fail-on-process-error behavior and acceptance checks are preserved.

`tests/test_packaging_evidence.py` adds three behavioral regressions: clean valid output succeeds without an old report; stale success cannot mask invalid fresh acceptance; stale success cannot mask a missing fresh JSON file. All three failed for the expected reasons before the fix. All passed afterward. The tests execute the actual helper and report generator, with expensive Git/build/install/venv boundaries replaced by local fixtures. The separate real archive/build/offline-install run verifies those boundaries. Failure cases also check that no successful manifest is written and the older report is untouched.

Executor critical review checked shared output identity, validation before manifest publication, subprocess error propagation, regression sensitivity and unchanged product/security scope. Failure assertions were strengthened to require actual fresh report generation, avoiding incidental fixture failures satisfying the tests. No additional scoped defect was found. This is executor review, not a new independent-review claim. The earlier precision fix remains unchanged and verified by the full report suite and two additional installed-package boundary probes (`99.9999999`, `99.499995`). The unrelated exact 10% macro-warning gate stays open.

## Actual verification

All final checks used `fcc116d`. [Evidence index](evidence/p14-packaging-follow-up/README.md) includes full logs, commands, exit codes, timings, JUnit records and artifact hashes. Commands below ran from the repository root unless marked mobile. The runner removes configured database/provider environment values; only the backend suite receives its own disposable PostgreSQL17 DSN. AI remains mocked/off; routine tests block real HTTPX transport. Expo dotenv/network/telemetry are disabled, with loopback and native capabilities off.

| Check | Actual command | Actual result |
|---|---|---|
| Deliberate regression RED | `.venv/bin/python -m pytest tests/test_packaging_evidence.py -q` against old helper | **3 failed**, expected; 0.07s. Clean run read absent old file; invalid/missing fresh output incorrectly passed old validation. |
| Regression + measurement GREEN | `.venv/bin/python -m pytest tests/test_packaging_evidence.py tests/test_measurement.py tests/test_measurement_report.py -q` | **77 passed**, 0 failed/skipped; 0.58s. Includes the three regressions and both precision cases. |
| Full backend | `.venv/bin/python -m pytest -q -rs --junitxml=runtime/p14-packaging-follow-up-20261018/backend.xml` | **660 passed, 9 skipped**, 0 failed; 34.41s. Includes 29 PostgreSQL and 16 privacy tests. |
| Browser integration | `FOODLOGGER_RUN_BROWSER_TESTS=1 .venv/bin/python -m pytest -m browser -q -rs --junitxml=runtime/p14-packaging-follow-up-20261018/browser.xml` | **6 passed**, 0 failed/skipped, 663 deselected; 16.50s. |
| Mobile | `npm test -- --runInBand` in mobile | **428 passed, 83 suites**, 0 failed/skipped; 7.504s. Native boundaries mocked. |
| TypeScript | `npm run typecheck` in mobile | **PASS**, exit 0; 2.25s wall. |
| Mobile lint | `npm run lint` in mobile | **PASS**, exit 0; 1.72s wall. |
| Python lint | `.venv/bin/python -m ruff check src tests scripts` | **PASS**, exit 0. |
| Python formatting | `.venv/bin/python -m ruff format --check src tests scripts` | **PASS**, 110 files. |
| Fixed packaging helper | `.venv/bin/python docs/biteflow/evidence/p14/check-package-final.py` in a fresh owned `.superpowers/sdd/p14-plan` | **PASS**, exit 0; 4.49s wall. Real `git archive fcc116d`, `python -m build --no-isolation`, isolated offline `pip install --no-index --no-deps`, installed module smoke and validation of its own new output. No old `installed-report` directory exists. |
| Package/evidence/rollback cross-check | `.venv/bin/python runtime/p14-packaging-follow-up-20261018/check-follow-up.py` via safe runner | **PASS**, exit 0. All three fresh report files, 22 empty metric rows, blocked acceptance, package hashes, two installed precision probes, original empty/synthetic report reproduction, inherited gates and retained P13 APK/bundle hashes. |
| Reverse patch checks | `git diff --binary <base> fcc116d` piped to `git apply --reverse --check`, for bases `d036aaa` and `6c1825e` | **PASS** for follow-up and whole P14 patches. Checks only; no revert applied. |

**Unique Python tests passed: 666** (660 main + 6 browser). The 77 targeted tests, 29 PostgreSQL and 16 privacy tests are subsets, not additional totals. Main-suite nine skips were six opt-in browsers subsequently executed and **three model smoke tests NOT RUN** (two LiteRT, one ML). No final test, lint, typecheck or packaging run failed. The deliberate three-failure RED run remains archived.

The final whole-range Git whitespace check returned exit 2 for whitespace emitted in raw pytest/npm logs and generated HTML. Those artifacts are intentionally preserved as emitted; the source/docs/helper/JSON/XML whitespace check passes with raw log/HTML artifacts excluded. This non-blocking evidence-format issue is recorded in `raw-evidence-whitespace.*`; it is not a test or application failure.

**NOT RUN:** native Android/iOS builds, full native lint, JVM/Swift suites, physical-device E2E/accessibility/erasure/rollback, hosted CI/staging, current dependency/service-policy audits, live AI/provider quota or billing checks, held-out photo/OCR evaluations and actual released-product measurements. No separate Python type checker is configured. The product/native code is unchanged; earlier native results remain historical, not freshly passed here. No new dashboard screenshot run was needed for this helper-only change; report generation/reproduction and existing browser integration did run.

## Evidence correction and acceptance

Original P14 package builds and isolated installations remain recorded facts, but the original helper's stale-path assertion did **not** prove validation of its own newly generated report. Earlier logs and manifests are preserved as historical evidence, with this limitation explicitly added to the checkpoint/index. The fresh committed helper execution and manifest here supersede that validation claim; no historical log was rewritten into a passing fresh run.

| Follow-up criterion | Status | Evidence |
|---|---|---|
| Validate the report just generated | **PASS locally** | Shared output path, clean real build/install/helper run, fresh no-data report |
| Prevent stale-success false positives | **PASS locally** | Invalid and missing fresh-output regressions RED→GREEN; no success manifest on failure |
| Preserve precision and existing functionality | **PASS locally** | 77 targeted, full backend/browser/mobile checks; two installed precision probes; unchanged application/native trees |
| Preserve rollback/security/gates | **PASS locally** | Reverse checks, retained P13 artifacts, unchanged complete gate register; physical rollback remains unverified |
| Actual release and P14-A/B observed evidence | **BLOCKED** | No approved release, real observations, approved collection/cohort/retention/source lineage or owner-agreed observed comparison/iteration |

Every [P14/inherited gate](p14-open-gates.md) retains its prior status and classification. This closes only the helper's local verification defect. Mandatory release/measurement prerequisites remain: approved release/scope; privacy/monitoring/cohort/retention and owners; approved source lineage and collection completeness; comparable baseline/threshold definitions; actual observations and feedback. Provider quotas/policy/costs, hosted CI/staging, native build/lint issues, signed physical validation, basis-correction provenance and photo/OCR held-out protocol/dataset remain open. Exact 10% warnings and other originally deferred improvements remain visible. No post-release metrics are inferred from tests or synthetic data.

## Rollback and stopping point

The follow-up changes only the evidence helper and regression tests; no schema migration or runtime rollback is needed. Stop using the helper if necessary and preserve its evidence. Reverting `fcc116d` would restore the known stale-output defect, so withdraw its validation claim if that local revert is ever chosen. For all P14 tooling, separately inspect/recover pre-P14 `6c1825e`; do not reset shared work or delete unrelated artifacts.

All [P13 recovery rules](p13-release-plan.md) remain mandatory: source floor `4d97784`, compatible cleanup/security fixes and stop controls, no blanket P13 revert or P12 operational downgrade. Cleanup retry is in-memory only; persisted restart recovery and physical erasure remain unverified. Preserve drafts/operations, label-draft readers, pending retries, notification leases/accepted pushes, Health receipts and widget cleanup capabilities. Do not delete an account just for cleanup. No production switches or migrations were executed.

Owned test database/container/volume and credentials were removed. The fresh build/installed environment is removed after retaining hashed artifacts and logs in ignored runtime storage. The final committed worktree is clean except for the existing `.venv` symlink. No live AI, production changes, push, merge or deployment. Stop for user review; full P14 acceptance remains BLOCKED.
