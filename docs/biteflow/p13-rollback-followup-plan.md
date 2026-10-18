# P13 compatible rollback follow-up

> **For agentic workers:** Use superpowers:executing-plans inline, with one final fresh-context review. The user explicitly approved this local follow-up; no further implementation approval is needed.

**Goal:** Stop new account exports without losing P13 archive cleanup, export session guards or classifier error redaction.
**Architecture:** Keep the P13 code/schema compatibility floor. Add narrowly scoped server and compiled mobile stop switches; existing CSV, cleanup, authentication and nutrition contracts remain. A plain P12 downgrade or blanket P13 revert is not a supported operational rollback.
**Tech Stack:** Existing FastAPI Settings, Expo SDK 57 / React Native, pytest/Jest and local build tools; no dependencies added.
**Spec:** User-approved P13 verification follow-up; `roadmap.md` P13 rollback requirements, `p13-release-plan.md`, `p13-open-gates.md`, and the approved implementation plan P13/P14 boundaries.

## Global Constraints

Base `49141be841f114530fa606890f1d156e25a24d68`, existing isolated `codex/biteflow-p13` worktree. Local only, AI mocked/off, no production operations, push, merge, deployment, destructive data changes or P14. Preserve all inherited gates and rollback caveats. No schema or native entitlement changes. No physical cleanup/recipient-recall claim from mocks.

## Review Focus

- Disabling new archives must preserve old-client authentication and CSV access, and must not traverse account data (Task 1 API tests).
- A disabled mobile build must not fetch or construct an account archive, even if a stale caller bypasses the hidden UI (Task 1 helper/UI tests).
- Crash-leftover JSON must still be removed on logout/deletion with the export feature disabled; failed cleanup must surface, and pending shares must be revoked before remote logout completes (Task 1 lifecycle tests).
- The safe-error response and bounded export behavior must survive the rollback profile; default behavior remains compatible (Task 1 backend regressions).
- Build-time mobile flags are not a live remote kill switch, and earlier artifacts lack the new controls; a rollback recipe must name its exact compatible source/configuration and preserve external acceptance gates (Task 2).

### Task 1: compatible export stop controls and regression coverage

**Files:** `src/foodlogger/security.py`, `app.py`, `tests/test_privacy.py`; mobile `storage/export.ts`, `components/AccountExport.tsx`, `.env.example`, corresponding storage/component/auth tests.
**Interfaces:** `Settings.account_export_disabled` defaults false; `FOODLOGGER_ACCOUNT_EXPORT_DISABLED=1` returns authenticated 503 before archive reads. `EXPO_PUBLIC_ACCOUNT_EXPORT_DISABLED=1` hides the account-export card and prevents `buildAccountArchive` from loading data. These switches never gate private-file cleanup, CSV sharing/session guards or error redaction. The server setting takes effect when a new process/app is created; mobile value is compiled.
- [ ] Add failing API/configuration and mobile UI/helper tests for disabled behavior and preserved default behavior; run targeted tests and confirm expected RED.
- [ ] Add lifecycle regressions using real cleanup with a fake filesystem: leftover archive on logout/deletion, failures, unrelated-file preservation and CSV export while account archives are disabled. Retain existing pending-logout regression and exercise both profiles.
- [ ] Implement minimal controls; run targeted and full backend/mobile suites, browser, typecheck and lint. Commit verified code/tests.

### Task 2: rollback rehearsal, plan and checkpoint

**Files:** `p13-release-plan.md`, `p13-open-gates.md`, a follow-up checkpoint and evidence under `evidence/p13-rollback/`.
**Interfaces:** task 1 switch names/status/compatibility floor are consumed verbatim; source hashes and build configuration identify the compatible local rollback profile. Original P13 evidence stays historical.
- [ ] Exercise a disabled local Android release bundle/build and record actual results; retain compiled cleanup/security code, preserve all native-off defaults. No signed-device claim.
- [ ] Replace blanket-revert guidance with an explicit stop/drain/compatible-build/cleanup/verify/re-enable sequence. Document the unsafe P12 boundary, cleanup failure/recipient limits, security fixes that must survive, backup/write/deletion reconciliation and unchanged external gates.
- [ ] Commit evidence and run one immutable-range independent review. Fix confirmed Important/Critical findings with RED→GREEN and rerun affected/full suites; archive decisions/results, remove only owned temporary resources and retain the branch. Stop before P14.
