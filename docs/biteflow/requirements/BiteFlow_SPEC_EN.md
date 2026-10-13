# BiteFlow — Product Specification, Technical Architecture & Codex Implementation Plan

**Version:** 1.0 (English translation)  
**Source version date:** October 13, 2026  
**Status:** Requirements and implementation plan for product-owner review and approval before architectural changes or production operations  
**Audience:** Product owner, Codex, frontend/backend/AI engineers, QA  
**Source of truth:** This document defines the requested product behavior and implementation constraints. A Codex handoff is included at the end.

> **Important source clarification:** A text file previously supplied in the conversation was a `brainstorming` workflow skill, **not an existing BiteFlow product specification**. This document therefore does **not** claim that the repository, database schema, or a previous BiteFlow specification has been inspected. Descriptions of current functionality come only from the product owner's statements and the earlier feature prompt. Repository-specific decisions must be verified during **P00**. This document is **not** authorization to run production migrations, perform destructive operations, or deploy to production without separate testing and approval.

---

## 1. Product Vision, Goals & Scope

**Vision:** Transform BiteFlow from an app that identifies what the user ate into a daily nutrition companion that shows **how the user is progressing toward their goals**, makes logging nearly effortless, and provides personalized insights with trustworthy nutrition calculations, privacy protections, and controlled AI costs.

**Three measures of product value:** (a) quality of food and nutrition recognition; (b) time and number of actions needed to log a meal; and (c) usefulness of the daily and weekly status views. New features must not materially undermine any of these.

**Existing capabilities to verify in the repository:** The product owner reports an existing `DayDial`, a photo-analysis confirmation/editing screen, image-based food recognition, an AI integration, nutrition sources such as USDA/Open Food Facts, and possibly a saved-meal API currently supporting only create/delete. The assumed **500 AI requests/day across the whole project is a planning assumption, not a verified provider quota**. Do not assume Expo, React Native, Supabase, or any particular stack without repository evidence.

**In scope:** Personal goals; analytics/trends; weight; water; recent/favorite/repeated meals; saved recipes; text and voice input; copying meals/days; nutrition-label OCR; Israeli food data and household units; weekly AI insights and meal recommendations; AI budgeting; reminders and streaks; Apple Health and Health Connect; native home-screen widgets; shared domain services, security, testing, and staged release.

**Out of scope:** Medical advice or diagnosis; extreme dieting advice; a promise of exact food weight from an image alone; acquiring datasets without authorization; production deployment or destructive changes without backup and approval; mock functionality presented as complete.

**Target users:** Hebrew-speaking users in Israel who track calories/macros, users with recurring meals, users who sync weight and steps, and users who prefer photo, text, or voice input. English/LTR is also supported.

### Non-negotiable principles

1. **Single Confirmation Flow:** Image, barcode, text, voice, nutrition label, recipe, favorite, and repeat inputs all produce the same editable meal draft and open the same confirmation screen. Never automatically save an unconfirmed AI result.
2. **Nutrition Truth Layer:** Calculate calories and macros deterministically from normalized nutrient data. Do not use an LLM to compute final sums.
3. **Evidence over false precision:** Distinguish verified, estimated, and missing values. **Unknown is not zero.**
4. **Historical snapshots:** Changing a product, recipe, or goal later must not rewrite past logs unless the user explicitly edits a historical entry.
5. **Strict user isolation:** Enforce authorization/RLS as appropriate; keep credentials and provider secrets on the server.
6. **Offline/failure tolerance:** Fast logging must work without AI where feasible; retries must not create duplicates; missing native features must not break the app.
7. **Incremental delivery:** Every phase includes manageable changes, tests, review, safe migrations, rollback options, and an evidence-based progress report.

## 2. User Experience, Navigation & Flows

### 2.1 Proposed navigation — adapt to existing screens

- **Today:** Existing DayDial with goal and remaining calories; protein/carbohydrate/fat progress; water; today's meals; Add Food action; quick repeat; short weekly insight.
- **Add Food:** Take food photo, scan barcode, scan nutrition label, type a description, record voice, recent meals, favorites, and recipes. A single action sheet is acceptable instead of another screen.
- **Confirm Meal:** Editable item list, names, familiar serving units, grams/ml, nutrition source and confidence, portion edits, add/remove items, totals, date and meal category, and explicit confirmation.
- **Trends:** Week/month, averages, days meeting goals, prior-period comparisons, charts, and clear treatment of missing records.
- **Profile & Settings:** Goals, weight, water, recipes, optional dietary preferences, reminders, language, health permissions, privacy.

Do not break existing navigation. Prefer extending existing components and preserving deep links. Provide complete Hebrew RTL and English LTR support, including chart axes, units, directional icons, and numeric inputs.

### 2.2 Mandatory unified ingestion flow

```text
Input adapter (image / text / voice / barcode / label / repeat / recipe / manual)
  -> Normalized MealDraft
  -> Resolve nutrition references and portions
  -> Shared Confirm/Edit screen
  -> Validate
  -> Atomic, idempotent save
  -> Invalidate/update dashboard, trends, widget and enabled health sync
```

- Before explicit confirmation, data remains a **draft**. Recognition failures offer manual entry and controlled retry, not an empty meal or invented values.
- Every input adapter must produce the same data contract and flag uncertain identification, amount, or nutrient fields.
- Save exactly once using `client_request_id` / an idempotency key. Retrying the same request must not create another meal.
- On save, show the log entry, update DayDial, recalculate analytics, and request widget/health updates when enabled.
- Editing or deleting a logged meal must propagate consistent changes, including reconciliation of health samples originally written by BiteFlow.

### 2.3 UX responsiveness goals — not measured SLAs

- Logging a recent or favorite meal must not require AI; aspirationally complete it within **2–3 interactions after opening Add Food**.
- Goal and water edits should update UI optimistically, with a visible rollback if persistence fails.
- Image recognition and OCR must include progress indicators, cancelable timeout states, and manual correction paths. Measure P50/P95 after P00 before committing to a numerical SLA.

## 3. Data Contracts, Nutrition Accuracy & Calculation Rules (A00 — prerequisite)

### 3.1 Nutrition domain model

Define shared types (or equivalents fitting the actual stack):

- `FoodReference`: `id`, `provider`, `provider_ref`, `version`, `name_he`, `name_en`, `brand`, `barcode?`, `verified_status`, `last_verified_at?`.
- `NutritionPer100`: `basis = g | ml`, `energy_kcal?`, `protein_g?`, `carbs_g?`, `fat_g?`, `fiber_g?`, `sugars_g?`, `saturated_fat_g?`, `sodium_mg?`. **`null` means unknown**.
- `Portion`: `quantity`, `unit`, `normalized_g?`, `normalized_ml?`, `food_specific_conversion_id?`, `estimated:boolean`.
- `MealDraftItem`: identified food, portion, source, nutrient fields, `confidence?`, `warnings[]`, `manual_override:boolean`.
- `MealDraft`: `schema_version`, `input_method`, `occurred_at`, `local_date`, `timezone_id`, `meal_category`, `items[]`, `warnings[]`, `status=draft`.
- `FoodLog` and `FoodLogItem`: independently persisted **snapshots** of nutrient values and portions at the moment of saving; optional references to source products/recipes are for traceability only.
- `NutritionGoalRevision`: goal values, `effective_local_date`, and revision history for calories/macros/water.
- `WeightRecord` and `WaterRecord`: source, timestamp, normalized unit, sync identity, and user identity.

**Illustrative JSON contract only — map to the real repository schema:**

```json
{
  "schema_version": "1",
  "input_method": "image",
  "status": "draft",
  "occurred_at": "2026-10-13T12:30:00+03:00",
  "timezone_id": "Asia/Jerusalem",
  "meal_category": "lunch",
  "items": [
    {
      "display_name": "chicken breast",
      "portion": {"quantity": 150, "unit": "g", "normalized_g": 150},
      "nutrition_per_100": {
        "basis": "g",
        "energy_kcal": 165,
        "protein_g": 31,
        "carbs_g": 0,
        "fat_g": 3.6
      },
      "source": {"provider": "verified_database", "reference_id": "sample"},
      "confidence": "estimated",
      "warnings": ["Confirm portion size"]
    }
  ]
}
```

All nutrient numbers in this JSON are **illustrative**. Do not treat them as verified real-world food data.

### 3.2 Calculation and display rules

- Display energy in kcal, protein/carbs/fat in grams, water in ml, and store body weight in kg; display can optionally use lb/fl oz.
- For per-100g values: `item_value = nutrient_per_100 * normalized_grams / 100`; for per-100ml values, use normalized ml. Converting volume to mass requires reliable food-specific density or user confirmation.
- `meal_total = sum(confirmed item values)`; do not round intermediate item calculations. If one item lacks a macro, label the corresponding meal total **partial/unknown**, rather than presenting a false complete sum.
- Packaged kcal values may reasonably differ from `4*protein + 4*carbs + 9*fat`. Do not overwrite verified label energy with that estimate. Flag suspicious discrepancies for review.
- `kcal = kJ / 4.184`; detect labels showing both units to avoid double conversion. Sodium and salt are different fields; only convert with the appropriate factor and source semantics.
- Source selection must prioritize **specificity and verification**: confirmed barcode/product match, user-confirmed custom product, verified Israeli data, Open Food Facts/USDA based on actual match, then clearly identified AI estimates. An Israeli database is not always more authoritative for a specific branded product.
- If a serving size cannot be estimated reliably, request a quantity or show an estimated range and warning; never use zero as a missing-data substitute.
- Preserve nutrient-level provenance where feasible: `provider/source_id`, record version, update date, OCR/AI/user edits, and a way to view source information.

### 3.3 Dates, history and revisions

- Store timestamps with timezone context and `local_date` representing the day to which the user assigned the log. Crossing timezones must not silently rewrite history.
- Goal revisions take effect on their specified **local effective date**; historical trend calculations compare each day against the goal effective on that day.
- Editing a recipe creates updated future recipe state/version while existing log snapshots remain unchanged. Copying days creates new IDs and never mutates the source.
- Deleted records disappear from daily totals; handle indexes, caches, health sync, and retained drafts according to the deletion policy.

## 4. Feature Specifications

### F01 — Personal Goals & DayDial

**UI:** Screen to set/edit daily calories, protein, carbohydrates, fat, and water; optional target weight. Upgrade the existing DayDial to show consumed/target/remaining/percentage. Show macro progress bars and a clear **no goal configured** state.

**Behavior:** Manual goals are the default. An optional goal estimator may use user-provided age, height, weight, activity, and purpose, with transparent assumptions and a statement that estimates are not medical advice. Sensitive details are optional. Goal changes affect today/future dates by default, unless the user explicitly chooses otherwise. Validate positive, plausible goal values. Warn if energy and macro goals do not align, but never silently change user-entered numbers.

**Meeting a goal:** By default, calorie intake within **90%–110%** of target is considered in range (configurable); protein is met at **>=100%**; carbs and fat are shown separately as proximity/overage, not automatically failure if below target. If showing an overall achievement indicator, disclose precisely what it represents. Incomplete logging must not be interpreted as proof of complete intake.

**Acceptance:** Adding/editing/deleting meals recalculates DayDial and bars; changing goals tomorrow does not change yesterday's achievement calculation; unknown nutrients are not displayed as zero.

### F02 — Weekly & Monthly Trends and Analytics

**UI:** Week/month tabs, daily calorie versus goal charts, macro trends, days meeting goals, logged-day averages, comparisons to prior period, metric selection, and access to individual days. Indicate insufficient data.

**Data rules:** Calorie averages use only days with confirmed log activity and are labeled **average on logged days**. Unlogged days are not zero-intake days. Show goal adherence with an explicit denominator, e.g. **X of Y logged days**. Optionally let a user mark a day **logging complete** for a stricter adherence metric. Prefer a Sunday–Saturday week in Israel, with exact period dates displayed.

**Acceptance:** Empty days do not reduce averages; goal changes in the middle of a month do not rewrite earlier achievement; sparse data gets a warning, not misleading charts; period comparisons use equivalent definitions.

### F03 — Body Weight Tracking

**UI:** Add/edit/delete weight; latest weight, change since previous measurement, weekly/monthly trend, optional target weight; weight chart and overlay against calorie consumption, with labeled dual axes and toggleable layers.

**Rules:** Store kg; optionally show lb. Latest weight is determined by measurement time. If multiple measurements exist in one day, the daily chart uses the day's latest entry. Weekly average uses only dates with actual measurements. Never fabricate missing measurements. Health-imported weights retain source and external IDs for deduplication.

**Acceptance:** Edits propagate to all charts; any smoothed line is labeled as a trend, not a measured point; switching display units does not alter stored values; health sync does not duplicate weights.

### F04 — Recent Meals, Favorites & “Eat Again”

**UI:** Quick Add displays approximately 10–20 recent meals (configurable), search, favorite/unfavorite controls, Eat Again, and serving-size adjustment before confirmation.

**Rules:** Repeating a meal creates a new `FoodLog` containing the source snapshot with a new date; it requires no AI request and does not alter the original. Portion edits use deterministic scaling. A meal appearing in both Recents and Favorites must not create duplicate database entries.

**Acceptance:** A default serving can be added in 1–2 actions from Quick Add; no AI is called; two distinct records have distinct IDs; unfavoriting does not delete logs.

### F05 — Saved Meals & Custom Recipes (Full Editing)

**UI:** Create a custom meal such as “My Usual Salad”; configure name, ingredients, each quantity, and number of servings. Display total and per-serving calories/macros. Support edit, delete, duplicate, and log a selected serving count.

**API:** Support read/create/update/delete of recipes and their components. Updates should be atomic and preferably use optimistic concurrency via `version` / `updated_at`. Deleting a saved recipe hides/removes it from the personal catalog without removing logged meals created from it. Reuse the food/quantity editor from the shared confirmation flow.

**Acceptance:** Ingredient edits recalculate per-serving totals; logging two servings scales correctly; tomorrow's recipe edit does not change yesterday's logs; simultaneous edits cannot silently overwrite one another.

### F06 — Free-form Food Text in Hebrew and English

**UI:** Accept “חצי פיתה עם חומוס וביצה קשה” or “200g chicken with rice and salad”; show parsed items in the existing editable confirmation screen.

**Processing:** First attempt deterministic/local parsing for straightforward phrases, numbers, and known measures; use AI fallback only for complex ambiguity. Identify ingredients, amounts, units, and language variants; resolve against nutrition sources; prompt for unclear amounts or unreliable sources; support Hebrew/English code-switching.

**Acceptance:** The Hebrew example yields at least three separate foods when appropriate; missing quantities are visibly uncertain; no data is saved before confirmation; text does not get a second, inconsistent confirmation screen.

### F07 — Voice Food Logging

**UI:** Microphone button, just-in-time permission prompt, clear recording state and stop control, editable transcription, Hebrew and English support.

**Processing:** Select on-device/native speech-to-text only after verifying platform/framework support. Use an approved cloud fallback only if necessary and within cost/privacy limits. Route transcription into **F06**; do not create a separate nutrition interpretation pipeline. Do not retain raw audio beyond operational necessity without consent.

**Acceptance:** “אכלתי שתי ביצים וחצי פיתה” becomes editable text and then the shared Confirm screen. Microphone permission denial leaves text entry available. Users can correct transcription errors without rerecording.

### F08 — Copy a Meal or an Entire Day

**UI:** “Copy Yesterday,” “Duplicate Meal,” “Copy Entire Day,” destination date picker, preview, and selection of specific meals.

**Rules:** Create new records with optional `copied_from_id`; keep nutrition snapshots; preserve source meals' **local meal time** on the destination date and account for DST. Do not automatically copy the old day's goal. Warn and request separate confirmation when the target date already contains meals. Retrying the same copy operation must be idempotent.

**Acceptance:** Original day is unchanged; all selected ingredients/macros are correctly duplicated; populated destination days trigger warnings; retry does not create duplicates.

### F09 — Nutrition Label Scanning (OCR)

**UI:** Capture nutrition labels in Hebrew/English. Extract product name, per-100g/100ml and per-serving values, serving size, kcal/kJ, protein, carbs, fats, sugars, saturated fat, fiber, and sodium. Highlight uncertain fields, allow correction, and save a personal product.

**Processing:** Crop/deskew when appropriate; use on-device OCR **only if it actually reads Hebrew reliably** on supported devices. Otherwise select an OCR/AI alternative within budget. Parse Hebrew label field names and table rows. Never conflate a per-100g value with one serving. If a label includes both basis values, preserve both or convert only when serving-size information is adequate. Prefer exact barcode lookup if a barcode was captured.

**Rules:** Uncertain values require confirmation. New products are stored privately and not published automatically in a global catalog. Repeated-label caching must not expose private images or product data across users.

**Acceptance:** A label with kcal and kJ is not double-converted; per-100/per-serving math is correct; Hebrew OCR is evaluated against actual Israeli labels; missing nutrients are not guessed as zero.

### F10 — Israeli Nutrition Sources & Provider Resolution

**Approach:** Discover, validate licensing/format, and integrate official Israeli Ministry of Health food-composition tables **only if an accessible and reusable source actually exists**. Never fabricate a dataset or claim it was imported without proof. Build a provider import adapter tracking source, release date, schema/units, quality, errors, and dry-run results. Retain USDA and Open Food Facts.

**Desired regional coverage:** Pita, hummus, tahini, falafel, shakshuka, sabich, schnitzel, Israeli salad, bourekas, malawach, jachnun, cottage cheese, labneh, shawarma, kebab, and commonly sold Israeli packaged foods. Homemade preparations must allow recipe-dependent values rather than one supposedly universal exact number.

**Licensing:** Preserve attribution and evaluate terms of use, including Open Food Facts ODbL/share-alike obligations if applicable to the database usage pattern. Do not publish user-originated data to external catalogs without consent.

**Acceptance:** Hebrew search includes aliases; duplicate hits are meaningfully grouped/differentiated; sources and verification are visible; no production import occurs without licensing, data validation, and approval.

### F11 — Food-specific Household Serving Units

**UI:** Support tablespoons, teaspoons, cups, slices, pieces, halves, “half a pita,” small/medium/large servings, grams, and ml. Include Hebrew equivalents, e.g., `כף`, `כפית`, `כוס`, `פרוסה`, `יחידה`, `חצי`, `מנה קטנה`, `מנה בינונית`, `מנה גדולה`. Allow edits in Confirm Meal.

**Rules:** Use `ServingConversion(food_id, unit, grams_or_ml, evidence, confidence)`. A tablespoon of tahini must not automatically weigh the same as a tablespoon of rice. Record reliable density where available. If a unit lacks a credible food-specific conversion, prompt for confirmation or label it as estimated. Preserve both the user's original quantity/unit and the normalized amount.

**Acceptance:** Tahini and another food use separate tablespoon conversions; half a pita scales from the specific pita record; changing a serving unit never silently changes nutritional values without updating the underlying quantity.

### F12 — Intelligent Weekly Nutrition Summary

**UI:** A “Week in Review” card in Hebrew/English with logged-day averages, protein/calorie achievement, distribution across meals, comparison with prior week, and missing-data cautions.

**Processing:** Compute all statistics in **deterministic code or queries**. If budget permits, AI can express **verified structured metrics** in natural language but must not invent numbers. Otherwise, use template-based summaries. Cache by user/week/data revision and invalidate when relevant entries are corrected.

**Acceptance:** Summary numbers match Trends; “your breakfasts were low in protein” must not appear without adequate breakfast data; exhausted AI budget must not crash the feature.

### F13 — “What Should I Eat Now?” Recommendations

**UI:** Suggest 2–4 meals based on remaining calorie/protein/macro goals, favorites, and saved recipes. Show food, approximate nutrition, suggested serving size, and rationale. Selecting a recommendation opens the **shared editable confirmation flow**, not an automatic save.

**Processing:** Start with a deterministic ranking engine: filter known allergens/restrictions, match remaining nutrient budget, prefer familiar meals, rank plausible options. AI may optionally formulate explanations or propose alternatives that are validated against the nutrition catalog. Dietary restrictions/allergies are optional user-entered sensitive data; if missing, do not assume the user has no allergies. Recommendations must not be positioned as medical care or unsafe restrictive plans.

**Acceptance:** Recorded allergies are respected; functionality remains usable without AI; macro estimates derive from food data; all choices remain editable before logging.

### F14 — Central AI Quota, Cost & Fallback Management

**Goal:** Route all third-party AI calls through a server-enforced gateway with usage accounting by `provider/model/feature/date/estimated_cost/user_id` where appropriate, budgets, caching, retries, and graceful degradation. **500 calls/day is a configurable starting hypothesis**, not proof of the provider's real limit. Before enabling, verify the actual provider/account allowance, billable call definition, and reset window.

**Suggested initial policy:** Set a configurable `daily_project_limit=500`; reserve an initial **350** calls for core food photo recognition, leaving **150** for other AI features. Example secondary limits: label OCR 60, text 40, summaries 25, recommendations 25. These are initial tunable values, not absolute user requirements; all non-photo features must not starve photo recognition. When budget is exhausted, provide catalog/manual lookup, deterministic text parsing, template insights, and rules-based recommendations. Native speech recognition need not use the LLM quota.

**Security and reliability:** Server-only provider keys, user-specific rate limiting, atomic budget reservations under concurrency, exponential backoff for transient faults, accounting for billable retries, privacy-safe cache keys, TTL/storage limits, and structured usage tracing without collecting raw private health data.

**Acceptance:** A test with 100 simultaneous requests does not overshoot configured limits; HTTP 429 yields a usable no-AI alternative; photo calls retain priority; an authorized admin-only dashboard/log distinguishes requests and costs by feature.

### F15 — Reminders, Notifications & Logging Streaks

**UI:** Opt-in settings for breakfast/lunch/dinner reminders, water prompts, evening review, quiet hours, and notification mute. Show current streak, longest streak, and logged days.

**Rules:** Send a meal reminder only if no confirmed log exists for the relevant meal category at decision time, taking local time, permissions, and quiet hours into account. Define a logged-day streak as consecutive local days with **at least one confirmed FoodLog**. A streak is distinct from meeting nutrition targets. Handle DST and timezone changes consistently. Avoid spamming; when current logging status cannot be verified, prefer not sending a potentially incorrect prompt.

**Acceptance:** Existing lunch suppresses lunch reminders; denying notification permission does not block the app; water-only logging and goal-setting do not increment the meal streak.

### F16 — Apple Health (HealthKit), iOS

**With explicit read permission:** Body weight and step count. **With explicit write permission:** Dietary energy, protein, carbohydrates, total fat, water. Evaluate whether HealthKit meal correlations are useful for the actual data model.

**Rules:** Choose native integration after inspecting the real client stack, capabilities, entitlements, and signing/build requirements. If Expo is used, do not assume that HealthKit native modules work in Expo Go. Maintain a stable mapping from BiteFlow meal/water entries to app-created Health samples. Reconcile edits/deletions only against **samples owned by BiteFlow**, never remove records created by another app. Preserve source/time/external IDs for weight imports. Avoid nutritional re-import loops from BiteFlow to Health and back into BiteFlow.

**Acceptance:** Denied or partial permission does not break logging; repeated sync does not duplicate samples; updating one meal touches only matching BiteFlow samples; run real-device iOS testing and validate the native build.

### F17 — Android Health Connect

**Read:** `WeightRecord` and `StepsRecord`. **Write:** `NutritionRecord` (energy/macros) and `HydrationRecord` (water), subject to supported Android/Health Connect versions and granted permissions. Detect availability/installation and communicate status.

**Rules:** Maintain `clientRecordId`/metadata or equivalent for effective upsert and deduplication; normalize dates and units, perform incremental sync, request minimum permissions, and use framework-compatible native APIs. Keep the rest of BiteFlow usable without Health Connect.

**Acceptance:** Verify on a supported Android device or emulator, including denied permissions; repeated sync/edit/retry never doubles nutrition or water records.

### F18 — Native iOS & Android Home-screen Widgets

**UI:** Today’s kcal consumed/remaining, protein progress, and goal status, plus water if space permits. Account for signed-out users, missing goals, and lock-screen privacy. Support appropriate native widget sizes.

**Implementation:** Build **real native widgets** (iOS WidgetKit and Android App Widgets), with protected shared snapshots/caches and a refresh request after changes. **Do not promise instantaneous refresh:** the operating system controls update timing. Provide `last updated` when useful. Never place secrets or authentication tokens in insecure widget storage.

**Acceptance:** Widget is installable from the operating-system widget gallery and displays data on a device; a meal change requests a refresh and eventually becomes visible within platform scheduling constraints; logging out removes access to the prior user's data.

### F19 — Water & Hydration Tracking

**UI:** Daily water target and Today progress, quick buttons `+150`, `+250`, `+500 ml`, custom amount, entry history, edit/delete, week/month trends, and integration with widgets and health platforms.

**Rules:** Each water entry stores ml and `occurred_at`; the water goal belongs to goal settings; alternate units are display-only conversions. Do not automatically count drink volume recorded inside a meal as a water log unless the product owner explicitly chooses this behavior. Avoid double-counting health-synced hydration.

**Acceptance:** Adding 250 + 500 displays 750 ml; deleting the 250 entry produces 500 ml; Today, Trends, and optional widget/health integration are updated; reminders honor user preferences.

### F20 — Better Food Photo Recognition: Multi-item Plates & Portion Accuracy

**Why this is a priority:** The product owner reports that image recognition is currently not accurate enough. Improve this **core experience before expanding AI consumption**.

**Approach:** Audit the existing photo pipeline, image compression, prompts, expected schemas/outputs, image quality, test photos, food-database matching, and calculation logic. Detect **multiple distinct foods** on a plate, including visible sauces/sides where possible; estimate portions with clear uncertainty; resolve to reliable nutrient data; allow corrections in Confirm Meal. When a photo is ambiguous, ask for another angle or quantity rather than presenting false confidence. Use extra AI passes **only when measured quality gains justify the additional quota cost**.

**Evaluation set:** Assemble a permitted benchmark with Israeli foods, multi-component meals, partly obscured items, varied lighting, and known reference portions. Curate ground truth, including plausible portion-weight intervals. Measure component precision/recall, portion error, calorie MAE, and uncertainty calibration. Establish a baseline before changes and compare the new pipeline afterward; do not invent accuracy percentages. Success means a demonstrable improvement on the evaluation set without material regression or unacceptable AI usage.

**Acceptance:** A photo containing three foods yields three separately editable items when recognized; failure/uncertainty states are coherent; the existing photo → confirm → save flow still works; comparison report cites the actual number of test examples and observed results.

## 5. Proposed Architecture (Subject to P00 Repository Audit)

### 5.1 Logical services

1. **Capture Adapters:** image, text, voice/STT, barcode, label OCR, recents, favorites, recipes, manual input.
2. **Normalization & Identity:** language/name cleanup, quantities, provider matching, item identity, provenance, confidence, units.
3. **Nutrition Engine:** source resolution, per-100 normalization, portion/recipe arithmetic, provenance, validation.
4. **MealDraft & Confirmation:** shared draft contract, shared editor, transactional save.
5. **Tracking:** FoodLog, Goals, Water, Weight, Streak, DailyAggregates.
6. **Insights:** deterministic trends, cached weekly summaries, filtered recommendations.
7. **Native Integration Adapters:** Apple Health, Health Connect, widgets, notifications.
8. **AI Gateway:** model/feature usage policy, quota, caching, logging, graceful degradation.

**Responsibility boundaries:** UI components do not invent nutrient values. External sources cannot write FoodLogs without user confirmation. AI never takes over deterministic accounting. Health sync is not the source of truth for food logs created inside BiteFlow.

### 5.2 Proposed database entities — adapt names to the real schema

- `user_nutrition_goal_revisions`: `id`, `user_id`, `effective_local_date`, `calorie_target`, `protein_g`, `carbs_g`, `fat_g`, `water_ml`, `target_weight_kg?`, `created_at`.
- `food_catalog`: verified/private product data, barcode, provider/provider ID, per-100 nutrients, audit/version.
- `food_serving_conversions`: `food_id`, unit, conversion to grams/ml, evidence, confidence, conversion version.
- `meal_logs`: `id`, `user_id`, `occurred_at`, `local_date`, `timezone_id`, `category`, `source_input`, `client_request_id`, `copied_from_id?`, `nutrition_snapshot`, `created_at`, `updated_at`.
- `meal_log_items`: `meal_id`, food snapshot, portion snapshot, nutrient snapshot, confidence/warnings.
- `saved_recipes` and `saved_recipe_items`: `id`, `user_id`, `name`, `servings`, `version`, optional `deleted_at`, ingredient snapshots/references.
- `favorites`: user-specific link to the relevant food/recipe/meal identity; avoid attaching favorite status to immutable historical logs if it conflicts with the model.
- `weight_entries`: `id`, `user_id`, `occurred_at`, `weight_kg`, `source`, optional `external_id`.
- `water_entries`: `id`, `user_id`, `occurred_at`, `ml`, `source`, `client_request_id`, optional `external_id`.
- As actually needed: `notification_preferences`, `weekly_insight_cache`, `ai_usage_ledger`, `health_sync_mappings`, `device_widget_state`.

**Constraints:** Foreign keys; non-null required fields; `CHECK(quantity > 0)` / `CHECK(ml > 0)`; uniqueness for `(user_id, client_request_id)` on create operations and `(user_id, provider, external_id)` on synced data; recipe versions; indexes such as `(user_id, local_date)` and `(user_id, occurred_at)`; explicit distinction between private and global catalog entries.

**Security:** If Supabase is in use, enable appropriate RLS on every user-data table. Regardless of the database, enforce authorization on every endpoint and query using the authenticated user identity. Do not trust client-provided source/verification fields as authoritative. Do not expose sensitive nutrition/health details in analytics without a legitimate need.

### 5.3 Logical API contracts — not claims about existing routes

- `GET/PUT goals`; `GET daily-summary(date)`; `GET trends(period)`. Goal revisions preserve history.
- `POST analyze/image`; `POST analyze/text`; `POST analyze/label`; `POST barcode/lookup`. Each **returns `MealDraft` without writing a FoodLog**.
- `POST meal-logs` (idempotency key); `PATCH/DELETE meal-logs/{id}`; `POST meals/copy`; `POST days/copy`.
- `GET/POST/PATCH/DELETE saved-recipes`; `GET recents`; `GET/POST/DELETE favorites`.
- `GET/POST/PATCH/DELETE water` and `weight`; `GET recommendations`; `GET weekly-insight`.
- `POST health/sync` and/or a native sync queue; `GET ai-budget-status` for authorized administrators only.

Every endpoint needs authentication, validated inputs, typed success/error responses, appropriate idempotency, and minimal privacy-respecting telemetry. Reuse existing routes when possible; do not build duplicate APIs.

### 5.4 Decisions Codex must verify before selecting dependencies

- Actual client framework, build tooling, database, offline/sync architecture, UI components, authentication, analytics, AI provider, real quotas, native extension support, and permission model.
- Whether usable **Hebrew on-device STT** and **Hebrew on-device OCR** are available on the actual target devices at acceptable accuracy.
- Licensing, accessibility, and freshness of Israeli Ministry of Health data. If not validated, use an approved fallback without blocking unrelated development.
- WidgetKit/Android widget APIs and realistic refresh behavior for the supported OS versions.

---

**Related implementation plan:** [BiteFlow_IMPLEMENTATION_PLAN_EN.md](BiteFlow_IMPLEMENTATION_PLAN_EN.md). Feature identifiers: F01–F20.
