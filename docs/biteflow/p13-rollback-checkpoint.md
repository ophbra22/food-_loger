# P13 compatible rollback follow-up — local checkpoint

Scope: the user approved a local follow-up to `49141be841f114530fa606890f1d156e25a24d68` to address rollback caveats, preserve archive cleanup/security fixes, add tests and update the rollback plan. AI remains mocked/off. No production/hosted changes, live AI, push, merge, deployment, destructive migration or P14 work occurred.

**Local implementation and verification PASS; one Important independent-review finding fixed and verified. Full P13 acceptance, operational rollback and P14 entry remain BLOCKED.** This follows the existing architecture and adds no dependencies, schema, migration, native capabilities or nutrition/data-contract changes. The original P13 checkpoint and package evidence remain historical.

## Changes and compatibility

- `src/foodlogger/security.py` adds a default-false, environment-validated `account_export_disabled` setting at the end of the dataclass to preserve positional compatibility. `src/foodlogger/app.py` returns authenticated 503 before archive reads when `FOODLOGGER_ACCOUNT_EXPORT_DISABLED=1` (also accepts `true`). Authentication still returns 401 when absent; owner-scoped day CSV remains available. Invalid configuration prevents startup. All server instances need a restart/drain under separate approval.
- `mobile/src/storage/export.ts` checks the compiled `EXPO_PUBLIC_ACCOUNT_EXPORT_DISABLED=1` flag before loading server/device archive data; `AccountExport.tsx` hides the account export card. Defaults preserve current behavior. `.env.example` documents the build-time control. This is not a remote mobile kill switch.
- Existing private-file cleanup, export/session guards, classifier fixed errors/logging and bounded archive reads remain active. No changes to `private-files.ts`, `export-session.ts` or `privacy.py`. CSV cleanup runs even with account exports disabled. The review fix adds an Auth/root-navigation cleanup warning and retry after logout/deletion; credentials remain revoked. File-cleanup failure is visible state rather than an unhandled rejected logout promise.
- New and expanded tests cover server flags/defaults/invalid configuration, authentication/no archive read/CSV, mobile hidden UI/direct helper rejection, CSV sharing cleanup, logout/deletion of stale JSON and CSV, unrelated-file preservation, cleanup failure/retry and pending-logout session invalidation. Native filesystem/sharing and remote boundaries are mocked; actual production cleanup was not attempted.
- The [release/rollback plan](p13-release-plan.md) replaces unsafe blanket reverts with a stop/drain/compatible-build/cleanup/verify sequence. Preserve pending drafts/operations/receipts before logout, never delete an account solely for temporary-file cleanup, and never claim cleanup succeeded after an error. No startup cleanup or persisted recovery marker was added. If the process ends before successful cleanup, repeat explicit cleanup in a compatible build; the in-memory warning is not durable erasure evidence. Recipient copies and already admitted shares cannot be recalled.

Full changed-file inventory is in [evidence](evidence/p13-rollback/changed-files.txt); exact commands, complete logs and artifact hashes are in [the evidence directory](evidence/p13-rollback/README.md).

## Actual results in this follow-up

Commands below ran through `python3 docs/biteflow/evidence/p13-rollback/run.py <name> <area> <command...>` to isolate environment, keep AI off/mocked, record exit codes and capture output. Backend PostgreSQL used a disposable loopback container and synthetic data only. No new native test pass is inferred from older logs.

| Check | Actual command, relative to repository unless specified | Result |
|---|---|---|
| API TDD | `.venv/bin/python -m pytest tests/test_privacy.py -q --tb=short` | Expected RED: 3 failed /13 passed (missing stop control and invalid-value rejection). GREEN: 16 passed, 2.01s. |
| Mobile TDD | `npm test -- --runInBand src/storage/__tests__/export.test.ts src/components/__tests__/AccountExport.test.tsx` in mobile | Expected RED: 2 failed /10 passed. Final expanded targeted run: 19 passed /5 suites, 0.848s. |
| Backend + PostgreSQL, final code | `.venv/bin/python -m pytest -q --tb=short` | **583 passed, 9 skipped, 31.93s**, 0 failed. Includes 29 real local PostgreSQL cases. |
| Browser integration | `.venv/bin/python -m pytest -m browser -q --tb=short` with opt-in | **6 passed, 586 deselected, 20.87s**. |
| Unique Python union | Main + browser runs, without double counting | **589 passed, 0 final failures.** Nine main skips comprise six browser tests subsequently run and three opt-in model tests **NOT RUN**. |
| Full mobile regression | `npm test -- --runInBand` in mobile | **428 passed /83 suites, 0 failed/skipped, 5.912s** (after review fix). |
| TypeScript | `npm run typecheck` in mobile | PASS, exit0, 1.84s wall time after review fix. |
| Mobile lint | `npm run lint` in mobile | PASS, exit0, 0.99s wall time after fixing two unnamed router-test components. |
| Python lint/format | `.venv/bin/ruff check src tests scripts`; `.venv/bin/ruff format --check src tests scripts` | PASS, exit0; 104 files already formatted. |
| Disabled Android release package | `./gradlew --offline :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain` in mobile/android | **PASS, 10.06s** wall time after review fix; 980 tasks, 24 executed/956 up-to-date. JS bundle task actually executed with the final source; initial pre-review build also passed in 36.49s with 1,681 modules. Existing debug signing, loopback API, archive stop flag1; Health/Health Connect/widgets0. Not store-ready. |
| Retained artifact verification | `python3 docs/biteflow/evidence/p13-rollback/verify_artifacts.py` | PASS: APK/bundle hashes, ZIP integrity, source trees; compiled `accountExportDisabled` returns true. Cleanup/archive matcher/share helper and visible retry retained, unchanged matcher/session/reader source and full inherited register checked. Static inspection is not device behavior. |
| Native JVM/Swift policy tests, iOS build, Expo all-platform export, Python wheel/sdist, dependency audit/full native lint | — | **NOT RUN again in this follow-up.** No native source changed. Prior P13 and verification results remain separately dated historical evidence; prior iOS/full Android lint failures and 67 npm advisories remain open. Release build skipped Worklets lint analysis; it does not close the full lint gate. |
| Signed physical rollback/erasure, hosted CI/staging, real AI/provider quota, photo benchmark | — | **NOT RUN / BLOCKED**, no authorization or evidence implied. |

One optional Hermes inspection initially failed because executable bytecode was passed without `-b`; after consulting the installed tool help, `-b -dump-bytecode` succeeded. This was an inspection-command error, not a failed app build. The reproducible artifact verifier uses the corrected command.

## Acceptance and remaining gates

| Follow-up requirement | Status | Supporting evidence / limit |
|---|---|---|
| Compatible server stop control, defaults/auth/CSV preserved, no archive traversal while stopped | PASS locally | API/configuration tests; full backend/PostgreSQL/browser suites. |
| Compiled mobile stop control, hidden UI and helper-level guard | PASS locally | Component/helper tests; actual packaged bytecode returns true. |
| Cleanup and security fixes survive stopped exports | PASS locally | Real cleanup/Auth code exercised with fake filesystem on logout/deletion/failure/retry, CSV/session regression, classifier sentinel redaction under both flag profiles; unchanged bounded reader and full regressions. |
| Rollback plan addresses P12/archive/security/data loss caveats | PASS for local preparation | Exact compatible source floor and artifact configuration, drain/restart/cleanup/retry and pending-data preservation documented. |
| Independent critical review and confirmed fixes | PASS locally | One fresh review found 0 Critical /1 Important /0 Minor. Actual root-navigation regression failed 4/4 then passed, with targeted 24/24 and full suites green. No second review claimed. |
| Physical compatible update/cleanup/rollback and signed release | BLOCKED | Mocked filesystem and static bytecode cannot establish OS retention, file protection, external copies or real device behavior. |
| Full P13 exit / P14 entry | BLOCKED | Complete [open-gate register](p13-open-gates.md) retained verbatim below P13 updates. P14 requires an actual separately approved release and explicit phase approval. |

Mandatory release/P14 prerequisites remain: signed supported-device E2E01–20 including accessibility/native privacy, hosted CI/staging migration/restore/reconciliation, corrected/verified iOS toolchain and full native lint, dependency risk resolution, privacy/retention/export support, real quota/policy evidence for any enabled provider, approved monitoring/owners and an actual approved release. Original journal-edit, provenance, photo/OCR/voice/lookup and other affected feature gates remain. Exact10% warning, localization minors and native warnings remain deferred; this follow-up does not silently close any gate.

## Review, commits and recovery

- `581664748d2eb53426ec906514b7ece0775a61fc` — compatible controls and regression tests. Initial control implementation; the later review fix below is also required.
- `7f1ff62cfdfda4fc7bc95da15d9bfd5384d27d04` — compatible rollback plan and initial verification evidence; independent review head.
- `4d9778467d98562f7a5f61131f1ede31051cabc5` — review fix: visible bilingual cleanup warning/retry after credential revocation, with navigation regressions. **Final compatible operational source floor is this fix, not 5816647 alone.**
- Final handoff HEAD adds documentation/review-evidence only. No push or merge.

Keep this branch/worktree and the immutable local APK identified by [manifest](evidence/p13-rollback/manifest.json). The original P13 packages lack the new controls and are not substitutes. Do not deploy plain P12 or revert all P13 commits. Retain compatible P13 cleanup/security code and schema; use both controls at1 after separately approved packaging/operations. No down migration is needed. All P06 label-draft, P07 pending-operation, P09 lease/push, P10/P11 Health receipt and P12 widget cleanup/OS-pixel caveats remain in the rollback plan.

Initial implementation rulings recorded in the execution ledger: use compatible P13 controls instead of a P12 downgrade (cost: older binaries remain unsafe); retain existing cleanup lifecycle rather than add startup cleanup (cost: crash leftovers require an explicit successful cleanup/retry, and physical erasure stays unverified). The review additionally requires visible cleanup state, keeps general startup cleanup excluded, and retains physical, historical and production/P14 gates. All seven rulings and costs are archived in [progress](evidence/p13-rollback/progress.md).

## Final independent review and retained state

[Review and fix evidence](evidence/p13-rollback/review.md) records the one Important finding: direct provider retry tests did not prove a usable recovery screen after logout navigation. Actual RootLayout tests now cover EN/HE logout/deletion, repeated file failure, successful retry, unrelated assets and no restored authentication. The initial native safe-area test-fixture failure, meaningful four-test RED, successful targeted/full reruns and corrected lint failure are all retained. No new Minor finding was deferred.

The rebuilt APK at `4d97784` is identified by the final manifest; the pre-review manifest is preserved separately as historical evidence. The disposable DB and only this plan’s scratch resources were removed after verification. The execution ledger, task briefs and immutable review package are archived with evidence. Branch/worktree remain local; tracked files are clean except the preexisting untracked `.venv` symlink. See [cleanup record](evidence/p13-rollback/cleanup.md).
