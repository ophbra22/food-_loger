# SDD ledger — plan: docs/biteflow/roadmap.md

P04 ONLY. Base 714bbf3, branch codex/biteflow-p04, retained attached worktree. User approved P03 with all external/native/deferred gates carried. No live AI, production, push/merge/deploy or P05.

Pre-flight: A library snapshot -> B canonical draft -> existing P02 confirmation/save. Reuse normalized snapshots and receipt identity; no second journal.
Pre-flight: C recipe version -> D selected servings -> same B draft adapter. Preserve ingredient nutrition and immutable historical logs; atomic versioned recipe writes.
Pre-flight: E copy preview consumes A source snapshots and existing P01 receipts; destination-date transactions and explicit timezone/fold/unknown-time choice must prevent silent DST shifts. Never copy goals.
Ruling: Use P04-A/B/C/D/E as task units in the existing phase roadmap, with recorded commands instead of the helper's numbered step syntax — preserves approved scope — cost if wrong: manual task bookkeeping.

Task 1: P04-A pending — recents/favorites service and private schema.
Task 2: P04-B pending — Quick Add/repeat via shared draft.
Task 3: P04-C pending — versioned recipe persistence.
Task 4: P04-D pending — recipe editor/serving flow.
Task 5: P04-E pending — copy preview/confirmation/DST/receipts and final regression/review.

Task 1: P04-A complete — source snapshot recents, search/pagination, unique favorites, owner/deletion tests. RED→GREEN; full PostgreSQL suite 353 passed / 9 skipped (17 PostgreSQL tests). Recipe source extension belongs to C/D.
Ruling: Canonical saved items retain their nutrient records; legacy repeat derives per-100 values from recorded totals and labels historical snapshot scaling, never refreshing catalog data — preserves old saved nutrition — cost if wrong: floating representation may differ by one ULP for a legacy derived ratio.
Task 2: P04-B in progress — shared confirmation, deterministic servings and account-safe cache.

Task 2: P04-B complete — full mobile 169 passed / 31 suites; typecheck and lint pass. Real Quick Add→DraftProvider→shared review→save test uses two button actions for default serving and zero pre-confirm writes. Cache/session/stale-read/failed-favorite tests pass. Native interaction timing remains unverified.
Task 3: P04-C in progress — tests RED for absent recipe API/config; immutable version/items tables and create/duplicate receipts.

Task 3: P04-C complete — recipe CRUD/duplicate/retry, immutable ingredient versions, exact per-serving math, owner/conflict/deletion/grant tests; full backend 361 passed / 9 skipped, including 18 PostgreSQL cases. Initial zero-yield validation failure reproduced and corrected with nested Annotated bound.
Task 4: P04-D in progress — recipe editor component tests RED; same ingredient editor, persistent local form and serving-to-confirmation flow.

Task 4: P04-D complete locally — 172 mobile tests, typecheck and lint pass. Recipe CRUD routes, immutable history viewer, local form/retry persistence, shared ingredient editor, serving preview and shared intake confirmation. Native full E2E-06 and large-type screenshots remain for QA; not claimed verified.
Ruling: Recipe changes append immutable versions and deletion hides the source while preserving its old versions and logged snapshots; the account-erasure cascade still deletes private data — cost if wrong: retention policy may require an explicit version-pruning rule later.
Task 5: P04-E in progress — preview/confirm copy API, shared transactional journal writer, explicit gap/fold/unknown-time handling. Bounded to 20 groups per atomic request with visible selection limit; large days can be copied in reviewed subsets.

Task 5: P04-E local implementation complete — full backend with PostgreSQL 368 passed / 9 skipped (19 PostgreSQL cases); mobile 177 passed / 34 suites, typecheck/lint pass. Copy selection/shared draft confirmation, explicit times, populated-target acknowledgement, owner-locked atomic shared save, source metadata, durable receipt and tombstone handling. Final review, builds/restore and acceptance reporting remain.
Ruling: Bound each atomic copy request to 20 meal groups and show a selection-limit notice for larger days; no silent truncation — cost if wrong: users with larger days need several explicitly reviewed copies rather than one operation.

Final: fixed generated recurring-fraction portions — library draft/persistence/preview/save regression RED→GREEN; exact generated normalized quantities bypass the keyboard precision limit only while unchanged.
Final: fixed invalid intermediate recipe yield crash — component regression RED→GREEN; invalid yields show unknown totals and disable save.
Final: fixed PostgreSQL minimum yield/precision — restricted-role minimum/fraction round-trip regression RED→GREEN; CLI-created NUMERIC migration, decimal writes, explicit public number serialization.
Final: fixed canonical original-portion loss — unchanged/scaled repeat/copy/recipe-edit regressions RED→GREEN; persisted original unit/quantity/conversion/estimation retained and deterministically scaled. The separate P02 explicit basis-correction provenance gate stays open.
Final: fixed stale parent version after recipe reload — route-level external edit→reload→duplicate/delete regression RED→GREEN; reloaded entry propagated to parent.
Final suite after fixes: backend 369 passed / 9 skipped, mobile 181 passed / 35 suites; types and Ruff/format passed; lint initially 2 duplicate-import warnings, imports consolidated and lint rerun.
Final: Ruling: Native/physical E2E-05/06/07, assistive technology and complete RTL/large-text acceptance remain unverified; component evidence does not close them — cost if wrong: undiscovered device-only failures remain a release blocker.
Final: Ruling: Hosted CI, staging, production and live provider-quality/allowance remain outside this local execution — cost if wrong: no release readiness can be inferred from local checks.
Final: Ruling: Keep the visible 20-group atomic-copy limit after review — cost if wrong: larger days require multiple reviewed requests.
Final: Ruling: Keep deleted recipes' historical versions while preserving account erasure — cost if wrong: a future retention policy may need explicit pruning.
Final: Ruling: Carry the exact-10% macro warning, explicit basis-correction provenance and photo protocol/holdout issues without silently closing them — cost if wrong: those known limitations remain for authorized follow-up.
Final: Ruling: Keep existing 0.0001–2000 normalized ingredient bounds; out-of-range selected servings require adjustment — cost if wrong: some otherwise reasonable large/tiny servings cannot be logged directly.
Final QA: maximum-text Hebrew simulator preview exposed truncating nutrient captions in the reused NutritionGrid. Removed the single-line cap so labels wrap; all 181 mobile tests, typecheck/lint rerun. This is a reversible presentation fix verified visually, not a new feature or closure of full accessibility gates.
Final: minor (deferred): Carried P03 exact-10% macro warning floating-point boundary remains unresolved.
Final: minor (deferred): Carried P02 explicit basis correction still lacks original-basis/manualOverride provenance.
Final: minor (deferred): Carried photo protocol needs frozen matching/adjudication/aggregation/model IDs/uncertainty/stopping rules and a larger no-food holdout.

Final checkpoint: all local product fixes committed through 35c3669; 10 final verification records checked at exit 0. Full phase acceptance remains BLOCKED. P05 unopened. Owned database/Metro/simulator resources stopped and removed; tool defaults restored. Evidence archived before deleting only this phase scratch directory. Development branch/worktree and pre-existing dependency symlinks retained.
