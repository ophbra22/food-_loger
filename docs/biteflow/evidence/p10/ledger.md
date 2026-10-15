# SDD ledger — plan: docs/biteflow/p10-plan.md

Pre-flight: Task 1 stable scope/revision/tombstones consumed by Tasks 2–3; durable server mappings survive logout, client queue can safely replay. Task 2 permission/owner generation consumed by Task 3; both layers invalidate before further operations. P10-C device/signing evidence unavailable and cannot be replaced by local tests.

Ruling: use individual quantity samples rather than meal correlations — component IDs already define ownership — cost if wrong: future correlation UX needs a mapping extension.
Ruling: retain server-side mapping/tombstones and replay idempotently; no nutrition read permission — protects retries and prevents loops — cost: bounded full reconciliation is more work than an incremental cursor.

Task 1 implementation and tests: 14 SQLite/API cases + 1 new PG role/cascade case passed; full actual PG-backed backend 550 passed, 9 opt-ins skipped. Schema is additive; official private-role model retained.
Task 2 native policy and config tests pass; Debug/Release native compilation pending. Signing identity present but profile/entitlement/device access unverified.
Task 3 adapter/queue/UI implemented; 21 targeted tests pass, TypeScript and lint pass. Full mobile initial 329 passed; four later queue scenarios now added.
Ruling: retain legacy date-only meals without inventing an export instant — existing unified confirmation already accepts explicit timestamp/timezone — cost: those historical records stay withheld until corrected through a compatible workflow.
Ruling: foreground-only sync, no background-delivery entitlement — avoids claiming OS execution guarantees — cost: background edits reconcile on next foreground sync.

Task 2 native validation: unsigned iOS Debug simulator PASS 255.33s; Release simulator PASS 244.55s. Native policy 9 cases PASS. Physical device/Health access/signed profiles NOT RUN.
Task 3 complete: mobile 333 tests/67 suites PASS, types/lint PASS; all-platform export PASS.
Task 4 candidate: backend 550 + browser 6 unique passing tests; 3 optional ML tests NOT RUN; local PG rollback/restore PASS. Independent review dispatched at 26527bd.
Ruling: bounded full reconciliation (10,000 quantity records) and 30-day import (1,000 samples/type) fail closed on overflow — avoids silent truncation — cost: large histories need pagination before live enablement.

Final review at 26527bd: three Important findings accepted: concurrent consent restore, quadratic queue persistence, stale imported-weight views. Zero Critical/minor findings. Parent additionally tests permission-modal inactive transitions and disconnect/queue ordering in the same fix pass.
Final: Ruling: device permissions, background/HealthKit behavior, data protection, signing and E2E-16/19/20 remain unverified — local builds cannot establish real behavior — cost: local code must remain disabled for live use until device evidence.
Final: Ruling: reinstall/ledger loss, multiple devices, external edits/deletes and user deletion of Health samples remain live-enablement gates — no hidden repair promise — cost: duplicates, resurrection or stale data possible without an approved reconciliation policy.
Final: Ruling: retain explicit query/history caps and withheld unknown dates/individual quantity samples — consistent with prior design rulings — cost: volume and richer meal grouping require later work.
Final: Ruling: hosted recovery, live AI quotas and operational privacy approval remain blocked — outside authorized local work — cost: no production-readiness conclusion is possible.

Ruling: use the server's durable outbox and compact client revision checkpoints in batches of 50 instead of rewriting full pending payloads — makes unchanged history a no-op and bounds checkpoint traffic — cost: a lost client checkpoint replays through the native ledger and requires server access for reconciliation.

Final: fixed concurrent consent restore — overlapping startup/connection RED→GREEN; full mobile 341/341 tests, 68/68 suites PASS.
Final: fixed quadratic full-payload persistence — 1,000-record history RED→GREEN; first sync 21 writes/393,856 serialized bytes/20 native batches, unchanged/restart skips native replay. Full mobile suite PASS.
Final: fixed stale imported-weight state — API/queue/tracking RED→GREEN; actual PG-backed backend 550 PASS + browser 6 PASS; full mobile PASS. Duplicate imports emit no changed dates.
Final: fixed permission-sheet inactive cancellation — actual provider RED→GREEN; background still pauses. Native batch policy RED→GREEN, 13/13 cases PASS.
Task 4 local regression checks: types/lint/Ruff(100 files)/package/all-platform export/local PG rollback+restore PASS. Actual iOS Debug post-fix unsigned build PASS; Release checks pending. Source fix commit f754bed. Full P10-C remains BLOCKED.

Task 4 final native compilation: Debug simulator 207.17s PASS; Release simulator 205.01s PASS; unsigned iPhoneOS Release 111.14s PASS. No signed/runtime/physical acceptance. Clean-source f754bed wheel/sdist PASS. Expanded local PG restore preserved exact scope/export tombstone/import receipt/tracking rows.
