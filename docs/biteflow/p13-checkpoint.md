# P13 local checkpoint — full acceptance BLOCKED

Local P13 only; P14 not started. This checkpoint carries every inherited gate and rollback caveat. No production modifications, hosted migrations, live AI, push, merge, deployment, store operation or provisioning were performed. All AI transports in automated tests are mocked; routine Python tests block real HTTPX transport. Public policy/package-advisory reads are not AI inference.

Follow-up after verification of `49141be`: [compatible rollback controls and evidence](p13-rollback-checkpoint.md). The results below remain the original P13 checkpoint; use the updated [rollback plan](p13-release-plan.md) instead of blanket-revert guidance.

## Implementation and architecture

1. `src/foodlogger/privacy.py` adds a bounded, versioned account archive with explicit columns for 29 owner-data categories, one read snapshot, credential exclusions and no silent truncation. `GET /api/account/export` uses existing authentication/rate limiting, no-store attachment, explicit 413 and missing-owner handling. Existing day CSV remains compatible.
2. `mobile/src/storage/export.ts`, `export-session.ts`, `AccountExport.tsx`, Settings/API/Auth integration add explicit EN/HE account export with current-device saved drafts/pending measurements, session/owner fences and temporary-file cleanup. Existing day CSV shares the same guarded lifecycle. No global cross-device snapshot or recipient-copy recall claim.
3. `TrendsChart.tsx` exposes expandable daily values with localized dates, units, goals, selected layers and missing/partial distinctions. The SVG and data aggregation architecture remain.
4. Classifier error responses/logging now use fixed messages, preventing raw internal exception/credential text leakage.

No new DB schema, migration, destructive migration or data-contract rewrite. P13 does not alter prior nutrition values, confidence, partial-data semantics or native sync contracts. Rollback needs compatible source, not SQL down migration. Full changed-file inventory: `evidence/p13/changed-files.txt`.

## Actual verification

See `p13-verification-matrix.md`, command ledger and logs. Passing counts are local, not production readiness.

| Check | Exact command (cwd repo unless noted) | Observed result |
|---|---|---|
| Backend + PostgreSQL | `.venv/bin/python -m pytest -q --tb=short` with disposable loopback DB | 576 passed, 9 skipped, 30.83s; includes 29 actual PG cases |
| Browser integration | `.venv/bin/python -m pytest -m browser -q --tb=short` with browser opt-in | 6 passed, 579 deselected, 16.39s |
| Unique Python coverage | Union of above | 582 passed, 0 failed; 3 opt-in model tests NOT RUN |
| Mobile | `npm test -- --runInBand` in mobile | 416 passed /81 suites, 7.014s; 0 skipped |
| TypeScript / lint | `npm run typecheck`; `npm run lint` in mobile | PASS, exit0 |
| Python lint / format | `.venv/bin/ruff check src tests scripts`; `.venv/bin/ruff format --check src tests scripts` | PASS; 104 files formatted |
| Android | `./gradlew :biteflow-widgets:testDebugUnitTest :biteflow-health:testDebugUnitTest :app:assembleDebug :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain` | PASS 131.16s; 22 JVM tests, 0 failures/errors/skips; local debug signing |
| Android full lint | `./gradlew :biteflow-widgets:lintDebug --console=plain` | FAILED 29.30s: inherited Worklets KaModule analyzer error |
| Focused lint | Above with `-PreactNativeArchitectures=arm64-v8a -x :react-native-worklets:lintAnalyzeDebug -x :expo-modules-core:lintAnalyzeDebug` | PASS 9.39s; 0 errors/8 warnings; does not replace full lint |
| Swift policies | `swiftc` source/test pairs then binaries, exact commands in ledger | 13 widget +3 file +13 Health checks PASS |
| Expo packaging | `npx --no-install expo export --platform all --output-dir ../.superpowers/sdd/p13-plan/export-final` | PASS 24.00s, iOS/Android/web |
| Python packaging | clean `git archive 46b3a91`; Python `-m build --no-isolation --outdir ../dist` | wheel+sdist PASS 1.55s |
| Privacy error regression | `pytest tests/test_privacy.py tests/test_api.py -q --tb=short` | 17 passed in 1.94s after observed RED |
| SQLite / PostgreSQL restore | `.venv/bin/python docs/biteflow/evidence/p13/restore_rehearsal.py` | PASS; counts/hashes, double replay, subsequent erasure and second-owner preservation |
| Dependencies | `npm audit --json`; isolated `pip_audit --path .../.venv/lib/python3.11/site-packages --skip-editable --format json --progress-spinner off` | npm FAILED: 67 advisories:50 high / 17 moderate; Python: 77 audited, 0 known, 1 editable excluded |
| Secret scan | Selected private-key/provider/cloud patterns across tracked text files | 1,641 files, 0 pattern matches; not exhaustive/history scan |
| iOS simulator build | Exact command in ledger | Initial FAILED: ExpoModulesJSI interface fails (__ObjC::expo) under Swift6.4/Xcode27.1; precompiled Core also reports a Swift6.3.1/6.4 mismatch. Source-build diagnostic also FAILED 274.94s in ExpoModulesJSI (__ObjC::expo). Experimental configuration reverted; no native dependency patch shipped |
| Android UI smoke | Owned preview emulator, actual local Release APK | Six narrow observations recorded in `evidence/p13/native-smoke.md`: EN/HE export, share-sheet cancellation, daily values and Hebrew text at 1.3 scale. Full device/assistive acceptance remains open |
| Artifact integrity | `.venv/bin/python docs/biteflow/evidence/p13/verify_artifacts.py` | PASS: 5 hashes, archive integrity, matching source trees and packaged privacy code |
| Signed physical / hosted CI / staging / real AI / photo benchmark | — | NOT RUN; remain BLOCKED |

Synthetic timing samples: 30 each after 3 warmups, 0 failures; save p50/p95=2.594/3.099ms, day 2.536/2.782ms, trends 2.919/3.192ms. Single cold archive 4.332ms. In-process SQLite only; no performance improvement, actual recognition latency, production reliability or RTO/RPO claim.

## Review and fixes

Before independent review, tests reproduced and fixed a logout race that could continue an archive export while logout was pending, and the classifier raw-error disclosure. Test fixture mistakes (initial missing registration headers and a unit-label typo) were corrected; their failed attempts are retained. Ruff formatting failures in the added privacy test were fixed and rerun. The independent reviewer found one Important issue: table-wide materialization before the archive byte cap. A regression reproduced 100 rows fetched despite an early oversize condition. SQL pages of 32 and per-row checks fix it; privacy 9/9, full backend/PG and mobile suites pass. Added page completeness/total-row-limit and PostgreSQL multipage tests. No Critical or Minor findings. See `evidence/p13/review.md`; no second reviewer was dispatched.

## Acceptance status

| Requirement | Status | Evidence / blocker |
|---|---|---|
| Local owner export/erasure/privacy regression | PASS locally |29 categories, two owners, credentials excluded, bounds, rate/session fences, SQLite/PG rollback/erasure |
| Daily chart values preserve missing/partial/unit/layer semantics | PASS locally | EN/HE component tests; device screen reader acceptance remains separate |
| P01–P12 regression coverage | PASS locally | Full existing Python/mobile/browser/host-native suites rerun; no new final test failures |
| P13-A full E2E01–20/device/accessibility/performance/signed build matrix | BLOCKED | Partial automation only; physical/signed/real recognition and complete native lint absent |
| P13-B full privacy/retention/security/backup evidence | BLOCKED | Local inventory/export/log/copy-reconciliation evidence passes; hosted recovery/retention/external copies/provider policy/npm risks unresolved |
| P13-C candidate/source/rollback/staging plan | PASS for local preparation only | Source/build manifest, notes/guidance, threshold proposal, rollback and human-owner assignment gates |
| P13-C verified staging/canary/approved rollout | BLOCKED / NOT RUN | No authorization/access or release; no inferred readiness |
| Full P13 exit / P14 entry | BLOCKED | No approved release has occurred; user review plus unmet release gates required |

All gates remain in `p13-open-gates.md`, including exact 10% warning, basis correction provenance, saved-meal editing, held-out photo/OCR, real quotas/terms, hosted CI/staging, physical native/accessibility, dependency and recovery/retention concerns. Deferred native warnings and prior minors remain visible. Local work does not authorize P14.

## Decisions and remaining costs

The complete eight decision rulings are archived in `evidence/p13/progress.md`: local-only acceptance exceptions; additive privacy/accessibility scope; local aggregate telemetry; compatible dependency pins with 67 advisories retained; unchanged iOS configuration after both build modes failed; physical privacy/accessibility gates; hosted/provider/quality gates; and executor reconciliation of the final Android smoke/artifacts without a second review. Each includes its reason and cost. No new Minor review finding was deferred. Inherited minor issues, including the exact 10% warning boundary, Hebrew serving/confidence labels and eight native lint warnings, remain in the complete gate register.

## Commits and recovery

- `7359286` — server account archive and tests/privacy inventory.
- `2d0b3d6` — guarded mobile export, Auth cleanup and accessible chart values.
- `655aa72` — safe classifier failure response/logging and regression.
- `4c0bcb6` — regression, restore, dependency/policy evidence and release gates.
- `46b3a91` — independent review fix: bounded SQL archive reads and regression tests.

The final evidence/checkpoint commit is identified by the handoff branch HEAD. Base is `8ce7ad3889813276d63d4d4e016299605eafa507`. Keep this branch/worktree. P12 is a historical inspection point only; do not use a plain P12 downgrade or blanket P13 revert operationally. Use the compatible P13 stop profile and cleanup/security conditions in the updated rollback plan. Retain all schema/data/receipts and P06 label-draft, P07 pending-operation, P09 token/lease, P10/P11 Health and P12 widget cleanup caveats. See `p13-release-plan.md` for details. No shared branch operation is authorized.

Final implementation is `46b3a91`; the final handoff commit adds documentation/evidence only. Five local candidate packages are retained under `runtime/biteflow-p13-candidate/` and identified by source and SHA256 in `evidence/p13/manifest.json`. The unchanged mobile tree allows the earlier Android/JavaScript packages to represent final mobile source. No iOS package is claimed. Resource teardown and retained-state checks are in `evidence/p13/cleanup.md`.
