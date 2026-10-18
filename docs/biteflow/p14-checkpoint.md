# P14 local preparation checkpoint

**2026-10-18. Local preparation implemented; full P14 acceptance BLOCKED.** User authorized local P14 only, carrying every gate and rollback caveat. No actual approved release or observed dataset exists. No production readiness, retention improvement, provider quota, observed cost or adoption metric is claimed. No collector/telemetry activation, live AI, production/hosted changes, push, merge or deploy.

Base `6c1825e9b581e0736040f68260d5591f1a2f6a45`; branch `codex/biteflow-p14` in the existing isolated worktree. P13 branch/recovery point retained. Packaging is verified; one independent review is pending until recorded below.

## Implemented local scope and changes

- `src/foodlogger/measurement.py`: strict22metric aggregate catalogue/analyzer. Missing/partial/no-sample is distinct from explicit zero; bounded rate/weekly-mean/USD/histogram arithmetic; evidence remains none/synthetic/unverified. No release certification or inferred metrics.
- `src/foodlogger/measurement_report.py`, `scripts/report_release_metrics.py`: offline JSON input, duplicate/size/private-field rejection, byte hash, fixed generic error, exclusive output, standalone escaped HTML/JSON and evidence-gap backlog. No existing output overwrite; interrupted new writes may leave incomplete output, documented.
- `tests/test_measurement.py`, `tests/test_measurement_report.py`:72 new tests, including input failures and CLI behavior.
- `p14-design.md`, `p14-plan.md`, `p14-measurement-protocol.md`, `p14-backlog.md`, `p14-open-gates.md`, this checkpoint and roadmap status: limits, definitions, proposed comparisons, review/feedback procedure, priorities and all inherited gates. Checkboxes for full P14-A/B stay unchecked.
- `evidence/p14/`: deterministic empty and clearly labeled synthetic reports/fixture, local screenshots and command evidence. Synthetic numbers are test data only.

Architecture: additive offline stdlib tool, no dependencies, schema/migrations, app routes/UI events, API contracts, auth, native code, caches or production integrations changed. Existing application source/tests/native trees unchanged except the two new modules/tests. No database rollback needed.

## Executed checks

All commands from worktree root unless `mobile` noted. The evidence runner strips provider/environment secrets and configured DB URLs, disables Expo network/telemetry/dotenv, uses loopback and default-off capabilities. Main backend uses an owned disposable PostgreSQL17 container/database; HTTPX real transport is prohibited in routine tests. No model smoke opt-ins or live AI requests.

| Check | Actual command | Result |
|---|---|---|
| New P14 tests | `.venv/bin/python -m pytest tests/test_measurement.py tests/test_measurement_report.py -q` |72passed,0failed,0skipped,0.61s |
| Full backend incl PostgreSQL | `.venv/bin/python -m pytest -q -rs` |655passed (including29PostgreSQL cases),0failed,9skipped,32.78s; six browser opt-ins then executed below; three opt-in model smokes NOT RUN |
| Existing browser integration | `FOODLOGGER_RUN_BROWSER_TESTS=1 .venv/bin/python -m pytest -m browser -q -rs` |6passed,0failed,0skipped,658deselected,16.16s |
| Mobile | `npm test -- --runInBand` in `mobile` |428passed,83suites,0failed/0skipped,6.239s |
| TypeScript | `npm run typecheck` in `mobile` |PASS,exit0,1.89s wall |
| Mobile lint | `npm run lint` in `mobile` |PASS,exit0,1.62s wall |
| Python lint | `.venv/bin/python -m ruff check src tests scripts` |PASS,exit0 |
| Python formatting | `.venv/bin/python -m ruff format --check src tests scripts` |PASS,109files |
| Report generation/reproduction | `scripts/report_release_metrics.py` with no input and synthetic fixture; artifact checker |PASS,both reports reproduce byte-for-byte;22metrics each |
| Local dashboard browser smoke | Playwright script in evidence |PASS,2local files,desktop/narrow layout,0external requests; screenshot inspected; not physical/accessibility acceptance |
| Inherited evidence/rollback | artifact checker in evidence |PASS,P13 register verbatim; existing sources unchanged; retained APK SHA256/ZIP/embedded-bundle hash match |
| Backend sdist/wheel | Clean archive build and installed-module smoke |PASS,source5d04596,sdist+wheel; install with no dependencies/network and installed-module smoke,4.27s wall |
| Independent review | One immutable-range fresh reviewer |PENDING |

Unique Python coverage so far:661passed across main+browser,3opt-in model smokes NOT RUN. P14 new tests are included in655, not additional to it. Task1 intermediate full run637passed/9skipped; targeted RED then GREEN evidence retained. Mobile includes real AuthProvider/cleanup logic with native boundaries mocked, including signed-out cleanup retry in both languages. This is regression evidence, not OS erasure proof.

NOT RUN in P14: native Android/iOS builds/lint/JVM/Swift suites (native/mobile source unchanged), signed physical E2E01–20, hosted CI/staging, current dependency/service policy audit, live AI/provider quota/cost, real photo/OCR held-out benchmark, real telemetry/adoption/retention. Prior native results/failures remain historical; no new pass claimed. No separate Python type-checker is configured; TypeScript is checked above.

## Review and acceptance

Implementation self-check strengthened three initially vacuous no-overwrite tests: missing command also returned exit2; tests now require the exact CLI error. All18report tests then failed before implementation and passed after it. Initial formatting/line-length failures were corrected before green lint. Package build passed on all attempts; first install smoke failed because shared venv lacks pip, second because runner PYTHONPATH made source metadata appear installed. Root causes confirmed; temporary stdlib-venv with sanitized installer environment passed offline wheel installation and module execution. Shared environment unchanged; both failed harness attempts retained in evidence. Independent review findings and fixes will be recorded after that review; no review-clean claim yet.

| Requirement | Status | Evidence / limitation |
|---|---|---|
| Local offline measurement preparation |PASS locally |Analyzer/CLI/tests/default empty and synthetic artifacts |
| Preserve architecture/security/cleanup/rollback compatibility |PASS locally |No existing product/native source or schema change; full backend/mobile regressions and artifact check |
| P14 entry: actual separately approved release |BLOCKED |No release performed/recorded |
| P14-A: real approved usage/reliability dashboards |BLOCKED |No approved collection/destination/cohort or actual observed dataset; offline preparation is only a subset |
| P14-B: observed comparison/privacy-cost review and owner-agreed iteration |BLOCKED |No real baseline/observations/feedback; proposed protocol and evidence-gap backlog only |
| Full P14 exit: dashboards/backlog backed by observed release evidence |BLOCKED |All gates retained; local test success cannot close this |

See [complete gates](p14-open-gates.md) and [prioritized evidence gaps](p14-backlog.md). Mandatory before actual measurement: approved release, monitoring/privacy/cohort/owners, instrumentation completeness and source lineage, approved comparable baseline/thresholds. Inherited iOS build/full Android lint/dependency, physical/hosted, provider/policy, journal/provenance/photo, recovery and all prior feature gates retain their original classifications. Exact10% macro behavior and original deferred improvements remain visible. No gate silently closed.

## Rollback and stopping point

P14 adds local tooling only. Stop using it; preserve evidence. For inspection/recovery use pre-P14 `6c1825e` in a separate checkout, or selectively revert P14 commits after reviewing later changes; do not reset shared work or delete unrelated files. No migration, collector stop or production operation is needed because none was added/performed.

Keep compatible P13 source floor`4d97784`, stop controls, archive cleanup/retry, session revocation/CSV guards and classifier security fixes. Never blanket-revert P13 or use P12 operationally. Cleanup retry state is in-memory only: no persisted recovery marker/startup erasure; physical kill/restart/cleanup verification remains mandatory. Preserve drafts/operations/Health receipts/widget capabilities and all prior rollback caveats. Detailed separately approved operational procedure: [P13 release plan](p13-release-plan.md).

Stop after local P14 checkpoint. No release/collection/paid automation or further feature work is authorized by this report.
