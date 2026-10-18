# RC00–RC05 local checkpoint

2026-10-18. Local branch `codex/biteflow-rc00-05`, base `e7f7c9deaae32d600ec4499018451f9cc0612229`; final implementation `5455c494067ea8474affb6375b3a40ff84c1ff02`. Later commits only archive documentation/evidence. Worktree: `/Users/braude/.codex/worktrees/biteflow-p01/food-_loger`. Primary checkout unchanged. Scope ends at RC05.

**The local implementation and review fix are verified; release readiness remains BLOCKED.** RC02 has unresolved security findings and full Android lint failure. RC00 human ownership/device matrix is unassigned. Local native compilation, policy tests and mocked E2E components do not establish device/staging/production acceptance. No live AI or post-release metrics were produced.

## Acceptance by requirement

| Task / criterion | Result | Evidence and remaining boundary |
|---|---|---|
| RC00: preserve F01–F20, E2E-01–20 and inherited gates | PASS locally | [Gate register](gate-register.md):74 inherited entries,40 scope IDs,16 coverage groups; original `p14-open-gates.md` unchanged |
| RC00: inventory environment/access; human owners and supported devices | PASS inventory / BLOCKED signoff | [RC00](RC00.md), recorded tools; no invented account/device availability or owner |
| RC01: reproduce compiler failure and choose supported correction | PASS | [RC01](RC01.md): precompiled ExpoModulesJSI failed; SDK57 source mode compiles on installed Swift6.4 |
| RC01: clean native Debug/Release, modules/extension, two flag modes, tool/input/artifact manifests | PASS locally | Both platforms Debug/Release with five capability flags off/on; compiled artifact assertions,22 JVM/29 Swift checks and cleared JS exports. [RC01](RC01.md) separates clean intermediate builds from final source refreshes |
| RC02: scan source/history, Python, complete image and npm; classify every historical node | PASS bounded audit | [Disposition](dependency-disposition.md); final source/history4417 text entries,213 binary omissions,0 candidates; no remote credential validation |
| RC02: no unresolved relevant Critical/High finding | BLOCKED | npm58 affected nodes (50 high,8 moderate). Image164 OS package/advisory occurrences (44 high,58 medium,61 low,1 unknown;71 distinct IDs),0 Python-package occurrences. Remaining reachability/mitigation not verified or waived |
| RC02: full native lint without exclusions | FAIL / BLOCKED | Worklets KaModule analyzer crash, including actual8.13.2 diagnostic. Compilation and lintVital success do not satisfy this criterion |
| RC03: original/current nutrition basis, explicit override and reconfirmation, no invented density | PASS locally | [RC03](RC03.md); domain/UI tests, original metadata retained over g→ml→g |
| RC03: draft/product/recipe/repeat/copy/export round-trip and historical digest compatibility | PASS locally |26 backend cases and9 mobile cases in final focused run; full suites green; old server rejects unsupported new writes |
| RC03: operational mixed-client rollout/downgrade | BLOCKED external | RC16/19; optional metadata/capability alone does not make arbitrary older writers safe |
| RC04: edit complete saved group through shared review; cancel/time/day/ingredients/legacy handling | PASS locally | [RC04](RC04.md); existing GET/PATCH contracts; real shared editor and provider with mocked HTTP |
| RC04: persist-before-send, exact retry,409/404/account/storage failure; both-day invalidation and goals | PASS locally |57 backend and33 mobile cases in final focused run;2300kcal/150g goal scenario, history preservation, Health subscription/widget lifecycle at mocked OS boundary |
| RC04: concurrent move followed by conflict/reload | PASS after review fix | `5455c49`; explicit known-group route, latest version/day loaded; deleted groups remain unavailable; targeted12/12 and full458/458 |
| RC04: device E2E-04 and real Health/widget effects | BLOCKED external | RC13/14/18, no physical or OS-side claim |
| RC05: separate-process crash→signed-out cleanup, retries, missing/corrupt marker and failed storage | PASS locally | [RC05](RC05.md); actual independent Node processes and disk, alongside RN/auth/export tests;30 final focused cases |
| RC05: preserve foreign files, drafts/receipts, revocation; retain cleanup with export off | PASS locally | Narrow matcher unchanged, session guards retained, process/race/rollback tests |
| RC05: mobile force-kill, lock/reboot, OS caches/backup and operational downgrade | BLOCKED external | RC19; process adapters do not prove OS erasure or recipient-copy recall |

## Changes and architecture

- **RC01:** `mobile/app.config.ts` uses supported Expo source compilation; generated native directories remain generated. No signing/account changes.
- **RC02:** paired package/lock override for `xcode → uuid11.1.1`, three config-plugin test files explicitly use their Node runtime. `Dockerfile.free` patches liblzma, pins the build installer and removes it from the shipping image after dependency installation. No blind Expo major upgrade, audit suppression or dependency-source lint patch.
- **RC03:** `src/foodlogger/domain.py` adds optional `basis_correction`; `app.py` advertises support. Canonical/mobile readers, review UI and existing write paths retain and display original source/nutrition. Old absent/null fields normalize without changing old receipt identity.
- **RC04:** new `meal/edit/[id]` route and `domain/meal-edit.ts`; existing endpoint wrappers, DraftProvider/save-draft and JournalStore gain versioned editing, persistent exact retry and both-date invalidation. Reuses MealAnalysisReview/MealFoodEditor; no second journal or nutrition engine. Pending edits use envelope3 at existing `draft:v2`; older readers fail closed, newer readers still accept ordinary envelope2.
- **RC05:** `storage/private-cleanup-recovery.ts` adds a nonidentifying global marker and serialized cold-start sweep; AuthProvider gates navigation on failed cleanup; export waits for recovery and maintains account/session fencing. Existing private-files matcher and export-session security code remain unchanged.

No SQL schema change or migration was required or applied. No original security/cleanup/speech-guard or inherited gate source was reverted. PostgreSQL tests used an owned disposable loopback database, never a production/staging database. The local storage envelope and global cleanup marker are compatibility changes; they remain part of the rollback floor. [Changed-file and commit inventory](changes.md) lists exact paths and logical commits.

## Actual final test results

Source: `5455c49` (only reporting documents were uncommitted). [All executed commands/results](verification-results.md) and [raw evidence](../evidence/release-readiness/final/) distinguish intermediate RED/failed diagnostics from final results. Counts below are not sums of repeated runs.

| Check | Actual command / scope | Result |
|---|---|---|
| Backend, including disposable PostgreSQL | `.venv/bin/python -m pytest -q -rs --junitxml=runtime/rc00-05-20261018/backend-final.xml` | **664 passed,0 failed,9 skipped**,33.84s pytest time |
| Browser opt-in | `.venv/bin/python -m pytest -m browser -q -rs --junitxml=runtime/rc00-05-20261018/browser-final.xml`, opt-in env | **6 passed,0 failed,0 skipped,667 deselected**,16.98s |
| Unique Python total | Six browser skips subsequently executed separately | **670 unique passed;3 real-model cases NOT RUN** |
| Mobile | `npm test -- --runInBand` in mobile | **458 passed,91 suites;0 failed/0 skipped**,7.214s Jest time |
| TypeScript | `npm run typecheck` | PASS, exit0 |
| JS/TS lint | `npm run lint` | PASS, exit0, no lint errors/warnings |
| Python style | Ruff check and format-check `src tests scripts` | PASS, exit0;111 files already formatted; no separate configured Python typechecker |
| Swift native policies/files | `swiftc` plus three local executables, recorded commands | **29 checks passed**:13 widget,3 file/capability,13 Health |
| JVM policies | widgets/Health `testDebugUnitTest` | **22 passed**,12 Health+10 widget,0 failure/error/skip; same cases in both flag builds, not44 unique |
| Build/package | Clean git archive→wheel/sdist→new offline venv install→fresh installed report | PASS;69 packaged source/data files byte-match both archives; no source PYTHONPATH; output correctly says P14 BLOCKED/no real evidence |
| Shipping-image source | read-only, network-disabled container inspection | PASS;69 package files match final source; image identity recorded |
| Secret scan | detect-secrets1.5.0, all reachable local refs + tracked working text, `--no-verify` |0 candidates/4417 scanned;213 binary blobs omitted; separate decompressed evidence scan342 files/0 candidates; bounded results |
| Whole-image security | Trivy0.76.0, OS+language packages | **FAIL policy**, exit1, unresolved findings as above; scanner itself completed |
| Full Android lint | app+widget+Health lintDebug, no excluded dependencies | **FAIL**, analyzer crash; not a successful lint run |

The9 backend skips were6 opt-in browser cases,2 LiteRT cases and1 ML integration case. Browser cases are now PASS. Three actual model cases remain NOT RUN under mocked-only authorization. No simulator/app UI launch was performed in this wave. Native device UI, signing/provisioning, OS privacy, hosted CI, staging/RLS/mixed-version/restore, provider quotas/policy/quality and all post-release observations were NOT RUN. Do not reinterpret deselection as a failure or a passed test.

The source-mode iOS native matrix, Android artifacts and cleared two-platform JS exports are recorded in RC01 and its manifests. Debug simulator builds normally load JS from Metro; their native success is not proof of an embedded release JS bundle. Release outputs and separate exports are checked explicitly. Release-named Android APKs use the local debug key, never a store credential.

## Review and resolved failures

Independent review covered `e7f7c9d..a00943e`:0 Critical,1 Important,0 Minor. It reproduced a genuine known-group reload failure after another client moved the meal. Fix `5455c49` distinguishes known group IDs from component IDs, fetches directly after conflict, and preserves failure for deleted groups. Failing regression then12/12 targeted and458/458 whole-mobile verified the fix. No second review pass was claimed; final evidence/documents were checked by the executor. [Review record](../evidence/release-readiness/final/review-summary.md) includes every declined-to-judge boundary; [execution decisions](../evidence/release-readiness/final/execution-ledger.md) preserves rulings.

Other actual failed runs are retained: ExpoModulesJSI compiler mismatch fixed by source mode; Android D8 heap exhaustion addressed with6GiB JVM/max2 workers, then a separate clean/build ordering error avoided by regenerating before build; parallel iOS Debug/Release exposed shared Hermes artifact replacement and is now serialized. UUID config tests initially ran under RN browser resolution instead of their actual Node environment; corrected environment and real prebuild pass. New test fixture label/default/idempotency mistakes were repaired without weakening product assertions. RC05 fixtures now create post-startup files because cold-start cleanup intentionally removes old files. No failure is silently relabeled as a pass.

## Outstanding gates and prerequisites

Every inherited gate remains in [gate-register.md](gate-register.md), with original severity and ownership. Main release blockers:

1. RC02 unresolved npm and OS exposure; complete Android lint still crashes. No blanket “dev only” dismissal. Python image dependency ranges also resolve versions different from the shared test environment; full reproducible Python3.12/runtime matrix remains RC16/18.
2. RC00 human owners, supported device/OS matrix, signing and external account access remain unassigned/unverified.
3. RC16 hosted CI, staging roles/RLS/auth, legacy partial/tiny/provenance compatibility, affected pre-P01 owner history and backup/restore reconciliation. No fabricated missing receipt identity.
4. RC12–15/18–19 real iOS/Android device tests: speech permission/offline behavior, Health ownership/deletion/storage loss, widget visibility/cache/lock/reboot, notification delivery/leases, accessibility and performance.
5. RC07–11 privacy/retention, support for large exports, lawful Israeli source coverage/serving evidence, real account quotas/provider policy, licensed held-out photo/OCR/voice data and approved real-model evaluation. Mock results establish none of these.
6. RC06 exact10% macro warning, Hebrew labels, resume refresh, limits and eight native warnings remain deferred at their original severity. RC06 has not started.
7. RC17/19–21 approved telemetry, signing/artifact signoff, release approval, genuine post-release observations. P14 remains blocked for real evidence; no metrics invented.

The user authorized this local wave only. No new device installation, external writes, provider call, push/merge/deployment, store upload or production operation is authorized by this checkpoint. Stop here for review; do not start RC06 or another phase automatically.

## Rollback and recovery

1. **For local development**, retain this branch and artifacts; the unchanged primary checkout/base is available separately. Do not reset or delete this worktree to “roll back” pending evidence. The commits are small and inspectable; a blanket operational revert is unsafe.
2. **For a future operational rollback**, stop new correction/edit entry points while retaining `basis_correction` readers/capability and schema3 pending-edit readers. Resolve uncertain PATCH operations with the same key/body/version against the compatible server. Never turn an edit into POST, erase receipts or force a stale overwrite. No backward migration strips JSON metadata.
3. Keep P13 security, CSV/session fencing, narrow cleanup, **RC05 cold-start recovery and signed-out Retry**. An export-disabled candidate must use `EXPO_PUBLIC_ACCOUNT_EXPORT_DISABLED=1` with compatible source; any separately approved server stop uses `FOODLOGGER_ACCOUNT_EXPORT_DISABLED=1` on every instance with stop/drain checks. These flags are instructions for a later authorized rehearsal, not changes performed here.
4. Keep label drafts, measurement pending operations, notification leases, Health ownership receipts and widget bridges/App Groups. Do not downgrade to P12 or use account deletion as cleanup. A file already shared externally cannot be recalled by local rollback.
5. Historical P13 local APK `runtime/biteflow-p13-rollback-candidate/4d97784-account-export-disabled-local-release.apk` remains unchanged, SHA256 `939cb8229734b894f0ea99db4fc7705f07469c6779f9a84192b3d582a90b4c84`. This proves retention only; it predates the RC03–05 reader/recovery floor and is **not** an approved current downgrade artifact.
6. RC01 toolchain/lockfile rollback must retain compiler-compatible source mode; reverting it reproduces the known local compiler failure. Reverting RC02 patches restores known advisories. Removing runtime pip intentionally means installation/debugging uses a separate build/development image.
7. No production rollback has been rehearsed. Before any release/rollback: validated signed candidate, staged mixed-version data/pending-operation replay, physical export-disabled cleanup/kill/restart/lock/widget-pixel tests, backup reconciliation, identified operators and explicit approval (RC16/19).

The owned disposable PostgreSQL container/volume and temporary credential files were removed after testing. Existing `.venv` symlink and local candidate artifacts are retained. The primary checkout was not modified; its existing unrelated untracked files were left alone.

All local tests used fixture data and mocked AI. Public dependency/advisory downloads were performed, but no provider inference, production modification, push, merge, deployment or destructive migration occurred.
