# BiteFlow P00 — Feature inventory and implementation tickets

## P13 local hardening update — full acceptance BLOCKED

P13 adds owner-scoped account export, guarded mobile sharing/cleanup, accessible daily chart values and fixed classifier error redaction. Existing architecture/contracts remain. Full F01–F20 DoD and E2E01–20 evidence is mapped in [P13 verification matrix](p13-verification-matrix.md); no full physical or production acceptance is inferred from local tests. See [checkpoint](p13-checkpoint.md), [complete gates](p13-open-gates.md), [privacy review](p13-privacy.md) and [candidate/rollback plan](p13-release-plan.md). P14 is NOT STARTED; it requires a separately approved actual release. Historical phase statements below retain their original scope.


## P11 update — 2026-10-16

User explicitly approved local P11 carrying every gate and rollback caveat forward. **F17 is Partial against full acceptance.** Local implementation provides Android Health Connect capability/permission UI and native bridge, Weight/Steps imports, nutrition/water exports, shared stable record revisions, independent durable per-kind change queues and protected Android receipts. Three independent review findings are fixed. Android Debug/Release builds, 12 fake-gateway JVM tests, full 362-case mobile suite and PostgreSQL/SQLite checks pass. Final blank API37 preview-emulator smoke proves only launch/rationale. Real permission/sync/dedup/device E2E-16/19/20 and production signing remain BLOCKED. See [checkpoint](p11-checkpoint.md), [gates](p11-open-gates.md), [rollback](rollback-p11.sql), [evidence](evidence/p11/README.md).

Exact sources: `src/foodlogger/health_connect.py`, `data/health_connect.sql`, `supabase/migrations/20261016055042_p11_health_connect.sql`; `mobile/modules/biteflow-health/android/`, `mobile/plugins/with-health-connect.cjs`, `mobile/src/native/health/{android,platform,sync,types}.ts`, `mobile/src/components/{HealthProvider,HealthSettings}.tsx`, `mobile/src/data/tracking-store.ts`. Existing auth, journal and iOS contracts remain. Flags default off; no real AI/Health data or production operations. Full transitive native lint failed in dependency analysis; focused native lint has 0 errors/2 warnings. P12 is NOT STARTED. Historical updates below retain their original temporal scope.

## P10 update — 2026-10-15

User explicitly approved local P10 with every open gate and rollback caveat carried forward. **F16 remains Partial against full acceptance.** Local implementation covers an Apple-only Expo/HealthKit module, independently selected permissions, read-permission ambiguity, weight/step provenance imports, kcal/macros/water exports, stable owner/sample/revision identities, tombstones and foreground retry/reconciliation. SQLite/API, PostgreSQL, mocked mobile and native policy tests pass; unsigned native build evidence is separate from real Health access. Three independent review findings and an author-confirmed permission-sheet lifecycle issue are fixed. See [checkpoint](p10-checkpoint.md), [design/rollback](p10-design.md), [gates](p10-open-gates.md), and [evidence](evidence/p10/README.md).

| Feature | Exact implementation evidence | Verification boundary |
|---|---|---|
| F16 Apple Health | `src/foodlogger/health.py`, `data/health.sql`, `supabase/migrations/20261015141516_p10_health.sql`; `mobile/modules/biteflow-health/`, `plugins/with-health.cjs`, `src/native/health/`, `components/HealthProvider.tsx`, `HealthSettings.tsx`, `app/(app)/health.tsx` | Local repeated sync, revisions/deletes, crash replay, owner isolation, permissions mocks and cache invalidation pass. Real-device E2E-16/19/20, signed release, reinstall/multiple-device recovery, data protection and privacy approval remain BLOCKED. |

No dietary reimport route, invented legacy timestamp, verified-nutrition claim, production migration or real Health access. Flags default off. P11 remains NOT STARTED and needs explicit approval. Earlier phase updates retain their historical temporal scope.

## P09 update — 2026-10-15

User approved P08 carrying all gates and rollback caveats, authorizing P09 only. **F15 is Partial against full acceptance.** Local owner-isolated opt-in preferences, derived confirmed-log streaks, category/water/quiet-hour/DST eligibility, at-most-once dispatch, mocked transport and EN/HE notification settings are implemented. Device registration/lifecycle is guarded; all push flags default off. See [checkpoint](p09-checkpoint.md), [design and rollback](p09-design.md), [gates](p09-open-gates.md), and [evidence](evidence/p09/README.md). Required device E2E-15/18/20 and real delivery remain BLOCKED. P10 is unopened. Historical inventory below remains the P00 baseline.

## P08 update — 2026-10-15

User approved P07 carrying all gates and rollback caveats, authorizing P08 only. See [P08 checkpoint](p08-checkpoint.md), [operations](p08-operations.md), [gates](p08-open-gates.md) and [evidence](evidence/p08/README.md). **F12/F13 remain Partial against full acceptance.** Local deterministic weekly reviews, restriction filtering/ranking, optional bounded mocked wording and EN/HE shared-draft UI are implemented; full native, provider and hosted acceptance remains BLOCKED. P09 is unopened. Historical sections below retain their original temporal scope.


## P07 update — 2026-10-15

User approved P06 with open gates and the label-draft rollback caveat, authorizing P07 only. See [P07 checkpoint](p07-checkpoint.md), [operations](p07-operations.md), [carried gates](p07-open-gates.md), and [evidence](evidence/p07/README.md). **F02/F03/F19 remain Partial against full acceptance.** P07 local implementation and all five review fixes are verified; Android compilation, physical-device/full native E2E and hosted validation remain BLOCKED. P08 is unopened. Historical updates below retain their original temporal scope.

| Feature | Exact implementation evidence | Verification boundary |
|---|---|---|
| F02 trends | `src/foodlogger/trends.py`; `mobile/src/domain/trends.ts`, `data/trends-store.ts`, `components/TrendsChart.tsx`, `app/(app)/trends.tsx` | Dated goal joins, explicit denominators, gaps, previous equivalent period, provenance and cache invalidation pass; full native E2E-12/20 unverified |
| F03 weight | `src/foodlogger/tracking.py`, `data/tracking.sql`; `mobile/src/components/TrackingScreen.tsx`, `TrackingPanel.tsx`, `app/(app)/weight.tsx` | Owner CRUD/version/retry, measurement-time chronology, kg/lb, daily latest and measured-date means pass; physical E2E-11 and real health sync remain open/later-phase |
| F19 hydration | same private tracking repository; `mobile/src/components/WaterToday.tsx`, `app/(app)/water.tsx`, `data/tracking-store.ts` | 250+500=750/delete250=500, target progress, ml/fl oz, retry/error reconciliation and EN/HE previews pass; native E2E-10/20 and later widget/health/reminder integration not claimed |

Two additive private tables, separate default-off read/write/trends flags and non-destructive rollback preserve data. Original snapshots/canonical nutrition and goal contracts remain authoritative. Final local evidence:467 backend+6 separate browser passes;263 mobile passes; type/lint/package/Expo exports and iOS simulator native build pass. Android fails missing Java. Three optional model tests NOT RUN. No provider calls/production/push/deploy. All prior gates remain in the checkpoint.

## P06 update — 2026-10-14

See [P06 checkpoint](p06-checkpoint.md), [source evidence](p06-sources.md), [operations/rollback](p06-operations.md) and [verification evidence](evidence/p06/README.md). **F09/F10/F11 remain Partial against complete acceptance.** P05 was approved with open gates; P06 implementation is local, with real Hebrew camera OCR, physical-device native journeys and hosted validation BLOCKED. P07 is unopened. Historical checkpoint statements below remain unchanged.

| Feature | Implemented locally | Remaining evidence / scope limitation |
|---|---|---|
| F09 label OCR/private products | `label_input.py`, `private_products.py`, shared review plus `LabelEntry`/`PrivateProductSave`; strict bilingual observations and editable manual parsing, mocked gateway OCR, owner versions/cache/reuse | Automatic OCR default-off; one actual retailer transcription, no held-out camera-image quality metrics or complete native journey |
| F10 Israeli sources | `food_providers.py`, regional aliases, versioned USDA/OFF candidates, explicit dry-run importer and visible attribution | Ministry CSV returned 403; lawful fallback documented, no official rows fabricated/imported; broad Israeli coverage remains partial |
| F11 household measures | `servings.py`, `servings.json`, additive migration, shared `ServingSelector`; 27 evidence-backed conversions pinned to seven food IDs/version, original unit snapshots | Unknown foods/units/densities require weighed input; full device/RTL usability and broader source-backed measures unverified |

Five additive tables and four default-off controls preserve staged activation and rollback. Existing canonical nutrition/writer remains authoritative; no P07 code. All prior provider, hosted, device, macro-boundary, provenance, photo and speech gates remain open. Final actual counts, review fixes and local commit identities are in the checkpoint.

## P05 update — 2026-10-14

See [P05 checkpoint](p05-checkpoint.md), [operations/rollback](p05-operations.md), [speech feasibility](p05-speech-feasibility.md) and [evidence](evidence/p05/README.md). **F06/F07 remain Partial against complete native acceptance.** User approved local P05 continuation with P04's open gates; P06 is unopened. Historical checkpoint statements below are preserved.

| Scope | Exact implementation evidence | Verification boundary |
|---|---|---|
| F06 deterministic text / ambiguity fallback | `src/foodlogger/text_input.py`, authenticated route in `app.py`; `tests/test_text_input.py`, `tests/fixtures/text-phrases.json`; mobile `domain/text-input.ts`, `components/TextEntry.tsx`, `app/(app)/add/text.tsx` | Required EN/HE/code-switching parsing, unknown quantities, catalog provenance, bounded mocked AI/quota failure, unsaved proposals and same review; no actual provider or complete native E2E-02 |
| F07 speech adapter / permission config | `mobile/src/native/speech.ts`, `app.config.ts`, `plugins/with-on-device-speech.cjs`, pinned package/lock | On-device guard, permission/refusal/revocation/stop/cancel/background/time limits in mocked tests; generated config and iOS compile pass; real microphone/HE/EN accuracy/privacy unverified; Android build blocked |
| F07 editable transcript / same confirmation | `mobile/src/components/VoiceControls.tsx`, `TextEntry.tsx`, `app/(app)/add/voice.tsx`, `VoiceEntry.test.tsx` | Required Hebrew mocked transcript can be corrected and passed to the same parser/review/save, denial leaves typing; account cleanup verified locally; no real STT or full E2E-03/20 claim |

P05 introduces no schema migration and no nutrition source/density data. Voice and AI fallback default off. Earlier provider, hosted, physical-device, exact-10% macro, explicit basis-correction and photo-protocol/holdout gates remain open; compile evidence does not close them. Final counts/review fixes are in the checkpoint.

## P04 update — 2026-10-14

See [P04 checkpoint](p04-checkpoint.md), [operations/rollback](p04-operations.md) and [evidence](evidence/p04/README.md). **F04/F05/F08 remain Partial against full acceptance.** P04-A–E are locally implemented and tested; complete native E2E-05/06/07, accessibility, physical-device and hosted validation remain BLOCKED/unverified. P04 is not claimed complete. P05 remains unopened.

| Scope | Exact implementation evidence | Actual verification / open gate |
|---|---|---|
| F04 recents/favorites/Quick Add | `src/foodlogger/library.py`, `data/library.sql`; `mobile/src/components/LibraryPanel.tsx`, `data/library-store.ts`, `domain/library.ts`, `app/(app)/library.tsx` | Owner/search/pagination/deletion/cache/session tests; two-action default repeat through shared confirmation, zero AI. Full native E2E-05 open |
| F05 saved recipes | `src/foodlogger/recipes.py`, `data/recipes.sql`; `mobile/src/components/RecipeEditor.tsx`, `app/(app)/recipes/`, `domain/recipes.ts` | Immutable versions, fractional/minimum yield, CRUD/duplicate/retry/races, original portions, conflict reload and frozen logs pass locally; full E2E-06 open |
| F08 meal/day copy | `src/foodlogger/copying.py`, shared `meal_service.py`; `mobile/src/components/{CopySelection,CopyReview}.tsx`, `domain/copying.ts`, `app/(app)/copy.tsx` | Preview/acknowledgement, DST/travel/unknown times, atomic rollback, concurrent retry/tombstone/source/goal invariants pass; full E2E-07 open |

Final P04 evidence: **369 backend passed (9 documented skips), 181 mobile passed, 6 browser passed**; types/lint/Ruff/format/package/both Hermes JS exports and local PostgreSQL restore passed. Independent review found five Important issues, all reproduced and fixed. Three default-off flags, additive migrations and retained receipts/history support rollback. No live AI, production operation, push, merge, deployment or P05 implementation. All prior quota/policy, staging, device, exact-10% warning, explicit basis-correction and photo-protocol/holdout gates carry forward.

## P03 update — 2026-10-14

See [P03 checkpoint](p03-checkpoint.md) and [operations](p03-operations.md). **F01 remains Partial against full acceptance**, with goals/history/settings/DayDial progress now implemented locally; F19 now has goal definition only, with hydration logs still P07. The P00 inventory below is historical. Earlier phase “unopened” statements describe their dated checkpoints; the P04 overlay above records subsequent local work.

| Scope | Exact implementation evidence | Actual verification / open gate |
|---|---|---|
| F01 goal revisions/read model | `src/foodlogger/goals.py`, `data/goals.sql`, `app.py`, migration `20261014030916_p03_goal_revisions.sql` | SQLite/PostgreSQL owner/version/date/erasure/progress tests and local restore pass; staging unverified |
| F01 settings/cache | `mobile/src/app/(app)/goals.tsx`, `components/GoalSettings.tsx`, `data/goals-store.ts`, `storage/goals-cache.ts` | Validation, history, stale-response, rollback and account-race tests pass; complete native flow unverified |
| F01 Today/clock | `mobile/src/components/{DayDial,GoalDashboard}.tsx`, `domain/goals.ts`, `data/journal-store.ts`, Today/i18n | Exact 90–110%/protein threshold and mutation tests pass; synthetic EN/HE iOS component captures only; saved-meal edit screen absent |
| F19 target | Same goal contract, form and target-only water card | No fabricated hydration intake; water tracking remains P07 |

P03 final evidence: **347 backend tests passed (9 skipped), 161 mobile tests passed, 6 browser tests passed**, types/lint/Ruff/package/both JS exports passed. No new AI metrics or production operations. Existing P02 recognition/device/staging gates carry forward.

## P02 update — 2026-10-13

See [P02 checkpoint](p02-checkpoint.md). Partial/tiny compatibility is resolved in disposable SQLite/PostgreSQL tests with explicit v2 reads and v1 upgrade rejection; new writers remain off by default. Shared adapters/editor and photo cancellation are implemented locally. F20 remains **Partial** because real device/staging and recognition-quality gates are open. The P00/P01 baseline assertions below describe their original checkpoints; P02 evidence supersedes the earlier statement that partial/tiny writes are universally disabled. At that P02 checkpoint, P03 remained unopened.

Baseline: `9198d94e003e1aefff2ccfd44e741eb21efa7d5e`, audited 2026-10-13. Read [current-state.md](current-state.md) first and [roadmap.md](roadmap.md) for PR sequencing. Product requirements: [spec](requirements/BiteFlow_SPEC_EN.md), [phase plan](requirements/BiteFlow_IMPLEMENTATION_PLAN_EN.md).

**Inventory is not delivery status.** “Implemented” would mean the complete requested behavior exists; “partial” means substantive feature behavior exists but requirements remain; “missing” means the requested feature is absent, even if useful primitives exist. None is fully implemented/verified against the new spec. At the P00 baseline all proposed work below was **NOT STARTED**. The P01 overlay below records subsequent local foundations; no ticket has staging/device/released status.

## P01 progress overlay — local only

P00 was explicitly approved and P01-A–F were implemented on `codex/biteflow-p01`. See [P01 checkpoint](p01-checkpoint.md) for current review/test status and blockers and [operations](p01-operations.md) for activation/rollback. The inventory table below remains the immutable P00 feature assessment; P01 foundations do not make any full feature complete.

| Scope | Actual P01 addition | Remaining gate |
| --- | --- | --- |
| F14 | `src/foodlogger/ai_gateway.py`, attempt/policy SQL, `vision.py` per-attempt wrapper, authenticated capability/admin budget routes in `app.py`, explicit server flags in `security.py`; mocked SQLite/PostgreSQL concurrency tests | Actual project/model/tier/billing/allowance verification and external traffic allocation; live flags remain off. No paid-cost measurement. |
| F20 and shared food inputs | Canonical `domain.py` / `nutrition_engine.py` and `mobile/src/domain/canonical.ts`; additive groups, durable receipts, versioned mutations; draft persistence/invalidation and browser retry identity | P02 adapters/editor/photo benchmark; real-device flow. Partial-core and tiny writes remain disabled under legacy compatibility constraints. |
| All later owner-scoped features | Foundation migration/backfill ledger, backend-role restrictions, cache change event/revision and test/CI plumbing | Staging/remote-CI execution, feature-specific later phases. No goals, trends, recipes, health, widgets or additional input flows were implemented. |

## Inventory: 5 partial, 15 missing

| ID | Requested feature | Inventory | Exact evidence in audited repository | Gap / reuse decision |
|---|---|---|---|---|
| F01 | Personal goals & DayDial | **Partial** | `mobile/src/components/DayDial.tsx`, `mobile/src/domain/dial.ts`, `mobile/src/app/(app)/index.tsx`; `src/foodlogger/app.py:647` daily read | Clock, consumed totals and macro-energy split exist. No goal storage/settings/revisions/remaining/progress/no-goal UX. Extend clock and Today. |
| F02 | Weekly/monthly trends | **Missing** | `src/foodlogger/app.py:647` only one-day query; `mobile/src/data/useDay.ts`; complete route tree has no Trends | Day browsing/CSV is not period analytics. Add range queries, logged-day denominators, effective historical goals. |
| F03 | Body weight | **Missing** | Both `supabase/migrations/*.sql` define no weight table; `mobile/src/api/endpoints.ts` no weight API | Photo estimated food mass is not body weight. Add measurement CRUD, kg/lb, daily latest and actual-date averages. |
| F04 | Recents, favorites, eat again | **Missing** | `mobile/src/app/(app)/add/index.tsx:29` lists photo/barcode/catalog/manual only; `src/foodlogger/storage.py:140` lists a day | Current journal list is not a recents/favorite/repeat feature. Reuse snapshots, draft and idempotency primitives. |
| F05 | Saved meals and recipes | **Missing** | `src/foodlogger/app.py:608–664` is journal create/list/delete; `docs/superpowers/specs/2026-10-13-biteflow-library-and-speed-design.md` explicitly says proposal, not implemented | No saved-meal API even for create/delete in this checkout; do not confuse journal entries with recipes. Full versioned catalog CRUD needed. |
| F06 | Hebrew/English food text | **Missing** | `mobile/src/app/(app)/add/photo.tsx:29` context belongs to photo; `nutrition_reference.py:18` aliases only support search | No phrase parser or text-ingestion endpoint. Reuse references and shared editor, not photo context as a new pipeline. |
| F07 | Voice food logging | **Missing** | `mobile/package.json`; `mobile/app.config.ts:55` blocks Android audio, camera/picker disable mic | No recording/transcription. Verify Hebrew STT support, permissions and cost before choosing native/cloud implementation. |
| F08 | Copy meal/day | **Missing** | No copy routes in `src/foodlogger/app.py` or `mobile/src/api/endpoints.ts`; `domain/dates.ts` only calendar navigation | Add snapshot copying, preview, populated-target confirmation and DST-safe local-time policy. |
| F09 | Nutrition-label OCR | **Missing** | `src/foodlogger/products.py:70` decodes barcodes; `mobile/src/app/(app)/add/barcode.tsx`; manual label fields in `add/review.tsx` | Barcode decoding and manual nutrition entry are implemented but do not read label text. Add OCR/label parser/private products. |
| F10 | Israeli sources & resolution | **Partial** | `src/foodlogger/nutrition_reference.py:18`, `data/usda_reference.json`, `products.py:223`, `scripts/import_usda_reference.py` | Actual USDA extract, OFF and limited Hebrew aliases exist. No Israeli official import, unified verified-source precedence or broad regional coverage. |
| F11 | Food-specific household units | **Partial** | `src/foodlogger/products.py:117`, `schemas.py:52`, `mobile/src/domain/nutrition.ts`, `add/review.tsx` | g/ml and product serving metadata/shortcut exist. No food-specific tablespoons/cups/pieces/half-pita conversion records or original-unit snapshot. |
| F12 | Weekly nutrition summary | **Missing** | `app.py` and `mobile/src/app/(app)/index.tsx` only daily totals | No deterministic weekly metrics, templates/AI wording or revision-keyed insights cache. |
| F13 | What should I eat now? | **Missing** | No preference/allergy tables or recommendation routes in migrations/API | Add opt-in restrictions, deterministic candidates/ranking, editable selection and no-AI fallback. |
| F14 | Central AI quota/cost/fallback | **Partial** | `src/foodlogger/vision.py:195`, `meal_analysis.py:39`, `security.py:52`, `app.py:507` | Server-only provider, transient retry, 429 handling and private cache exist. No durable project/feature budgets, reservations/cost ledger or admin view; actual account quota could not be reverified. |
| F15 | Reminders, notifications, streaks | **Missing** | `mobile/package.json` no notification dependency; `app.py`/migrations no preferences/scheduler | No opt-in reminders, quiet hours or consecutive confirmed-meal local-date calculation. |
| F16 | Apple Health | **Missing** | `mobile/app.config.ts`, `package.json`, generated native capability inspection | Apple **sign-in** exists; HealthKit does not. Add compatible native bridge, minimal permissions, mappings and device tests. |
| F17 | Android Health Connect | **Missing** | Same config/dependency inspection; no Health Connect manifest/API/adapters | Add capability detection and nutrition/water writes, weight/steps reads, incremental synchronization. |
| F18 | Native home-screen widgets | **Partial — local P12 implemented; full acceptance BLOCKED** | `mobile/src/native/widgets/`, `mobile/modules/biteflow-widgets/`, `mobile/widgets/ios/BiteflowWidget.swift`, `mobile/plugins/with-widgets.cjs`, `WidgetProvider.tsx`, `WidgetSettings.tsx`; see `p12-checkpoint.md` | Protected snapshots, native small/medium widget code, auth cleanup and refresh requests tested locally. Physical install/display/privacy/scheduling/RTL acceptance remains open. |
| F19 | Water/hydration | **Missing** | `schemas.py`, migrations, endpoint list, Today contain no water records | Liquid food `basis_unit=ml` is not hydration. Add independent water records and revisions/aggregation. |
| F20 | Multi-food photo recognition | **Partial** | `mobile/src/app/(app)/add/photo.tsx`, `components/MealAnalysisReview.tsx`, `MealFoodEditor.tsx`, `src/foodlogger/{meal_analysis,vision,analysis_journal}.py`, `evaluations/meal_analysis/` | Multi-item analysis, review, USDA resolution, warnings and atomic save already implemented. Shared contract, unrounded math, durable receipts, calibrated/expanded benchmark and fresh device-quality validation remain. |

Missing-feature evidence is negative evidence from the complete API/route/schema/dependency inventory, not a claim that a similarly named string never appears anywhere. Historical screenshots/release notes do not upgrade these states.

## Ticket rules applying to every F-ID

Each F-ID below is a local tracked planning ticket; no external tracker issues were created. Existing paths are reused, and **NEW** paths are proposed only. Future implementers must resolve exact migration filenames with the repository's migration tooling at implementation time, never pretend planned paths exist today.

Every ticket inherits: authenticated owner scope; runtime validation; versioned historical snapshots; no implicit save; account-safe cache/event invalidation; loading/empty/partial/error/offline/cancel states; Hebrew RTL/English LTR/dynamic type; sign-out/account deletion; compatible legacy endpoints. Native tickets add unavailable/denied/partial/revoked permission states. PR-specific tests and evidence must pass before advancing. Flags default off for unvalidated new capabilities.

Evidence to attach on completion: exact commit/diff, check commands and output, migration/rehearsal report when relevant, screenshots for changed UI, fixture metrics for AI/OCR, and native build/device/OS results where required. P00 evidence only supports existing behavior. Full plan DoD still applies; code alone is never “DONE.”

### F01 — goals and dashboard

- **Owner phase/PRs:** P01 contracts; P03-A/B/C. Dependencies: P01, P02. Existing paths: `mobile/src/components/DayDial.tsx`, `(app)/index.tsx`, `(app)/settings.tsx`, `data/journal-store.ts`, `src/foodlogger/app.py`.
- **Proposed interfaces/data:** NEW `src/foodlogger/goals.py`, `mobile/src/domain/goals.ts`, `(app)/goals.tsx`; owner-scoped goal revisions. `GET/PUT /api/goals`, `GET /api/daily-summary?date=`; effective local date, kcal/protein/carbs/fat/water, optional target weight.
- **UX/DoD:** manual goals first; no-goal state; consumed/target/remaining/percentage, calorie 90–110%, protein >=100%, disclosed meaning and incomplete-logging caveat. Preserve dark clock navigation; warn on mismatched macros without overwriting inputs. Optimistic change visibly rolls back on failure.
- **Tests/evidence:** E2E-04/20, 2,300 kcal/150g protein fixture, invalid goals, tomorrow revision preserving yesterday, add/edit/delete and account-switch cache invalidation. Existing dial/date unit tests are starting evidence only.
- **Rollback:** gate goal UI/read model; retain revisions. Never reset goals or recompute old meal snapshots.

### F02 — trends

- **Owner:** P07-B/C; dependencies P03/P04. Reuse `storage.py`, `useDay.ts`, date/i18n helpers. NEW `src/foodlogger/trends.py`, `(app)/trends.tsx`, `mobile/src/domain/trends.ts`.
- **Interfaces/data:** `GET /api/trends?from=&to=` with exact dates, series, logged-day count, effective targets, missingness and equivalent prior-period statistics; derived results, not duplicated authoritative intake rows.
- **UX/DoD:** Sunday–Saturday week, month, metric selection, drill-down, average on logged days and X/Y denominator, sparse warning, goal history preserved; no invented zero days.
- **Tests:** E2E-11/12/20; 3 logged + 4 unlogged days average divides by 3; month/DST/revision boundaries and edits invalidate comparisons.
- **Rollback:** disable trends route/UI flag, preserve underlying logs/goals; evict derived cache.

### F03 — weight

- **Owner:** P07-A/C; dependencies P03/P04. NEW `src/foodlogger/tracking.py`, `(app)/weight.tsx`, `mobile/src/domain/tracking.ts`; extend existing API/storage/auth deletion paths.
- **Interfaces/migration:** `GET/POST/PATCH/DELETE /api/weight`; owner, kg, measurement timestamp/local date/zone, source/external identity, version. Synced identity unique per owner/provider.
- **UX/DoD:** latest measured value, previous delta, daily latest if multiple measurements, average over measured dates only, optional lb display/target and labeled dual-axis calorie overlay; no fabricated interpolation presented as measurement.
- **Tests:** E2E-11/16/19/20, 70.0/69.5 with missing day, edit/time ordering, kg/lb round trip, duplicates; real imports wait for native phase.
- **Rollback:** disable editing/import flags while preserving records and source IDs; queue remains paused.

### F04 — recents, favorites and repeat

- **Owner:** P04-A/B; dependencies P02 plus P01 receipts. Reuse `storage.py`, `domain/drafts.ts`, `data/save-draft.ts`, Add/review UI.
- **Interfaces/migration:** `GET /api/recents?limit=20&query=`, `GET/POST/DELETE /api/favorites`; unique owner/type/source identity, snapshot-to-draft adapter. Reuse canonical save, no new AI call or competing logging endpoint.
- **UX/DoD:** 10–20 recents, search/favorite/unfavorite, portion adjustment and explicit Confirm. Source remains immutable, unfavorite never deletes log, catalog overlap does not duplicate favorites.
- **Tests:** E2E-05/14/19; zero provider calls, new log ID, same snapshot nutrition, idempotent retry and serving changes. Measure interactions/time rather than assert target achieved.
- **Rollback:** hide quick-add/library flag; retain source logs/favorites/receipts.

### F05 — saved meals and recipes

- **Owner:** P04-C/D; dependencies P02. NEW `src/foodlogger/recipes.py`, `(app)/recipes/index.tsx`, `(app)/recipes/[id].tsx`, `mobile/src/domain/recipes.ts`; reuse `MealFoodEditor.tsx` after P02 adaptation.
- **Interfaces/migration:** `GET/POST/PATCH/DELETE /api/saved-recipes`, explicit duplicate action; owner/header/items with serving yield and version. Update checks expected version and atomically replaces ingredients; deletion hides catalog entry while history survives.
- **UX/DoD:** full CRUD/duplicate, ingredient quantity/name, total/per-serving values, selected serving count to shared draft. Resolve concurrent edit visibly; do not blindly overwrite.
- **Tests:** E2E-06/19, two-serving scaling, fractional portions, incomplete ingredients, mixed g/ml needing explicit density/yield, stale version 409, old logs unchanged after edit/delete.
- **Rollback:** disable mutations/editor, preserve versioned recipe snapshots and log references. Never delete historical logs as recipe cleanup.

### F06 — text

- **Owner:** P05-A; dependencies P02/P04/F14 (P01 gateway). NEW `src/foodlogger/text_input.py`, `(app)/add/text.tsx`; reuse references and canonical draft contract.
- **Interfaces/data:** `POST /api/analyze-text` returns unsaved `MealDraft`; deterministic quantity/unit/alias parsing first, one budgeted AI fallback only for ambiguity, provenance/warnings. No new authoritative food-log table.
- **UX/DoD:** Hebrew/English/code-switching input, editable itemization and unclear-amount prompts. `חצי פיתה עם חומוס וביצה קשה` yields pita/hummus/egg; `200g chicken with rice and salad` retains 200g only for chicken.
- **Tests:** E2E-02/14/18, parser fixture corpus, no AI for straightforward cases, ambiguous/unknown/density cases, exhausted quota/manual fallback, no pre-confirm journal write.
- **Rollback:** turn off AI text fallback independently; keep deterministic/manual route and persisted drafts.

### F07 — voice

- **Owner:** P05-B/C; depends F06/F14. NEW `mobile/src/native/speech.ts`, `(app)/add/voice.tsx`; modify `mobile/app.config.ts`/dependency lock only after SDK/device investigation.
- **Interface/migration:** `transcribe(language, cancellation)` -> editable transcript -> F06; no separate nutrition interpretation. No raw-audio persistence by default; approved cloud fallback only after cost/privacy review.
- **UX/DoD:** just-in-time microphone permission, recording/stop/cancel, language availability, editable transcript; denial returns to text.
- **Tests:** E2E-03/18/20 including `אכלתי שתי ביצים וחצי פיתה`, permission denial/revocation, interrupt/background cleanup, Hebrew/English actual target-device transcription.
- **Rollback:** disable voice flag, remove pending audio artifacts, text remains available. Do not mark native support verified from mocks.

### F08 — copy

- **Owner:** P04-E; depends P02 + P01 canonical dates/receipts. NEW `src/foodlogger/copying.py`, `(app)/copy.tsx`; reuse shared preview/confirm and daily navigation.
- **Interfaces/migration:** `POST /api/meals/copy`, `/api/days/copy` with preview then confirmation, source IDs, destination local date/timezone, selected items and `client_request_id`; persist copied-from identity and immutable new snapshots.
- **UX/DoD:** populated-date warning requires separate confirmation; do not copy source goals; source untouched. Preserve local meal time where known, ask/mark legacy inferred time; resolve DST gaps/overlaps explicitly.
- **Tests:** E2E-07/18/19; empty/nonempty destination, retry/concurrency, selection, deleted source, fall/spring DST and travel, source goal unchanged.
- **Rollback:** disable copy action; preserve created records/receipts, allow normal user deletion, never reverse-copy the source.

### F09 — label OCR

- **Owner:** P06-C/D; depends P01/P02/F14 and F10/F11 semantics. NEW `src/foodlogger/label_input.py`, `(app)/add/label.tsx`; extend `products.py` parsing rather than replace barcode path.
- **Interfaces/migration:** `POST /api/analyze-label` -> draft/product proposal; confirmed private product CRUD with owner and provenance. OCR field confidence and original basis retained; owner-scoped label fingerprint cache/TTL if needed.
- **UX/DoD:** Hebrew/English table review/correction, per-100g/ml vs per-serving, serving amount, kcal/kJ without double conversion, sodium/salt distinction, optional nutrients unknown; exact barcode lookup preferred when present. No public publishing.
- **Tests:** E2E-08/18/19, real permitted Israeli labels, field-level accuracy/correction metrics, dual-basis/dual-energy/uncertain rows and no cross-user cache access.
- **Rollback:** disable OCR provider/path; barcode/manual entry and private confirmed products remain.

### F10 — sources and resolution

- **Owner:** P06-A; depends P01/P02/F14 for any AI escalation. Existing `nutrition_reference.py`, `products.py`, `scripts/import_usda_reference.py`; NEW `src/foodlogger/food_providers.py`/optional import script.
- **Interfaces/migration:** `resolve_food(query, locale, barcode, owner)` -> ranked versioned candidates, verification and source; additive food references/private catalog, aliases, import version/evidence where necessary.
- **UX/DoD:** visible source/verification; confirmed specific barcode and private confirmed products before generic sources; meaningful duplicates and Hebrew aliases. Document licensing/accessibility result for Israeli official data; lawful existing sources/private foods are an explicit acceptable fallback.
- **Tests:** E2E-08/09; real Israeli product/aliases, exact/generic conflict, old version snapshot, source failure and import dry-run rejection. Recheck OFF licensing for actual reuse pattern before import/distribution.
- **Rollback:** disable provider/import version; never recompute historical snapshots from replacement data.

### F11 — household measures

- **Owner:** P06-B (P01 normalized portion contract first). NEW `src/foodlogger/servings.py`, `mobile/src/domain/servings.ts`; modify shared item editor.
- **Interfaces/migration:** serving-conversion record `(food/version, unit, g_or_ml, evidence, confidence)`, optional density; `resolve_portion(food, quantity, unit)` preserves original amount/unit and normalized basis.
- **UX/DoD:** spoon/teaspoon/cup/slice/piece/half/size with Hebrew equivalents, g/ml fallback; absent conversion asks user or labels estimate, never universal tablespoon mass.
- **Tests:** E2E-09/20: tahini vs another food use distinct spoon weights; half-pita from specific record; volume/mass without density rejected/clarified; fractional amounts retain precision.
- **Rollback:** hide unsupported conversions while stored normalized snapshots/original units remain readable.

### F12 — weekly summary

- **Owner:** P08-A/C; depends P07/P06/F14. NEW `src/foodlogger/insights.py`; consume F02's exact deterministic metrics; card on Today.
- **Interfaces/migration:** `GET /api/weekly-insight?week=`; user/week/data+goal revision cache and template fallback. Optional AI wording consumes only approved structured metrics.
- **UX/DoD:** exact averages, achievement, meal distribution, prior week and missing-data caveat in Hebrew/English; no breakfast claim without sufficient breakfast data.
- **Tests:** E2E-12/14; totals equal Trends; corrected old log invalidates cache; insufficient data, 429 and model-invented number rejected.
- **Rollback:** disable AI wording, serve templates; evict derived cache without changing logs.

### F13 — recommendations

- **Owner:** P08-B/C; dependencies P07/P06/F14 + F04/F05 candidates. NEW `src/foodlogger/recommendations.py`, preferences model and mobile recommendation view.
- **Interfaces/migration:** `GET/PUT /api/preferences`, `GET /api/recommendations`; optional allergy/restriction data, deterministic filter/ranker over verified foods/favorites/recipes, 2–4 candidates when safe candidates exist.
- **UX/DoD:** remaining budget, suggested portions/rationale, editable draft on choice; no automatic save or assumption of no allergies when unspecified; insufficient candidates shown honestly.
- **Tests:** E2E-13/14/19: 500 kcal/40g remaining plus allergy; unknown ingredients conservatively excluded for declared allergy; quota fallback, no invented nutrition/medical guidance.
- **Rollback:** disable optional AI explanation or recommendations entirely; no side effects to logs/preferences.

### F14 — gateway

- **Owner:** P01-E/F, enforced in P02/P05/P06/P08; no downstream AI feature may bypass it. Reuse `vision.py` transports and `meal_analysis.py` cache; NEW `src/foodlogger/ai_gateway.py`.
- **Interfaces/migration:** owner/feature/provider/model reservation, durable attempt ledger and unique request/attempt identity, commit/release/uncertain outcome; configurable project/feature RPM/TPM/day limits, reserve and reset zone. Admin-only budget read requires real server admin authorization, never a client boolean.
- **UX/DoD:** photo priority, graceful no-AI paths; unknown allowance/billing fails closed for live activation. 500/350/150 and secondary 60/40/25/25 are proposed starting policy, not verified entitlement.
- **Tests:** E2E-14/18/19, 100 concurrent reservations over multiple workers, crash/retry/timeout/reset, exhausted quota/cached request, attempts accounted for, no raw health content in ledger/logs.
- **Rollback:** server kill switches halt new calls; retain ledger for reconciliation and manual/catalog flows. Never release a possibly consumed reservation as if no call occurred.

### F15 — habits

- **Owner:** P09-A/B; depends P07. NEW `src/foodlogger/habits.py`, `mobile/src/native/notifications.ts`, `(app)/reminders.tsx`; add minimal preferences/device ownership if push selected.
- **Interfaces/migration:** notification preferences/quiet hours/timezone, confirmed-meal streak query, conditional reminder decision. Select local/push delivery after capability assessment; do not promise conditional delivery from an unconditional OS schedule.
- **UX/DoD:** opt-in/denied/muted, current/longest streak, meal-category suppression, conditional water/evening prompts; unknown logging state suppresses reminder.
- **Tests:** E2E-15/18: lunch suppresses lunch, two consecutive logged dates -> 2, water-only/goal edits -> no meal streak, DST/travel/quiet hours, logout cancellation.
- **Rollback:** stop scheduler/cancel owned pending reminders, keep preferences/logs; disable streak card independently.

### F16 — HealthKit

- **Owner:** P10-A/B/C; depends P07–P09. NEW `mobile/src/native/health/ios.ts`, shared sync queue/mapping contract, capability config plugin; existing auth/session lifecycle extended.
- **Interfaces/migration:** read weight/steps; write energy/protein/carbs/fat/water, stable mapping owner+local record+revision to app-owned samples. Durable mapping/queue survives retries and has deletion tombstones.
- **UX/DoD:** explicit partial permissions, disconnect/sync status, no food reimport loop; repeated sync no duplicates, edit/delete only owned records, sign-out isolates data.
- **Tests:** E2E-16/19/20 with adapter fixtures then signed build + compatible physical iOS device. If unavailable: BLOCKED on device validation, flag off.
- **Rollback:** pause queue, disconnect integration, preserve mapping; never bulk-delete unrelated samples.

### F17 — Health Connect

- **Owner:** P11-A/B/C; depends P07–P09; reuses shared queue contract from native design, can be developed independently from iOS after phase authorization. NEW `mobile/src/native/health/android.ts` and config plugin.
- **Interfaces/migration:** read WeightRecord/StepsRecord; write NutritionRecord/HydrationRecord, stable clientRecordId/metadata, incremental changes/dedup. Same ownership/source/time contracts as F16.
- **UX/DoD:** unavailable/install-needed/denied/partial/revoked, stable repeat/edit/delete sync, no health-import rewrite of BiteFlow food logs.
- **Tests:** E2E-16/19, supported Android device/emulator capability tests plus real-device release evidence required by phase plan; token expiry/changes, duplicates, sign-out. No device means BLOCKED.
- **Rollback:** pause Android adapter/queue and retain mapping; other logging works.

### F18 — widgets

P12 update: see [checkpoint](p12-checkpoint.md), [complete gates](p12-open-gates.md) and [device protocol](p12-device-protocol.md). Native implementation is local; full acceptance is BLOCKED. The protected version1 contract uses a random publication session plus minimal numeric Today state, not raw account identifiers or tokens.

- **Owner:** P12-A/B/C; depends P03/P07 and P10/P11 where health is displayed. NEW `mobile/src/native/widgets/`, config plugin(s); evaluate SDK 57 `expo-widgets` for iOS, native Android widget separately.
- **Interfaces/migration:** sanitized per-owner Today snapshot `{date, totals, goals, partial, water, updated_at, signed_in}`; protected shared local storage, no credentials; refresh request on confirmed changes, deep links preserve auth.
- **UX/DoD:** signed-out/no-goal/partial/stale views, small/medium appropriate sizes, last-updated, OS-controlled refresh, prior account cleared on logout; real widget gallery/home screen presence.
- **Tests:** E2E-17/19/20, app killed/background, new day, partial nutrition, account A -> logout -> B, snapshot corruption, refresh throttling on devices.
- **Rollback:** disable snapshot publishing/refresh, clear private shared snapshots; native extension lifecycle handled in next approved build.

### F19 — water

- **Owner:** P03 goal definition; P07-A/C tracking. NEW tracking modules from F03, `(app)/water.tsx`; extend Today/Trends after common invalidation exists.
- **Interfaces/migration:** `GET/POST/PATCH/DELETE /api/water`, ml/timestamp/local date/zone/source/idempotency/external identity; goal belongs to F01 revisions.
- **UX/DoD:** +150/+250/+500/custom, history/edit/delete, week/month, optimistic rollback. Food/drink ml never automatically becomes hydration; optional fl oz display only.
- **Tests:** E2E-10/19/20: 250+500=750, delete 250 -> 500; retry/edit and account isolation; health/widget updates only once enabled in later phases.
- **Rollback:** disable quick-write/sync flag, retain records/receipts/goals and readable history.

### F20 — photo quality

- **Owner:** P02-A/B/C/D, foundation P01; retain existing `photo.tsx`, `meal_analysis.py`, `vision.py`, USDA matcher, atomic save and licensed evaluator.
- **Interfaces/migration:** adapt existing `AnalysisResult` to canonical `MealDraft`; consolidate existing review components. Keep legacy `/api/predict` compatibility. Do not create another recognition provider or save pipeline by default.
- **UX/DoD:** separate editable plate items/sauces where recognized; portion/source uncertainty, manual correction, unknown fields, no-food/error/cancel flows; no journal write before explicit confirm. Extra passes only after measured quality/cost benefit.
- **Tests:** E2E-01/18/20, golden input-adapter contracts, known three-food and ambiguous images, lost response/retry, photo+second angle no double count. Baseline/evidence in current-state §8; independently reviewed holdout and fresh approved run required before claiming quality improvement.
- **Rollback:** compatible editor/provider/resolver flags; preserve draft schema adapters and manual entry, keep old reports and snapshots. Never claim illustrative legacy catalog is a verified nutrition fallback.

## Acceptance ownership and present evidence

| Required E2E | Owning tickets / phase | P00 evidence and remaining test |
|---|---|---|
| 01 Multi-item image | F20 / P02 | Existing backend/domain tests and historical Gemini reports; full new shared flow/device run outstanding. |
| 02 Hebrew text | F06 / P05 | Missing; phrase fixtures required. |
| 03 Hebrew voice | F07 / P05 | Missing; device transcription and denied permission required. |
| 04 Goals/history | F01 / P03 | Day refresh exists; goal/edit/revision scenarios missing. |
| 05 Repeat | F04 / P04 | Save-key tests exist; repeat/zero-AI scenario missing. |
| 06 Recipe | F05 / P04 | Missing. |
| 07 Copy day | F08 / P04 | Missing. |
| 08 Israeli label | F09/F10 / P06 | OFF normalization tests exist; OCR/real label fixture missing. |
| 09 Household units | F11 / P06 | g/ml math exists; food-specific conversions missing. |
| 10 Hydration | F19 / P07, native later | Missing. |
| 11 Weight charts | F03/F02 / P07 | Missing. |
| 12 Incomplete week | F02/F12 / P07/P08 | Missing. |
| 13 Recommendations | F13 / P08 | Missing. |
| 14 Depletion/concurrency | F14 / P01, consumers later | Provider 429 mocks exist; global reservations/100-way test missing. |
| 15 Reminder/streak | F15 / P09 | Missing. |
| 16 Health integration | F16/F17 / P10/P11 | Missing; native evidence mandatory. |
| 17 Widget | F18 / P12 | Partial: local policy, lifecycle, native build and emulator/simulator evidence in P12 checkpoint. Full physical journey remains BLOCKED. |
| 18 Failure matrix | All phases | Auth/timeouts/offline-draft/upload/provider tests partly present; new adapters, copy and migrations not covered. |
| 19 Security | Every data phase | Current SQLite owner/auth tests pass; current PostgreSQL tests skipped; all new tables/queues/storage require explicit tests. |
| 20 Localization/accessibility | Every UI phase / P13 | Dictionaries/domain/component tests and older screenshots exist; new mobile flow/device matrix not freshly verified. |

## Next action

Review the [P11 checkpoint](p11-checkpoint.md), its implementation and [all carried gates](p11-open-gates.md). **P12 remains NOT STARTED and requires explicit approval.** Update this matrix with measured evidence as each authorized review unit lands; do not pre-mark planned interfaces or future fixtures as implemented.
