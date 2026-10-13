# BiteFlow — Codex Implementation Plan

**Version:** 1.0 (English translation)  
**Date:** October 13, 2026  
**Companion product/technical specification:** [BiteFlow_SPEC_EN.md](BiteFlow_SPEC_EN.md)  
**Scope:** P00–P14 execution, release slices, E2E acceptance, Definition of Done, quality, risk control, checkpoint reporting, handoff.

This plan must be read together with the feature definitions, source-of-truth principles, `MealDraft` contract, and proposed architecture in `BiteFlow_SPEC_EN.md`. Repository-specific details must first be verified in P00. No unapproved production changes.

## 6. Phased Codex Execution Plan

**Phase gate:** Do **not** start the next phase if the current phase's Definition of Done has failed. Do not implement three major phases simultaneously. Each phase needs manageable commits/PRs, schema migrations separated from feature activation where practical, relevant tests, and a progress report. Any newly discovered high-risk architectural change must first be documented and approved.

### P00 — Discovery, Baseline & Design Freeze | Blocks all subsequent work

**Tasks:** Inspect actual code paths, UI, navigation, APIs, DB, auth, migrations, AI services, food providers, DayDial, image recognition, confirmation flow, tests, and environment configuration. Produce an evidence-based existing/partial/missing inventory. Diagram the real data flow; establish photo benchmark and test baseline; verify AI-provider quotas; list risks and rollback scenarios; define test fixtures. Create `docs/biteflow/current-state.md` and `docs/biteflow/implementation-matrix.md` with real code references and status of every feature F01–F20.

**Exit/DoD:** No unverified “already exists” assumptions; build/test/photo quality baselines are recorded; proposed small-PR plan has been reviewed; **no product code is changed** in P00.

### P01 — Data Contracts, Security & Safe Migrations | Depends on P00

**Tasks:** Build normalized nutrition/domain types, runtime validation, provenance, UTC/local-date support, unit handling, and additive, backfillable/idempotent migrations. Implement API-level authorization/RLS tests and an atomic meal-save pathway using `client_request_id`. Introduce feature flags. Add baseline measurement and a centralized quota gateway **before** expanding AI integrations.

**Exit:** Local/staging environment with fixtures operates correctly; forward migration and a viable rollback approach have been rehearsed against a copy; no data is destroyed; nutrition and security tests pass.

### P02 — Unified Confirmation & Photo Recognition Hardening | Depends on P01

**Tasks:** Adapt existing image results to normalized `MealDraft`; wire the shared confirmation editor; correct portion and aggregation logic; improve multi-food photo recognition; expose confidence/warnings; add UI regression/screenshot tests; measure before/after recognition quality and AI cost.

**Exit:** A multi-food plate is handled and all items remain editable; quality and costs are reported from measurements; no regression in the existing photo flow; nutrition values are not invented to hide unknowns.

### P03 — Daily Goals, DayDial & Dashboard | Depends on P01–P02

**Tasks:** Implement goal revisions, goal settings, DayDial/macro progress/remaining values, unset-goal state, accessible Hebrew RTL dashboard, and event/cache invalidation after log changes.

**Exit:** Goal changes work without rewriting history; adding/editing/deleting meals recalculates Today; UX and unit tests pass.

### P04 — Fast Logging: Recents, Favorites, Recipes, Repeat & Copy | Depends on P02

**Tasks:** Build recent/favorite/eat-again flows, complete versioned saved-recipe CRUD, copy-meal/copy-day actions with duplicate protection, and quick shortcuts. All routes must produce or reuse `MealDraft`.

**Exit:** Repeat makes **zero AI requests**; recipe editing and serving math work; old logs remain unchanged after recipe update; copying is tested across DST boundaries and into both empty/populated dates.

### P05 — Text & Voice Inputs | Depends on P02, P04, F14

**Tasks:** Create Hebrew/English text parser and normalization, AI fallback through the shared gateway, voice UX, supported native/approved STT, permission handling, and editable transcript.

**Exit:** Required example phrases parse into separate items and reach the same Confirm editor; denied permissions are handled; AI allowance remains protected; Hebrew test cases pass.

### P06 — Israeli Foods, Serving Units, Barcode & Label OCR | Depends on P01–P02, F14

**Tasks:** Build provider adapter with licensing verification; Hebrew aliases; food-specific serving conversions; product/barcode lookup; label OCR with per-100 and per-serving semantics; user corrections; private confirmed products. If an official Israeli dataset cannot be legally and reliably imported, document that conclusion and complete the feature with existing lawful sources and user-confirmed foods.

**Exit:** Test a real Israeli product; test half-pita and tablespoon-of-tahini conversions; test kcal/kJ labeling; never publish unverified data; retain source/provenance information.

### P07 — Weight, Water & Trends | Depends on P03–P04

**Tasks:** Weight CRUD, hydration CRUD, week/month trends, comparisons against effective historical goals, charts that properly distinguish missing days, daily progress, averages, and weight/calorie overlays.

**Exit:** Missing-data chart behavior is correct; water updates dashboard progress; weight and calorie series have clearly labeled axes; date/time/unit boundaries are covered.

### P08 — AI Insights & “What Should I Eat Now?” | Depends on P07, P06, F14

**Tasks:** Deterministic summary statistics and rules-based recommendations; cache keyed by data version; optional AI wording within budget; allergy/preference filters; suggestions based on remaining targets; non-AI fallbacks and usage monitoring.

**Exit:** Insight numbers match the query results; AI does not fabricate statistics; recommendations are editable before saving; exhausted-quota flow is tested.

### P09 — Notifications, Streaks & Preferences | Depends on P07

**Tasks:** Local/push notification strategy suitable for the real stack; secure scheduling, meal category checks, quiet hours, timezone policy, streak calculations, conditional hydration reminders.

**Exit:** Logged meals suppress their reminders; no-permission state works; timezones and DST have been tested.

### P10 — Apple Health (iOS) | Depends on P07–P09

**Tasks:** Configure native capabilities/entitlements, integration adapters, permission UI, nutrition/water writes, weight/step reads, provenance mapping, edits/deletes restricted to owned samples, real-device tests, and release-build validation.

**Exit:** Partial permission, repeated sync, edit/delete, and sign-out behavior pass. If no device, entitlement, or Apple-side approval is available, code may be ready but **must not be marked device-validated**.

### P11 — Android Health Connect | Depends on P07–P09

**Tasks:** Detect capability and request permissions, use `NutritionRecord`/`HydrationRecord` and Weight/Steps, stable record mappings, incremental change syncing, and device tests.

**Exit:** Verify deduplication, stability, and permission behavior on a supported Android device. If not actually tested, report **BLOCKED on device validation**, not completed.

### P12 — Native Home-screen Widgets | Depends on P03, P07 and P10/P11 where relevant

**Tasks:** Implement iOS widget extension and Android app widget, protected shared snapshots, OS-aware refresh requests, logout handling, and deep links.

**Exit:** Widget appears on a supported device home screen; prior-user data is not visible after logout; update behavior is tested within OS limits.

### P13 — Hardening, Privacy Review & Staged Release | Depends on all implementation phases

**Tasks:** Lint/typecheck/unit/integration/E2E; accessibility and RTL review; device QA matrix; migration rehearsals; backups and feature flags; privacy-sensitive telemetry; performance/crash monitoring; build signing; canary/staging rollout; release notes and brief user guidance.

**Exit:** No unresolved P0/P1 defects; core journeys remain stable; unsupported native integrations remain feature-flagged off; **never deploy to production without explicit approval**.

### P14 — Post-release Measurement & Iteration | Only after an approved release

**Tasks:** Measure real adoption, errors, AI consumption, text parsing corrections, OCR manual corrections, abandonment funnels, and appropriately minimized/anonymized engagement data. Track feedback and a future backlog without silently widening the initial release scope.

**Exit:** Real metrics dashboards and an improvement backlog supported by observed results, not assumptions.

## 7. Prioritized Backlog, Dependencies & Release Slices

**R1 — Core Trust & Daily Utility:** P00 → P01 → P02 → P03, followed by basic repeat/recipe functionality from P04. Deliver improved image recognition, shared confirmation, meaningful goals, and fast basic logging.

**R2 — Low Friction & Israeli Coverage:** Finish P04, P05, P06. Add text/voice/recipes, Israeli sources, household servings, labels, and a lower dependency on AI.

**R3 — Insights & Habits:** P07 → P08 → P09. Deliver trends, weight, water, recommendations, weekly summaries, and reminders while clearly representing missing logs.

**R4 — Native Platform Integration:** P10 and P11 can proceed independently by platform; then P12 as applicable. Provide genuinely supported health integration and widgets, not fake screens.

**R5 — Production Release:** P13 → P14 after review and production authorization.

**Work breakdown requirement:** Each feature gets a tracked ticket with `ID`, `existing/partial/missing` state, actual touched paths/interfaces after audit, dependencies, migration requirement, API contract, UX states, tests, rollback path, Definition of Done, and **evidence** (test output, log, screenshot, or real-device result). Finishing a code change alone is never proof of completion.

## 8. End-to-End Acceptance Test Matrix

**E2E-01 — Multi-item image:** Photograph a plate with at least three foods → separate editable items, portion corrections and explicit save → accurate Today/Trends. Also test an ambiguous image.

**E2E-02 — Hebrew text:** Enter `חצי פיתה עם חומוס וביצה קשה` → parser separates the foods, interprets half-pita, asks about any unknown amount → shared Confirm screen.

**E2E-03 — Hebrew voice:** Record food description → check permissions, editable transcription and shared Confirm; refusal routes back to manual entry.

**E2E-04 — Goals/history:** Configure 2,300 kcal and 150 g protein → editing lunch updates DayDial; a later goal change does not rewrite past adherence.

**E2E-05 — Repeat:** Repeat recent meal → new log with same nutrition, zero AI requests, source unchanged, retry idempotent.

**E2E-06 — Saved recipe:** Create “My Salad” → log two servings → later edit recipe → prior log values remain unchanged.

**E2E-07 — Copy day:** Copy yesterday into a nonempty date → preview and duplication warning → confirm → source remains unchanged; old goal is not copied.

**E2E-08 — Israeli label OCR:** Scan a label with per-100g/per-serving and kcal/kJ → recognize, correct, save privately, correctly normalize quantities.

**E2E-09 — Household units:** Compare one tablespoon of tahini with another food → use food-specific weights or ask for clarification; never force a universal weight.

**E2E-10 — Hydration:** Add 250 ml and 500 ml; delete the 250 ml entry → 500 ml remain; dashboard, trends, and enabled widget/health sync update.

**E2E-11 — Weight charts:** Enter 70.0 and 69.5 kg on separated dates with a missing day → graph/averages do not invent measurements; calorie comparison uses two labeled axes.

**E2E-12 — Incomplete week:** Three logged days and four unlogged days → average uses **three** days, denominator is explicit, unlogged days are not zeros.

**E2E-13 — Recommendations:** With 500 kcal and 40 g protein remaining and a declared allergy → suggestions respect the allergy and open Confirm, not auto-save.

**E2E-14 — AI depletion/concurrency:** Simulate quota exhaustion and 100 concurrent calls → never exceed configured project limits; repeat, deterministic text parsing, and template insights still work.

**E2E-15 — Reminder/streak:** Lunch log suppresses lunch reminder; two consecutive logged local dates create a streak of two regardless of nutrition goal success.

**E2E-16 — Health integration:** Connect → write nutrition/water → sync again → edit/delete owned log → no duplicate samples; imported steps/weight do not rewrite BiteFlow food logs.

**E2E-17 — Widget:** Log in → view summary → log meal and request widget refresh → log out → no private data leak; show last-updated where appropriate.

**E2E-18 — Failures:** Test timeouts, offline mode, 401 responses, uncertain OCR, permission denial, provider 429, and migration/rollback paths → clear feedback and no lost/duplicate logs.

**E2E-19 — Security:** User A cannot read/change User B’s recipes, weights, water, goals, food logs, or insights through API, DB, or storage; test RLS/authorization explicitly.

**E2E-20 — Localization/accessibility:** Hebrew RTL, English LTR, date/number/chart formatting, existing dark mode, dynamic type/accessibility, kg/lb/ml/fl oz units.

## 9. Definition of Done & Required Evidence

A feature is **DONE** only when every applicable condition below is met:

1. Code integrates with the existing project without duplicate systems or unrelated changes.
2. Backend, frontend, database/permissions, and cache/event invalidation are coordinated.
3. Loading, empty, partial-data, error, permission-denied, offline, and cancellation states are defined and implemented.
4. Every core positive scenario has tests, and material negative/authorization risks are tested.
5. Relevant lint, typecheck, unit, integration, and build checks pass; any unrun check is clearly labeled **NOT RUN** with explanation.
6. Nutrition data includes unit/source/confidence/portion and prevents NaN, invented zero, and per-100 conversion errors.
7. Hebrew RTL and English LTR are checked at least in a simulator; native health and widgets require a compatible real device or remain **BLOCKED**.
8. No exposed secrets, cross-user data access, or silent historical rewrites.
9. Migration/rollback and data compatibility are documented/tested commensurate with the risk; a live deploy needs separate approval.
10. A clear commit/PR, actual command results, relevant benchmark data, and exact changed-file references are delivered.

**Permitted status labels:** `NOT STARTED` / `IN PROGRESS` / `IMPLEMENTED, UNVERIFIED` / `BLOCKED` / `VERIFIED IN STAGING` / `VERIFIED ON DEVICE` / `RELEASED`. Do not use “DONE” without evidence supporting the DoD conditions.

## 10. Product Quality, Measurement, Privacy & Costs

**Adoption metrics:** Photo-to-save completion, ingredient/portion correction rates, repeat-log time, Confirm-screen abandonment, logged days per week, use of recipes/water/goals. Do not claim improved retention without measurements.

**Reliability metrics:** Crash-free sessions, save failure rate, provider 429 incidence, DB query latency, Health duplicate rate, sync reconciliation rate, widget refresh attempts, migration failures.

**Recognition quality:** Photo food-item precision/recall, nutrient error against a curated benchmark, Israeli foods backed by verified sources, manual OCR correction frequency. Record a baseline and compare results after P02/P06.

**Privacy:** Treat nutrition, weight, and health information as sensitive. Minimize access and retention; offer existing export/deletion paths when applicable; store photos/audio only for legitimate purposes with appropriate consent; document retention; send only required allergy data to AI models.

**Cost:** Put the AI Gateway in place before new AI-heavy features. Cache carefully, rate-limit by user/feature, allow provider alternatives, and report savings from repeat logging, local OCR/STT, and template insights.

**Regulatory/store policy review:** Re-check app-store privacy labels, health-data practices, HealthKit/Health Connect permissions and restrictions at release time. This specification is not legal or medical advice.

## 11. Risk Register & Rollback Strategy

- **RISK-01 — Existing photo flow breaks:** Feature flag shared-confirmation rollout; regression suite and gradual enablement; retain safe rollback to the working path when possible.
- **RISK-02 — Nutrition errors from portions/OCR:** Clearly marked confidence, review, unit/per-100 engine, `unknown != 0`, editable results.
- **RISK-03 — AI project quota exhaustion:** Server gateway, photo allocation reserve, templates/fallbacks, provider-call reporting.
- **RISK-04 — Data loss in migrations:** Backward-compatible migrations, production backups before approved changes, staging rehearsals, no destructive drop/rename in first migration stage, documented rollback.
- **RISK-05 — Security and privacy breaches:** RLS/authZ, least privilege, private storage, tenant isolation tests.
- **RISK-06 — Duplicate Health samples:** Stable record mapping, idempotency, reconciliation limited to app-owned samples, visible sync status.
- **RISK-07 — Widget updates are delayed:** OS-aware budgeting, last-updated label, shared snapshot, realistic UX promises.
- **RISK-08 — Israeli official dataset unavailable or restricted:** Licensing and availability discovery in P06; rely on existing legally usable sources plus user-confirmed products until an approved dataset can be integrated.
- **RISK-09 — Interrupted development:** Small, relatively self-contained phases and commits; `implementation-matrix.md` records actual status and the next action.

## 12. Required Report After Each Phase

Codex must provide a checkpoint report in this exact general structure:

```text
Phase: Pxx — <name>
Status: VERIFIED IN STAGING | IMPLEMENTED, UNVERIFIED | BLOCKED
Feature IDs covered: Fxx, Fyy
Repository baseline and paths inspected: <actual paths>
Changed files / migrations: <exact list>
Functional behavior: <what actually works>
Security / privacy checks: <what was verified>
Tests executed: <commands and real pass/fail counts>
Build / native-device validation: <actual result or NOT RUN>
Photo/OCR/AI metrics when relevant: <sample counts and measured results>
Open defects and blockers: <specific issues and severity>
Rollback plan: <how to disable or revert safely>
Next phase: <name; prerequisites satisfied yes/no>
```

If physical devices, provider credentials, or entitlements are unavailable, explicitly report **IMPLEMENTED, UNVERIFIED** rather than “production ready.” Revisit P00 when previously unseen schema or architecture requires a plan revision.

## 13. Direct Codex Handoff Instructions

**Recommended initial message to Codex (attach this file or the split files):**

> You are the implementation owner for the existing BiteFlow repository. Treat `BiteFlow_SPEC_EN.md` and `BiteFlow_IMPLEMENTATION_PLAN_EN.md` (or the combined `BiteFlow_Full_Spec_And_Plan_EN.md`) as the authoritative product and engineering requirements. The earlier brainstorming document was a workflow skill, NOT the BiteFlow product specification. Do not assume the architecture, schema, providers, API quotas, or native tooling until the P00 repository audit proves them. Start with **P00 only**: produce a verified current-state audit and F01–F20 gap matrix, with actual file paths, baseline tests, risks, and a proposed small-PR implementation order. **Do not modify product code in P00.** Present the repository-adapted specification and detailed implementation plan for product-owner approval before starting P01. Once approved, implement in small vertical slices following P01–P14, enforcing each phase gate and recording actual test results. Every food input method MUST converge on one normalized `MealDraft` and one editable confirmation flow. Preserve historical nutrition snapshots. Unknown nutrition data is not zero; arithmetic remains deterministic. Use no-AI pathways wherever practical and enforce AI limits server-side. Verify the actual quota rather than assuming that 500/day is confirmed. Never perform destructive DB changes, incur unapproved costs, expose credentials, or deploy production changes without explicit authorization. Verify native iOS/Android feasibility and real-device builds. Report exact commands/results, changed paths, blockers, and rollback instructions at every checkpoint. Never present mocked or untested features as complete. Continue through achievable phases after approval, stopping at real safety, access, approval, or test-environment blockers and stating them precisely.

### Recommended handoff sequence

1. Add the two Markdown files to the repository under `docs/biteflow/`, or supply this combined file and the handoff message.
2. Ask Codex to execute **P00 only**: inspect what actually exists and return a gap matrix plus small-PR plan for P01–P14.
3. Review and approve the repository-specific design and PR plan before authorizing implementation. This follows the approval gates in the previously shared `brainstorming` workflow.
4. Allow incremental Git commits and require actual `typecheck`/`test`/`build` output plus device testing where native phases demand it.
5. Permit production rollout only after staging, backups, privacy/security review, and separate explicit authorization.

## 14. Official Technical References to Re-check During Implementation

Links are starting points, **not a substitute for verifying current SDK/library versions and rules**:

- **Apple HealthKit nutrition:** https://developer.apple.com/documentation/healthkit/nutrition-type-identifiers
- **Apple WidgetKit updates:** https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date/
- **Android Health Connect NutritionRecord:** https://developer.android.com/reference/androidx/health/connect/client/records/NutritionRecord
- **Android Health Connect data types:** https://developer.android.com/health-and-fitness/health-connect/data-types
- **USDA FoodData Central API:** https://fdc.nal.usda.gov/api-guide/
- **Open Food Facts API and licensing:** https://openfoodfacts.github.io/openfoodfacts-server/api/ ; https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/

---

**End of English v1.0.** This specification includes **F01–F20**, **P00–P14**, and **E2E-01–E2E-20**. Log all requested deviations in a change log and make scope decisions explicitly rather than silently changing the requirements.
