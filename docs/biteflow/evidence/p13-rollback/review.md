# Independent review and one fix pass

Reviewer: fresh `p13_rollback_review`, gpt-6-astra/high. Read-only immutable range `49141be841f114530fa606890f1d156e25a24d68..7f1ff62cfdfda4fc7bc95da15d9bfd5384d27d04`. The reviewer inspected source/plan/evidence and did not rerun suites or change files. No second review was requested.

## Returned findings

Strengths: authenticated server rejection before archive reads; mobile UI/helper stop control; retained CSV/session/cleanup/redaction/bounded reader; exact compatible source/configuration and external gates documented.

Critical: **0**. Important: **1**. Minor: **0**. Initial verdict: **With fixes**, local only.

Important: the new cleanup failure/retry test called `auth.signOut()` directly a second time. In the actual app, `AuthProvider` signed out before file deletion; Settings did not catch that rejection and was removed by protected navigation. A failed deletion left the archive with no visible warning or retry. Relevant reviewed files: `rollback-export-cleanup.test.tsx:44–50`, `AuthProvider.tsx:243–245`, `settings.tsx:51–54`, `_layout.tsx:76–84`. Inherited behavior became material because the follow-up newly promised explicit cleanup/retry.

Reviewer recommendation: keep visible cleanup failure/retry after session revocation, without restoring authentication; add UI/navigation coverage. General startup cleanup is not required by this finding.

## Executor verification and fix

The executor confirmed the real call order and used the existing root widget-cleanup gate as the architectural pattern. New `private-cleanup-navigation.test.tsx` renders actual RootLayout, AuthProvider and cleanup with native router/filesystem/provider boundaries mocked. It exercises logout and deletion in EN/HE, repeated deletion failures, visible warning/retry instead of either navigation destination, successful cleanup, unrelated-file preservation and continued authentication/export revocation.

The first test attempt failed at the native safe-area fixture before reaching the assertion (4 failed). After mocking that native boundary, **4 tests failed at the missing warning**: logout displayed sign-in navigation, deletion retained account navigation. This is the meaningful RED. `review-ui-red.log` and `review-ui-red-corrected.log` retain both attempts.

`4d9778467d98562f7a5f61131f1ede31051cabc5` fixes the finding. AuthProvider holds a `privateCleanupError` and dedicated retry action; file errors become visible state, allowing logout/deletion to finish revoking credentials. Root navigation shows a generic bilingual warning and accessible retry while cleanup is incomplete. Retry runs the same cleanup and never authenticates or enables exports. Existing archive/CSV/photo matcher, session fence and backend reader/redaction are preserved. Settings no longer receives an unhandled file-cleanup rejection. Other unrelated storage failures retain their prior contracts.

GREEN: targeted lifecycle/navigation tests **24/24 in 6 suites**; final mobile **428/428 in 83 suites, 5.912s**; final backend/PostgreSQL **583 passed /9 skipped, 31.93s**; browser six passes from unchanged backend source retained. TypeScript passed. Lint first identified two unnamed mock router components; they were named, then final lint passed. No unresolved Important/Critical finding remains in this local fix pass. No second independent review is implied; fixes are verified by RED→GREEN and complete regression runs.

This deliberately changes cleanup-failure reporting from a rejected logout/deletion promise to the visible Auth/root gate. A resolved logout is not proof of file erasure; the cleanup state and successful verification determine that. The gate is in memory: no general startup cleanup or persisted recovery marker was added. If the app is terminated before successful cleanup, the operational procedure must repeat explicit cleanup in a compatible build. Physical behavior remains unverified.

## Declined to judge, with executor rulings

1. General startup cleanup was explicitly excluded. Executor retains explicit cleanup/retry and discloses process-restart leftovers; adding broad startup cleanup could interfere with pending photo workflows. Cost: manual recovery after process death, no automatic erasure guarantee.
2. Physical erasure, signed-device rollback, OS retention and recipient recall were unavailable locally. Executor keeps these blocked; mocks/static artifacts do not close them. Cost: operational rollback/privacy acceptance remains blocked.
3. Historical native/toolchain/dependency failures and unrelated feature acceptance were unchanged. Executor carries the entire inherited register. Cost: full P13/release readiness remains blocked, including iOS/full native lint/dependency issues.
4. Production deployment and P14 readiness were outside local authorization. Executor makes no operational readiness claim and keeps P14 unopened. Cost: separately approved release and prerequisite verification are still required.

No deferred new Minor findings. Original phase minors remain in the complete open-gate register. All rulings are archived in `progress.md` and disclosed in the handoff.
