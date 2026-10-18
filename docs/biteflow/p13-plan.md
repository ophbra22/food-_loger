# P13 local hardening and release-readiness plan

> **For agentic workers:** Use superpowers:executing-plans inline with one fresh final reviewer. Local P13 is explicitly approved; no release or P14 authorization.

**Goal:** Harden privacy export and chart access, verify existing features, and prepare evidence for a separately approved release.
**Architecture:** Extend the existing authenticated API, account storage boundary and shared UI. No replacement architecture, new telemetry vendor or schema migration.
**Tech Stack:** Existing FastAPI/SQLite/PostgreSQL, Expo 57, React Native, Swift/Kotlin host checks.
**Spec:** `requirements/BiteFlow_SPEC_EN.md`, `requirements/BiteFlow_IMPLEMENTATION_PLAN_EN.md`, `roadmap.md` P13-A/B/C; P12 checkpoint and complete gate register.

## Global Constraints

Local only, AI mocked/off, no production changes/push/merge/deployment/store/provisioning/hosted operations. Preserve source base 8ce7ad3 and all inherited gates/rollback caveats. Defaults for unverified native integrations remain off. P13 full acceptance remains BLOCKED until required device/signing/staging evidence exists. P14 not started. Avoid numerical performance or quality claims without comparable measurements.

## Review Focus

- Account export must not include another owner, credentials, push tokens or raw provider prompts; unknown new tables need explicit inventory review (Task 1).
- Logout/server replacement during asynchronous archive creation must prevent file sharing, and temporary files must be removed on success/failure (Task 2).
- Missing/partial measurements must remain unknown in accessible chart values, in both languages and converted units (Task 2).
- Restore rehearsal must operate only on owned disposable databases and preserve source/new-write reconciliation evidence (Task 3).
- Manifest and matrix must not convert mock/component/build evidence into device, staging or release acceptance (Tasks 3/4).

### Task 1: account privacy inventory and server archive

**Files:** create `src/foodlogger/privacy.py`, `tests/test_privacy.py`; extend `src/foodlogger/app.py`, `tests/test_postgres.py`; document `p13-privacy.md`.
**Interfaces:** `account_archive(database, user_id)` returns versioned JSON of explicit approved columns, account data and disclosed exclusions from one read snapshot. Authenticated `GET /api/account/export`, no-cache attachment, bounded row/byte limits with explicit failure rather than truncation. Existing day CSV unchanged. No credentials or delivery tokens. Inventory every persisted table and deletion rule.
- [ ] Add failing API tests: owner A/B isolation, all data categories, secret exclusion, unauthenticated access, bounds, deletion and transactional rollback; PostgreSQL restricted-role coverage.
- [ ] Implement minimal archive and route; audit cascades/caches, fix confirmed privacy defects with regressions. Run `.venv/bin/python -m pytest tests/test_privacy.py -q` — expected PASS.
- [ ] Commit verified server privacy change.

### Task 2: mobile archive and accessible chart values

**Files:** new account-export helper/component/tests; extend API, Settings, translations, private-file cleanup; `TrendsChart.tsx` and its tests.
**Interfaces:** server archive plus explicitly named account-local drafts/pending operations, independently timed (not a cross-device atomic snapshot). Capture account epoch before async work, validate before file creation/share; share only after explicit user action. Exclude SecureStore/native credentials. Temporary JSON is removed after share/cancel/failure; legacy CSV preserved. Chart has expandable accessible daily values respecting visible layers, missing data, language and units.
- [ ] Add failing tests for revoked account during export, wrong-owner response, cleanup success/failure, unavailable sharing and chart unknown/partial/unit/layer behavior.
- [ ] Implement with SDK57 APIs/current installed types; retain UI and data contracts. Run mobile test suite, typecheck and lint — expected PASS.
- [ ] Commit mobile privacy and accessibility changes.

### Task 3: local P13 verification and rehearsals

**Files:** evidence under `docs/biteflow/evidence/p13/`, `p13-verification-matrix.md`, `p13-privacy.md`; focused tests if confirmed defects found.
**Interfaces:** exact source commit + command/result ledger, E2E01–20 and F01–20 matrix with honest scope/status; safe synthetic local performance measurements; disposable SQLite/PostgreSQL backup/restore and owner-isolation checks; dependency/secret/log review. No live recognition benchmark.
- [ ] Run Python, mobile, browser, PostgreSQL migrations/roles, lint/typecheck, exports/packages and native host/build checks. Record actual failures/skips; signed/device/hosted checks NOT RUN where unavailable.
- [ ] Rehearse copy restore, compare row/data checksums and document later-write reconciliation. Audit feature kill switches, retention, telemetry fields and current primary-source policy references without account operations.
- [ ] Capture feasible local HE/EN simulator observations; no full accessibility or device assertion without evidence. Commit evidence and classified blockers.

### Task 4: reviewable candidate and checkpoint

**Files:** `p13-release-plan.md`, `p13-open-gates.md`, `p13-checkpoint.md`, immutable source/build manifest and review evidence; roadmap/matrix updates.
**Interfaces:** source/build hashes, default-off feature scope, release notes/user guidance, staging/canary prerequisites, named role owners, proposed measurable stop thresholds and exact compatible rollback. All inherited gates copied without silently closing them.
- [ ] Prepare local candidate; staging/canary remain unexecuted and blocked pending explicit scope/access/approval. No production-ready claim.
- [ ] Dispatch one independent review of immutable branch range. Fix confirmed Important/Critical issues with failing-first regressions, rerun affected/full suites. Document deferred minors and every decision.
- [ ] Archive evidence/ledger, remove only owned temporary resources, retain branch/worktree and .venv. Stop before P14.
