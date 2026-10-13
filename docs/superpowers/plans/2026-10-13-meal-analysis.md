# Biteflow meal analysis implementation plan

> Execution: native in this session under superpowers:executing-plans. The user
> explicitly requests autonomous implementation, overriding intermediate approval
> handoffs. Preserve existing uncommitted work on mobile-app; no mixed commits.

**Goal:** Multi-food photo analysis grounded in real nutritional reference records.
**Architecture:** Typed vision adapter → conservative USDA retrieval → arithmetic;
account-scoped mobile review → atomic existing journal inserts.
**Tech:** FastAPI/Pydantic/httpx/Pillow, Expo 57, React Native, SQLite/PostgreSQL.
**Spec:** ../specs/2026-10-13-meal-analysis-design.md

## Global constraints

- Preserve Orbit, authentication, Hebrew/RTL, barcode and existing APIs.
- No production infrastructure change or substantial expense without authorization.
- No invented nutritional provenance, weights or measured performance.
- Keep secrets backend-only and photos out of persistent analysis storage.

## Review focus

- Unknown or partially missing nutrition must never count as zero/full totals.
- Two views must not duplicate the same food; overlapping foods stay distinguishable.
- A timed-out save retried with the same content must create no duplicate meals.
- Account switching while work is in flight must not expose drafts to another user.
- Raw/cooked and sauce/paste mismatches must be rejected or visibly confirmed.

## Tasks

1. Reference data and domain contracts: acquire reproducible USDA extracts;
   write failing math/matching/schema tests, implement `analysis_schemas.py` and
   `nutrition_reference.py`, pass focused tests.
2. Inference and HTTP: failing provider/error/upload/auth integration tests;
   `vision.py`, `meal_analysis.py`, authenticated `/api/analyze-meal`, search,
   atomic `/api/meals/analyzed`; verify transaction rollback and retries.
3. Mobile: failing domain/API/save tests; account draft extension, optional photo
   context/second image, component review/search/confirmation, English/Hebrew;
   integrate existing journal store and verify editing updates totals.
4. Evaluation and documentation: licensed dataset manifest/downloader/evaluator,
   run feasible baseline/live comparisons, report unavailable metrics honestly;
   full pytest/Jest/lint/typecheck, Expo bundle, independent final review and fixes.

## Progress and rulings

- Initial workspace: branch mobile-app, pre-existing changes snapshotted privately
  in runtime/meal-analysis/preexisting.patch. Work in place to preserve prior
  uncommitted Apple sign-in implementation; do not reset or commit others' work.
- Initially no AI key was available. Later user steering requires free APIs only
  and no personal-computer production dependency; this supersedes the OpenAI plan.
- Interface choice: structured individual items + reference records; batch journal
  save returns `{meals: Meal[]}`. Existing single-item draft API remains compatible.

- Tasks 1–3 implemented. Original baseline: pytest 216 passed/16 skipped, Jest 100 passed.
  First focused pipeline/domain run: 28 passed, then reliability extension 34 passed.
  Mobile domain/editing tests: 105 total tests passed; iOS JS/Hermes export succeeded.
- Ruling: extracted all 13,225 SR Legacy + FNDDS entries (2.3 MB), rather than a small
  hand-curated subset — broader recipes, no runtime USDA key/network dependency.
  Exact source checksums and reproducible import command retained.
- Ruling: all auto-matched generic records require user confirmation. No evidence
  supports silently claiming precise recipe matching or calibrated weight intervals.
- Reference audit caught raw/cooked filtering and singular potato/tomato gaps; tests
  reproduced them and normalization/filter fixes pass. Provider malformed envelopes
  now fail closed with a safe message.
- Reused the existing Google AI Studio project and key after verifying Free Tier;
  saved the key only in ignored mode-0600 `.env`. No duplicate project, billing,
  production environment change, deployment or new signed mobile build.
- Real local Qwen3-VL comparison: 13/20 visible components found, four false
  positives; experiment only, not a production dependency. Gemini evaluation
  artifacts preserve actual outcomes, including failed schema/service attempts.
- Independent final reviewer identified a session-switch race and lost region
  descriptions. Added failing regressions, fixed both, and passed regressions.
- Live Gemini rejected the full bounded decoding schema. A portable inlined
  structural schema succeeds; full strict Pydantic bounds still validate output.
- Final setup, validation, measurements and rollout status: `../../MEAL_ANALYSIS.md`.
