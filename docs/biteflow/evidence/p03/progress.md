# SDD ledger — plan: docs/biteflow/roadmap.md

P03 only. Base 3662048. User approved P02 checkpoint; external gates remain open. AI mocked, local disposable databases only, no production/push/deploy/P04.

Pre-flight: P03-A produces owner-scoped append-only goal revisions + version; P03-B consumes the exact same document and current journal snapshots; P03-C derives progress from those snapshots, never writes intake totals.
Pre-flight: Account deletion must cascade revisions; account cache generations and closed JournalStore must suppress late reads/writes. Legacy endpoints and clock navigation remain available when the goals flag is off.

Ruling: Use the roadmap's P03-A/B/C units as task briefs with explicit command evidence, because it is a phase roadmap rather than the helper's numbered plan syntax — cost if wrong: manual task bookkeeping.
Ruling: Manual goals may be individually unset; use append-only, globally versioned owner revisions with local effective dates, explicit opt-in for historical changes, optional target weight and configurable calorie band. Water is target-only until P07 — this avoids inventing missing intake or rewriting history implicitly — cost if wrong: revise this additive contract before enabling it.

Task 1: P03-A in progress — goals API, schema, privacy/concurrency/history tests.
Task 2: P03-B pending — daily read model, goal settings, account-safe cache/optimistic rollback.
Task 3: P03-C pending — clock/progress, localization/accessibility, actual verification and carried gates.

Task 1: complete — P03-A. SQLite red: goals absent. 19 targeted SQLite + 16 PG checks pass. Full real-PG backend suite 346 passed, 9 skipped. First full run caught standalone AuthStore lacking foundation_migrations; removed unnecessary SQLite marker dependency, suite green. Ruff passed; full format check found pre-existing P02 test formatting in test_partial_compatibility.py; format-only cleanup scheduled before final CI checks. P03 daily read-model backend included with its shared revision transaction; mobile integration remains Task 2.
Task 2: in progress — mobile goal domain/store/settings. Domain tests red then green (exact rational differences/percent boundaries).

Task 2: complete — P03-B. Domain/cache/UI tests RED→GREEN. Full mobile 154 tests/27 suites, lint clean, typecheck pass after Expo regenerated route types. Goals consume daily-summary alongside existing journal; cache stores revisions separately and recomputes progress from current confirmed meal data. Read/mutation/logout races, owner erasure, rollback, capability-off, explicit past-date opt-in and HE/EN tested.
Task 3: in progress — DayDial progress and Today. GoalDashboard tests first fail because component/props absent.

Task 3: complete (implementation) — P03-C. GoalDashboard tests RED→GREEN; consumed/target/remaining, inclusive exact bands, macro progress, partial known subtotal, untracked water, no overall completeness score, HE/EN accessibility, clock add/deep-link interactions preserved. Full mobile 160 tests/28 suites, types/lint pass. Full PG backend 347 passed/9 skipped; Ruff/format pass (includes format-only repair to a pre-existing P02 test). Additional near-zero-target overflow and unacknowledged-save regressions RED→GREEN. Native/device/staging/recognition gates still being assessed, no full native E2E claim.

Final: minor (deferred): Client energy-macro mismatch warning can appear at the exact 10% floating-point boundary; server warning uses exact Decimal and targets are never overwritten.
Final: Ruling: Native layout, assistive technology and complete navigation remain acceptance gates; component fixtures cannot certify a full app journey — cost if wrong: an untested layout/accessibility defect could reach activation.
Final: Ruling: Water intake tracking remains P07; P03 stores and labels a target only, as already scoped — cost if wrong: hydration progress arrives in a later phase.
Final: Ruling: No automatic goal estimator in P03, because the specified estimator is optional and manual goals are the approved scope — cost if wrong: users enter their own targets until separately requested.
Final: Ruling: Production/staging migration and recognition quality remain unverified under mock-only/local authorization — cost if wrong: activation must wait for those external checks.

Final: fixed asynchronous goal reload/date race — GoalSettings delayed reload regression RED→GREEN; full mobile suite 161/161 (28 suites), types/lint green. One fix pass complete. Independent reviewer found no Critical issues; advisory boundary warning deferred.

Checkpoint: P03 IMPLEMENTED, UNVERIFIED; 347 backend/161 mobile/6 browser pass; owner test resources cleaned; native/staging/recognition gates carried; P04 unopened. No push/merge/deploy.
