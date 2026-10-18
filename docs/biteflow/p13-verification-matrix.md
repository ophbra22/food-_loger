# P13 verification matrix

Evidence date: 2026-10-18. Base: `8ce7ad3`; implementation through `655aa72` (mobile source identical to `2d0b3d6`). `evidence/p13/commands.jsonl` contains actual commands, exit status and wall time. Source may advance for evidence/review fixes; final checkpoint and manifest identify the final verified revisions. **Local automated coverage is not full native E2E acceptance.**

## Actual local results

- Python with disposable PostgreSQL17 enabled: **574 passed, 9 skipped**, 46.85s. The 9 are 6 opt-in browser tests plus 3 opt-in model tests.
- Separate actual Chromium browser run: **6 passed, 577 deselected**, 18.36s. Thus **580 unique Python tests passed, 3 model tests NOT RUN**, not 589 passes. No live AI recognition benchmark.
- Mobile Jest: **416 passed, 81 suites**, 6.229s; none skipped/failed in final run. TypeScript and mobile lint passed. These include auth/session cleanup, drafts, library, goals, text/photo/label, tracking, advice, reminders, native adapters and widgets from P01–P12.
- Native host tests: **22 Android JVM** (12 Health, 10 widget), **29 Swift checks** (13 Health, 13 widget, 3 file cleanup); 0 failures. No physical hardware involved.
- Android Debug/Release arm64 builds passed, 131.16s; existing debug key signs local Release. Full dependency lint FAILED in inherited Worklets KaModule analysis. Focused widget lint passes, **0 errors / 8 warnings**, explicitly excluding Worklets and Expo-core analyses.
- Expo export for iOS/Android/web passes,24.00s; clean Python wheel/sdist passes,1.83s. iOS build and simulator evidence are reported in the final checkpoint.
- SQLite and PostgreSQL copy restores pass: full table counts/checksums, replay of one post-backup write twice, subsequent deletion reconciliation, preserved second owner. 2.497s total synthetic exercise, not production RTO/RPO.
- Synthetic in-process SQLite timings (3 warmups +30 measurements each): save p50/p95 **4.633/5.197ms**, day **4.995/5.732ms**, 7-day trends **5.913/7.054ms**, each0/30 failures. One cold archive7.283ms/43,621bytes. Native builds could run concurrently; no comparative speed claim, network/device/recognition latency or production save/crash rate.

All failed intermediate tests/checks remain in the command ledger: intended RED tests; first privacy fixture setup error; logout race; one mobile unit-label assertion typo; final Python formatting errors corrected. Dependency audits are separate security results, not test successes.

## E2E-01–20 coverage versus remaining acceptance

Every listed Python/mobile suite ran in the totals above. Rows mean partial automation of the journey; none assert a completed physical-device end-to-end session.

| ID | Exact coverage paths / assertions | Full acceptance and remaining evidence |
|---|---|---|
| 01 photo | `tests/test_meal_analysis_pipeline.py`, `test_meal_analysis_reliability.py`, `mobile/src/components/__tests__/ReviewRoute.test.tsx`: mock multi-items, edits/atomic saves/timeouts | BLOCKED: held-out permitted real images, ambiguous-photo accuracy and device camera/gallery |
| 02 Hebrew text | `tests/test_text_input.py`, `mobile/src/components/__tests__/TextEntry.test.tsx`, `TextResume.test.tsx`: deterministic parsing/shared review | BLOCKED: native keyboard/end-to-end journey; AI remains mocked |
| 03 voice | `mobile/src/native/__tests__/speech.test.ts`, `speech-bridge.test.ts` and `TextEntry.test.tsx`: permission/transcript adapters | BLOCKED: physical speech provider/language/permission acceptance |
| 04 goals/history | `tests/test_goals.py`, `test_meal_service.py`, mobile goals/dial tests: effective dates, canonical edits | BLOCKED: inherited saved-meal editing UI and complete native E2E-04 |
| 05 repeat | `tests/test_library.py`, mobile library/store tests: independent IDs and idempotent replay, no AI | BLOCKED: complete native repeat journey |
| 06 recipe | `tests/test_recipes.py::test_recipe_crud_versions_ingredients_and_two_servings_keep_old_logs`, `RecipeEditor.test.tsx` | BLOCKED: physical two-serving/revision journey |
| 07 copy | `tests/test_copying.py`, `mobile/src/components/__tests__/CopyFlow.test.tsx`: nonempty target, preview, no historical goal copy | BLOCKED: full native journey/large-source limits retained |
| 08 label | `tests/test_label_input.py`, `test_private_products.py`, `LabelEntry.test.tsx`: fixture kcal/kJ,100g/serving, correction/private save | BLOCKED: OCR image corpus, real label/device accuracy |
| 09 units | `tests/test_servings.py::test_selected_food_version_and_size_define_portion`, `::test_food_specific_spoons_and_no_implicit_density`, mobile servings tests | BLOCKED: broad regional coverage/real device lookup; pinned fixture half-pita/tahini only |
| 10 water | `tests/test_tracking.py`, `TrackingPanel.test.tsx`, native Health/widget tests: mutations/idempotency/derived data | BLOCKED: actual OS widget/Health propagation |
| 11 weight | `tests/test_trends.py::test_daily_latest_weight_measured_date_average_and_water`, `TrendsChart.test.tsx`: gaps/axes/units | BLOCKED: physical plot/assistive technology journey |
| 12 incomplete week | `tests/test_trends.py::test_three_logged_days_four_gaps_and_effective_targets`, `test_insights.py::test_week_matches_trends_three_logged_days_and_no_breakfast_claim` | BLOCKED: full device presentation; automated denominator assertions PASS |
| 13 advice | `tests/test_recommendations.py`, `AdviceScreen.test.tsx`, `FoodRestrictions.test.tsx`: declared reviews/filtering/Confirm | BLOCKED: real allergen/cross-contact usability and source review; no safety guarantee |
| 14 quota | `tests/test_ai_gateway.py`, `test_wording.py`, `test_postgres.py`: concurrent/mock quota, fallback and owner isolation | BLOCKED: real account/model/tier/RPM/TPM/daily/billing/policy evidence |
| 15 reminders | `tests/test_habits.py`, `test_habits_review.py`, `test_reminder_delivery.py`, `Reminders.test.tsx` | BLOCKED: actual signed-device push/timezone/background delivery and scheduler |
| 16 Health | `tests/test_health.py`, `test_health_connect.py`, native bridge/service tests +29 Swift/22 JVM checks | BLOCKED: physical provider permissions/read/write/edit/delete/reinstall and receipts recovery |
| 17 widgets | mobile widget tests and Swift/JVM tests: data validity, owner lifecycle, file clearing | BLOCKED: physical launcher/WidgetKit cached pixels/background/expiry/accessibility |
| 18 failures | auth/client/cancel/draft tests; backend upload/quota/DB tests; new `test_privacy.py`; synthetic restore | BLOCKED: full device failures, hosted restore and concurrent production writers |
| 19 security | `test_private_journal.py`, `test_postgres.py`, `test_privacy.py`, storage/auth tests: ownerA/B, restricted roles, transactions, export exclusions | BLOCKED: deployment role/TLS/backup/native store verification; restricted service role is app owner boundary, not per-user direct DB access |
| 20 accessibility | mobile i18n/direction/Screen/TrendsChart tests; added EN/HE daily values, unknowns,units,layers | BLOCKED: full physical HE/EN,RTL,dark/dynamic type,VoiceOver/TalkBack matrix. Narrow simulator observations only where recorded |

## F01–F20 full definition-of-done assessment

"Partial" here means implementation exists and local tests pass, but full specification/device/release evidence remains open; it does not erase earlier implementation checkpoints.

| Feature | Local implementation evidence | Full DoD |
|---|---|---|
| F01 goals/DayDial | P03 goals/dial, dates and history tests | PARTIAL: E2E04/edit UI/device |
| F02 trends | P07 trends + P13 accessible daily values | PARTIAL: full assistive/device matrix |
| F03 weight | P07 tracking/version/retry/units | PARTIAL: native evidence |
| F04 recent/favorite/repeat | P04 library/idempotent repeat | PARTIAL: native journey |
| F05 recipes | P04 versioned recipe/editor | PARTIAL: full native editing/logging |
| F06 text | P05 deterministic Hebrew/English/shared Confirm | PARTIAL: device and optional AI gates |
| F07 voice | P05 editable transcript adapter | PARTIAL: physical speech permissions/provider |
| F08 copy | P04 preview/idempotent day/group copy | PARTIAL: native and bounds |
| F09 label | P06 normalized fixture OCR/corrections/private persistence | PARTIAL: held-out images/device/provenance |
| F10 sources | P06 pinned references/provider resolver | PARTIAL: live Israeli coverage and licensing |
| F11 portions | P06 food-specific mapping/conversion | PARTIAL: broad serving coverage |
| F12 weekly summary | P08 deterministic partial-aware summary | PARTIAL: native and wording policy |
| F13 recommendations | P08 reviewed declarations/filter/Confirm | PARTIAL: source/medical policy/usability |
| F14 AI quotas | P01/P02 central budget reservations/mock concurrency | PARTIAL: real project policy and quotas |
| F15 habits | P09 registration/lease/scheduler logic | PARTIAL: hosted delivery/device |
| F16 iOS Health | P10 mapping/receipts/adapter | PARTIAL: signed physical integration |
| F17 Android Health | P11 provider/ledger/reconciliation | PARTIAL: physical permissions/deletions/provider versions |
| F18 widgets | P12 bridges/native targets/lifecycle | PARTIAL: OS cached pixels, signing/device |
| F19 hydration | P07 CRUD/units/trends | PARTIAL: device/widget/Health propagation |
| F20 photo | existing multi-item pipeline + P02/P05 contracts | PARTIAL: real held-out accuracy/protocol; no fabricated benchmark |
