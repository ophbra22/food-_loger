# P11 Health Connect Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans task-by-task. User already authorized local P11 implementation under the approved roadmap; implement inline with one fresh final reviewer.

**Goal:** Add default-off Android Health Connect integration without changing journal/Apple contracts.
**Architecture:** Extend existing tracked Expo module, shared HealthPort/queue and owner-scoped canonical export ledger. Add a separate provider import receipt table; native APIs are mocked in automated tests.
**Tech Stack:** Expo57/RN0.86.3, Kotlin/AndroidX connect-client1.1.0, TypeScript, Python, SQLite/PostgreSQL.
**Spec:** `docs/biteflow/p11-design.md`, approved `requirements/BiteFlow_SPEC_EN.md` F17 and `roadmap.md` P11-A/B/C.

## Global Constraints

P11 only; no P12, live AI, production, deploy/push/merge. Flags off. Existing iOS and journal contracts preserved. Native generated files via config only. Carry every open gate and rollback caveat. Device/store acceptance cannot be inferred from mocks or compilation.

## Review Focus

- Permission changes while an import page is pending must stop data transfer; Task 3 regression.
- Lost API/storage acknowledgement must not advance tokens or resurrect imported deletion; Tasks 1/3 regressions.
- Stale source versions, source identity collision and account changes must not overwrite other data; Tasks 1/2/3 regressions.
- Original instant/offset versus journal display timezone, tiny/zero/unknown nutrition and interval API constraints must not fabricate nutrition/history; Tasks 1/2 policy tests.
- Expired tokens/incomplete scans, source deletions and read-denied emptiness must not imply complete history; Tasks 2/3 regressions and disclosed gates.

### Task 1: Android import receipts and default-off API

Files: new `src/foodlogger/health_connect.py`, `data/health_connect.sql`, additive migration and `tests/test_health_connect.py`; modify app/security and PG tests.
Interfaces: existing `Health.reconcile(owner)`; new `HealthConnect.import_changes(owner, body)` -> `{accepted,weight_dates}`; bounded `events` upsert/delete list; separate provider receipts and source `health_connect` in existing P07 rows.
- [x] Write failing tests: off/auth, provider/owner isolation, source upsert/replay/older/equal-time conflict, delete-before-old-upsert, user-deleted preservation, local-date/offset, atomic rejection and account cascade.
- [x] Run `.venv/bin/python -m pytest -q tests/test_health_connect.py`; expected failures before implementation.
- [x] Implement strict models, owner-locked receipt handling and routes; no old route changes.
- [x] Run new tests and PostgreSQL role/cascade tests; expected pass. Commit logical server change.

### Task 2: Android native capability, permissions and records

Files: Android support under `mobile/modules/biteflow-health`, `plugins/with-health-connect.cjs`, app config; Android adapter and native policy/fake-client tests.
Interfaces: existing bind/stop/status/authorize/applyBatch; new `readPage(session,scope,kind,cursor,from,to)` returns bounded changes plus next cursor/recovery flag. Permissions mapped by group. Native SDK calls behind testable gateway.
- [x] Scaffold official Android platform support; add failing policy/config tests for capability/permissions, unit/interval/upsert/delete identity and token pages.
- [x] Run tests; expected missing behavior failure.
- [x] Implement Kotlin adapter with stable SDK, protected local revision ledger, exact owned deletion and permission activity contract; add plugin rationale/manifest and default-off flag.
- [x] Run native unit/config/adapter tests and actual Android builds; expected pass or precise environment blocker. Commit native change.

### Task 3: Shared incremental synchronization and Android UI

Files: `mobile/src/native/health/{types,sync,android,platform}.ts`; provider/settings/API endpoints and tests; existing tracking invalidation reused.
Interfaces: optional HealthPort incremental pull + Android import API; durable pending page/cursor; iOS fallback retains original behavior/key.
- [x] Write failing tests for loss between page/upload/ack, bounded pagination, token recovery warning, selected/granted permissions, permission-sheet lifecycle, account changes, source display and Android availability/install flow.
- [x] Run targeted Jest tests; expected failures before implementation.
- [x] Implement minimal extension and EN/HE copy; preserve existing logging/Apple paths and no nutrition import.
- [x] Run targeted/full mobile, typecheck/lint. Commit shared queue/UI change.

### Task 4: Final verification, independent review and checkpoint

- [x] Run full Python/PG/browser/mobile suites, Ruff/types/lint, clean-source package, Expo exports, Android native Debug/Release/unit checks and iOS regression compile as relevant.
- [x] Rehearse local schema/write-disable/backup/restore; preserve receipts and identities.
- [x] Dispatch one independent reviewer at immutable commits. Fix confirmed Important/Critical findings with RED→GREEN plus full suites; record rulings/minors.
- [x] Report exact commands/results, source commits, acceptance PASS/FAIL/BLOCKED, all inherited gates and rollback. Physical device/store signing remain BLOCKED without actual evidence. Stop before P12.

Local Tasks 1–4 are implemented, reviewed and reported in [the checkpoint](p11-checkpoint.md). These checkmarks do not complete P11-C: real-device acceptance remains BLOCKED and P12 is not started.
