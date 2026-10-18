# P14 local preparation checkpoint

**2026-10-18: local preparation complete; full P14 acceptance BLOCKED.** The user authorized local P14 only, carrying every gate and rollback caveat. No approved release or observed dataset exists. No production readiness, retention improvement, provider quota, actual cost or adoption result is claimed. No collector activation, live AI, production/hosted changes, push, merge or deployment occurred.

**Latest local follow-up:** [packaging helper fix and fresh verification](p14-packaging-follow-up.md) at `fcc116d`. The helper now validates its actual new output; three regressions pass after expected RED failures. Fresh results: 660 backend passed/9 skipped, six browser passed, 428 mobile passed, typecheck/lint/package checks passed. Only three model smoke cases remain unexecuted among the Python tests. All gates and rollback caveats are unchanged; full P14 stays BLOCKED.

Branch: `codex/biteflow-p14`, existing isolated worktree. Base: `6c1825e9b581e0736040f68260d5591f1a2f6a45`. Final product implementation: `82cb07bed28cfbf438d5dac4f7f0b9c49b58f0e2`; original checkpoint/evidence at `d036aaa`; helper/test follow-up at `fcc116db8287e58da9f6844ea2c36312d95157ae`. The P13 branch remains at the base.

## Implemented local scope

- `src/foodlogger/measurement.py`: fixed catalogue of 22 proposed metrics with bounded aggregate validation and arithmetic. Missing, partial and empty cohorts remain distinct from explicit zero. Rates, weekly means, decimal USD totals and histogram quantile bounds retain their units and denominators.
- `src/foodlogger/measurement_report.py`, `scripts/report_release_metrics.py`: offline aggregate JSON input, duplicate/size/unknown-field rejection, generic error responses, input byte hash, exclusive output creation and escaped standalone HTML/JSON/backlog. Evidence can only be none, synthetic or unverified; acceptance stays blocked.
- `tests/test_measurement.py`, `tests/test_measurement_report.py`: 74 new tests, including malformed input, CLI failure, existing-file preservation, empty/partial evidence, exact arithmetic and display-boundary regressions.
- [Protocol](p14-measurement-protocol.md), [backlog](p14-backlog.md), [complete gates](p14-open-gates.md), design/plan and roadmap status: proposed definitions, comparison/feedback procedure, evidence-based priorities and every inherited gate. Full P14-A/B checkboxes remain unchecked.
- [Empty dashboard](evidence/p14/empty/dashboard.html) and separately labeled synthetic fixture/report: reproducible local artifacts. Synthetic numbers are invented test inputs only, never post-release measurements.

Architecture is additive offline tooling using the standard library. No dependencies, schema/migrations, app routes/events, API contracts, auth, native code or production integration changed. Existing product/native sources and tests are unchanged; two modules and two test files were added. No database rollback is required.

## Original P14 verification (before packaging follow-up)

The table below preserves the original results. Use the linked follow-up above for current checks. Original package build/install logs remain valid, but the archived helper checked a stale report path; its fresh-output validation claim is superseded by the corrected helper's actual clean execution at `fcc116d`.

Commands ran from the worktree root unless marked `mobile`. The runner strips configured DB/provider environment values, disables Expo network/telemetry/dotenv and uses loopback/default-off capabilities. Main backend tests received an owned disposable PostgreSQL17 database. Routine tests prohibit real HTTPX transport. [Evidence index](evidence/p14/README.md) links logs, exact command records, source/artifact hashes, review and deliberate RED runs.

| Check | Actual command | Result |
|---|---|---|
| P14 tests after review fix | `.venv/bin/python -m pytest tests/test_measurement.py tests/test_measurement_report.py -q` | **74 passed**, 0 failed/skipped; 0.62s |
| Full backend after review fix | `.venv/bin/python -m pytest -q -rs` with owned test DSN | **657 passed**, including 29 PostgreSQL cases; 0 failed, 9 skipped; 31.28s |
| Existing browser integration | `FOODLOGGER_RUN_BROWSER_TESTS=1 .venv/bin/python -m pytest -m browser -q -rs` | **6 passed**, 0 failed/skipped, 658 deselected; 16.16s. Run before the isolated report-display fix; existing app/browser source unchanged. |
| Mobile | `npm test -- --runInBand` in `mobile` | **428 passed**, 83 suites, 0 failed/skipped; 6.239s |
| TypeScript | `npm run typecheck` in `mobile` | **PASS**, exit0; 1.89s wall |
| Mobile lint | `npm run lint` in `mobile` | **PASS**, exit0; 1.62s wall |
| Python lint after review fix | `.venv/bin/python -m ruff check src tests scripts` | **PASS**, exit0 |
| Python formatting after review fix | `.venv/bin/python -m ruff format --check src tests scripts` | **PASS**, 109 files |
| Backend packaging after review fix | Clean archive of `82cb07b`; `.venv/bin/python -m build --no-isolation`; isolated `python -m pip install --no-index --no-deps <wheel>`; installed `python -m foodlogger.measurement_report --output <new directory>` | Build/install/CLI exit **PASS**; original helper validated a stale report path, so that assertion did not verify fresh output. Superseded by the follow-up clean run. 4.17s wall. Historical [manifest](evidence/p14/package-final-manifest.json). |
| Report reproducibility | CLI empty/synthetic generation and artifact checker | **PASS**, both reports reproduce byte-for-byte; 22 metrics each |
| Dashboard browser smoke after fix | Archived Playwright helper on local files | **PASS**, two dashboards, desktop/narrow layout, zero external requests; screenshots. Not physical/accessibility acceptance. |
| Inherited evidence/rollback | Archived artifact checker | **PASS**, inherited P13 register verbatim, old source unchanged, retained rollback APK/ZIP/embedded-bundle hashes match |
| Independent review | One fresh read-only reviewer on `6c1825e..38ffae9`; executor fix at `82cb07b` | One display finding regraded/fixed with two RED→GREEN cases and passing full affected backend suite. No second review. |

Unique Python tests passed across main + browser: **663**. The 74 new tests are included in 657, not additional. Main-suite nine skips comprise six opt-in browsers executed separately and **three model smoke tests NOT RUN**. Intermediate runs remain in evidence: Task1 637 passed/9 skipped; pre-review main 655 passed/9 skipped. Mobile includes the P13 cleanup/session regressions and signed-out cleanup retry in both languages, with native boundaries mocked. This does not prove OS erasure.

**NOT RUN in P14:** native Android/iOS builds/lint/JVM/Swift suites (native/mobile source unchanged), signed physical E2E01–20, hosted CI/staging, current dependency/service policy audit, live AI/provider quota/billing, real photo/OCR held-out evaluation and real telemetry/adoption/retention. Prior native results/failures remain historical. No separate Python type-checker is configured; TypeScript was checked above.

## Review findings, fixes and failed attempts

[Independent review](evidence/p14/independent-review.md) initially graded no Critical/Important findings and one Minor display issue. The executor regraded the issue **Important**: six-significant-digit formatting could show 99.9999999 as 100 or 99.499995 as the proposed 99.5 threshold. Two rendering regressions failed first, then passed after retaining the JSON float's round-trip precision. Counts remain visible; no threshold is automatically evaluated. All affected backend tests passed. No unresolved local Critical/Important finding or deferred review minor remains. The unrelated exact 10% macro-warning gate remains open.

Before implementation, three no-overwrite test assertions could pass merely because the missing script returned exit2; they were strengthened to require the correct fixed CLI error, then all 18 report tests failed before implementation. Initial formatting failures were fixed before passing lint.

Package builds succeeded on every attempt, but two installation-smoke harness attempts failed: shared venv had no pip; then inherited source `PYTHONPATH` made source metadata appear installed in the isolated environment. Causes were confirmed; a temporary standard-library venv with a sanitized installer environment passed installation with no dependency downloads. Both failed attempts and successful retries are retained. The shared environment was not modified.

## Acceptance and blockers

| Requirement | Status | Evidence / limitation |
|---|---|---|
| Authorized local offline preparation | **PASS locally** | Analyzer, CLI, 74 tests, empty/synthetic reports, protocol and traceable gap backlog |
| Preserve existing architecture/security/cleanup/rollback | **PASS locally** | No prior product/native source or schema change; regressions and retained artifact checks |
| P14 entry: actual separately approved release | **BLOCKED** | No release performed or recorded |
| P14-A: real approved usage/reliability dashboards | **BLOCKED** | No approved collection/destination/cohort or actual observations |
| P14-B: observed comparisons/privacy-cost review and owner-agreed iteration | **BLOCKED** | No actual baseline, observations or feedback; proposed protocol/gap backlog only |
| Full P14 exit backed by observed release evidence | **BLOCKED** | Local tests and synthetic reports cannot supply this evidence |

Mandatory before actual measurement: approved release/scope, monitoring/privacy/cohort/retention and human owners, instrumentation completeness/source lineage, predeclared comparable baseline/thresholds and real observations/feedback. [All inherited gates](p14-open-gates.md) retain their original classifications: iOS build/full Android lint/dependencies; hosted/signed physical validation; actual provider quotas/policy; journal-edit UI; basis-correction provenance; held-out photo/OCR dataset/protocol; regional/Health/widget/notification behavior; privacy/retention and recovery. Exact 10% macro behavior, localized labels and other originally deferred improvements remain visible.

## Decisions and limits

The [execution ledger](evidence/p14/execution-ledger.md) records all rulings in order:

1. Latest local approval permits preparation despite unmet release entry; full P14 remains blocked.
2. Offline aggregates only, with no collector; approved instrumentation and real evidence remain external work.
3. Inline implementation with one final fresh review; no per-task or second review.
4. Exclusive new output rather than replacement; interruption can leave incomplete new files. Require exit0 and all three outputs.
5. Regrade/fix rate rounding to preserve adverse evidence; some displayed numbers are longer.
6. Actual collection, release, consent, cohort and source truth stay external; this tool cannot certify them.
7. Cross-metric population consistency needs independent review; individually valid but mutually inconsistent aggregates can still be supplied.
8. Reviewer interruption caveat accepted as documented; no atomic-publication guarantee.
9. Use an owner-controlled output parent; this is not a service defending against hostile filesystem replacement.
10. Native/hosted/physical readiness remains unverified here; those release gates remain.

No deferred review minors.

## Commits, rollback and stopping point

Local commits before final checkpoint/evidence commit:

- `bba55d2` — aggregate contract and arithmetic tests.
- `5d04596` — offline dashboards, protocol and evidence-gap backlog.
- `38ffae9` — regression and packaging evidence.
- `82cb07b` — display-precision review fix and regression evidence.
- `d036aaa` — original local checkpoint and evidence.
- `fcc116d` — subsequent packaging stale-output fix and three regression tests; fresh evidence linked above.

P14 adds local tooling only. Stop using it and preserve evidence. For inspection/recovery use pre-P14 `6c1825e` in a separate checkout, or selectively revert P14 commits after reviewing later changes. Do not reset shared work or delete unrelated files. No migration, collector or production rollback operation is needed.

Keep compatible P13 source floor `4d97784`, stop controls, archive cleanup/retry, session revocation/CSV guards and classifier security fixes. Never blanket-revert P13 or operationally downgrade to P12. Cleanup retry is in-memory only: no persisted recovery marker/startup erasure; physical kill/restart/cleanup validation remains mandatory. Preserve drafts/operations, P06 label-draft readers, P07 pending retries, P09 leases/accepted pushes, P10/P11 Health receipts and P12 widget cleanup capabilities. Detailed separately authorized operational procedure: [P13 release plan](p13-release-plan.md).

Owned disposable database/container/volume and credential files were removed. Build artifacts and archived evidence are retained; this task's scratch environment is removed at finalization. Branch/worktree remain local; only the pre-existing `.venv` symlink is untracked after committing. No push, merge, deployment, production modification, destructive migration or live AI. Stop here for user review; no release, collection, paid automation or further feature work is authorized by this checkpoint.
