# P04 checkpoint — 2026-10-14

**Phase:** P04 — Fast Logging: Recents, Favorites, Recipes, Repeat & Copy. **Features:** F04/F05/F08. **Status: IMPLEMENTED LOCALLY, FULL ACCEPTANCE BLOCKED / UNVERIFIED.** The required complete native journeys, physical-device/accessibility checks and hosted validation are not verified. P04 is **not claimed complete or production-ready**. **P05 has not started.** All AI stayed mocked; no production operations, hosted database changes, deployment, push or merge occurred.

## 1. Implemented features

P00–P03 source, checkpoints, carried gates, approved requirements and P04-A–E roadmap were reviewed first. Work reused the attached worktree `/Users/braude/.codex/worktrees/biteflow-p01/food-_loger`, local branch `codex/biteflow-p04`, baseline `714bbf3`. Existing journal groups/snapshots, canonical contracts, shared ingredient editor, account storage, receipt/owner locks and journal store were extended rather than replaced.

- **Recents/favorites:** searchable, paginated owner-scoped snapshot reads, default/max 20 per page. Favorites are unique links to source meals/recipes, with no copied catalog records. Unfavorite preserves logs; deleted sources disappear from the library; account deletion erases private links/history/receipts.
- **Quick Add / repeat:** selected portion or recipe serving count becomes a new canonical draft with a fresh retry identity/date. Default selection → shared review → Save takes **two tested button actions**. Nutrition comes from the saved snapshot; no provider request or mutable catalog refresh. Cached selections can prepare an offline draft, but only acknowledged rows enter the journal.
- **Recipes:** read/create/edit/delete/duplicate, immutable ingredient versions, optimistic expected-version conflicts, whole-recipe/per-serving totals, owner-scoped list/cache and history viewer. Name, ingredients, quantities and yield are editable through the existing ingredient editor. Selected servings use the shared intake confirmation. Old logs remain unchanged after recipe edit/deletion. Duplicate/create receipts support uncertain-response retries; uncertain PATCH recovery uses explicit reload and does not silently overwrite another writer.
- **Copy:** Copy Yesterday, Duplicate Meal and Copy Entire Day shortcuts; source selection, destination picker, timezone/time choices, preview, shared item editing and explicit save. Populated destinations require separate acknowledgement. Known local wall time is preserved in the destination timezone; unknown, nonexistent and ambiguous times require explicit resolution. One transaction saves the selected groups, source ID/version metadata and parent/child receipts. Retries return the same live results; deleted/changed results cannot resurrect. Goals are not copied.
- **Precision/provenance:** canonical portions retain original quantity/unit/conversion/estimation through unchanged and scaled repeat/copy/recipe forms. Recurring generated fractions remain saveable without four-decimal rounding. PostgreSQL recipe yield now uses NUMERIC, including the exact supported 0.01 boundary. Existing unknown nutrients, mixed g/ml constraints and tiny-portion bounds remain.

The copy request is visibly bounded to **20 meal groups**, with up to 15 items each; larger days require reviewed subsets. Ingredients remain within 0.0001–2000 normalized g/ml. These are explicit limits, not silent truncation or guessed conversion.

## 2. Files and components changed

Exact product paths are in [changed-files.txt](evidence/p04/changed-files.txt). Main groups:

| Area | Files |
|---|---|
| Backend | `src/foodlogger/{library,recipes,copying}.py`; `app.py`, `auth.py`, `security.py`, shared `meal_service.py` transaction extraction |
| Schema | `src/foodlogger/data/{library,recipes}.sql`; three `supabase/migrations/*_p04_*.sql` files listed below |
| Mobile navigation | `(app)/library.tsx`, `recipes/index.tsx`, `recipes/[id].tsx`, `copy.tsx`; Today, Add, review, settings and meal-detail shortcuts |
| Mobile components | `LibraryPanel`, `RecipeEditor`, `CopySelection`, `CopyReview`; reused `MealAnalysisReview` / `MealFoodEditor`; NutritionGrid caption wrapping |
| Mobile domain/storage/API | `domain/{library,recipes,copying}.ts`; existing canonical/review/draft adapters; `data/library-store.ts`, journal store/save-draft; persisted draft validation, endpoints and EN/HE translations |
| Tests | `tests/test_{library,recipes,copying}.py`, real PostgreSQL cases; mobile library/cache/recipe editor/route/copy flow/domain tests |
| Review artifacts | This checkpoint, [operations/rollback](p04-operations.md), [evidence archive](evidence/p04/README.md), plus progress overlays in the P00 audit/matrix and roadmap |

No dependency, native generated project or deployment configuration was changed.

## 3. Architecture, database and recovery

The journal remains authoritative. Every repeat/recipe/copy route produces canonical `MealDraft` data and reuses the existing confirmation/editor and save path. Copy batches call the same transaction-internal writer as individual canonical saves, under one owner lock. No second intake store or nutrition engine was introduced.

Migrations: `20261014051354_p04_library.sql`, `20261014052225_p04_recipes.sql`, `20261014055032_p04_recipe_yield_decimal.sql`, all CLI-created. New tables: `library_favorites`, `recipe_headers`, `recipe_versions`, `recipe_items`, `library_requests`. Private role/RLS/grant patterns and owner predicates are retained. Schema changes were exercised only in disposable local databases.

The three independent P04 flags are **off by default**: `FOODLOGGER_LIBRARY_ENABLED`, `FOODLOGGER_RECIPE_WRITES`, `FOODLOGGER_COPY_ENABLED`. Rollback disables flags and preserves histories, immutable logged snapshots, receipts/tombstones and NUMERIC yield. **No destructive down migration or NUMERIC→REAL narrowing.** Detailed data flow, activation prerequisites, in-flight reconciliation and tested restore procedure are in [operations](p04-operations.md).

## 4. Actual commands and results

The [command manifest](evidence/p04/commands.jsonl) contains exact argv/cwd/duration/exit status; full logs retain intermediate failures and corrections. Ambient provider/production variables were stripped; Expo used an explicit loopback API URL and offline mode. Test HTTP transports reject real external calls.

| Executed command / scope | Actual result |
|---|---|
| `.venv/bin/pytest -q`, disposable PostgreSQL enabled, after review fixes | **369 passed, 9 skipped**, including **20 real PostgreSQL tests** |
| `npm test -- --runInBand --watch=false`, final mobile | **181 passed**, **35 suites** |
| `FOODLOGGER_RUN_BROWSER_TESTS=1 .venv/bin/pytest -m browser -q` | **6 passed**, 371 deselected; existing local Playwright browser regression |
| `npm run typecheck` / `npm run lint` | Passed; final lint has **zero warnings** |
| `.venv/bin/ruff check src tests scripts` / `.venv/bin/ruff format --check src tests scripts` | Passed; 73 files formatted |
| `.venv/bin/python -m build --no-isolation --outdir <private-output>` | Final wheel and sdist built; new SQL resources included |
| `npx --no-install expo export --platform ios --platform android --output-dir <private-output>` | Both final Hermes JavaScript exports passed; **not native binary builds** |
| `.venv/bin/python <private>/restore-library.py` with disposable PostgreSQL | Exact recipe versions/items, favorite, source/copy snapshots and receipts restored under restricted role; replay/delete protection passed |

The nine skips: six opt-in browser cases (passed separately), two unavailable Lite-runtime checks and one opt-in ML integration case. No unexplained failing local check remains. Initial failures include deliberately absent features, zero-yield validation, route-type generation, the copy fault-injection harness, review findings, test-import/type issues and an incorrect restore-harness connection format; all are retained with subsequent successful runs. Names containing “green” do not override a nonzero exit code.

## 5. Regression and native verification

The full suites retain P01 receipt/tombstone/owner/date/quota-mock cases, P02 partial/tiny/schema-v1 rejection/exact-nutrition/shared-confirmation cases, and P03 goals/version/cache/dial/threshold cases. The canonical writer extraction passed those existing regressions. Copy tests additionally assert source and goal documents are unchanged. Backend/source tests reject AI; default-repeat and copy component tests make no analysis/provider dispatch.

An isolated iPhone 17 Pro / iOS 26.5 simulator loaded current real components inside an **existing SDK57 development binary**, using synthetic fixtures. Limited English/Hebrew recipe, Hebrew Quick Add/copy-selection and maximum-text recipe images are archived. A long nutrient caption truncated at maximum text; the one-line cap was removed, labels were visually rechecked wrapping, and mobile checks/exports rerun. The synthetic harness is not full app routing, authentication, persistence/server integration or physical-device verification. An initial development reload temporarily left text-field values visually blank; cold relaunch rendered them. Full native language-switch behavior stays unverified.

**Full E2E-05/06/07, Android layouts, native binary builds, VoiceOver/TalkBack and physical-device tests are NOT claimed passed.** No current Android install was attempted after the carried emulator-install limitation. P03's saved-meal edit UI absence still blocks its complete E2E-04 journey. Earlier photo/gallery/native gates also remain open.

## 6. Independent review and fixes

One fresh independent reviewer assessed `714bbf3..0bb5262`: **no Critical issues, five Important issues**, each reproduced and fixed with RED→GREEN regressions:

1. Recurring serving fractions failed keyboard precision validation → retain validated generated quantity precision.
2. Intermediate invalid yield crashed rendering → finite guard and unknown preview until valid.
3. PostgreSQL REAL rejected yield 0.01 → NUMERIC migration and real PostgreSQL boundary/round-trip tests.
4. Original portion conversion/estimation metadata was lost → persist and scale original portions alongside normalized values.
5. Reload updated child form but not parent Delete/Duplicate version → explicit reload reconciliation, verified through the real route component.

See [review](evidence/p04/review.md). Full suites followed fixes. The subsequent native caption-wrap fix is a separately recorded QA finding. No second independent review is asserted; no known confirmed Important issue was left unfixed.

## 7. Remaining blockers, risks and deferred items

| Gate / risk | Status and evidence needed |
|---|---|
| Full P04 E2E-05/06/07 and RTL/large type/accessibility | **BLOCKED/unverified** beyond component/API tests and limited simulator previews; needs complete real navigation, keyboard, restart, offline/reconnect and confirm/save journeys on both platforms |
| Physical devices / native binaries | **BLOCKED/unverified**; requires actual iOS/Android builds/devices and assistive-technology checks |
| Hosted CI / staging | **BLOCKED/unverified**; no push, hosted run, hosted migration/role/backup or staging validation authorized/performed |
| Real AI quotas/policies/model tier/reset windows/paid fallback | **BLOCKED/unverified**, carried P01/F14; no real provider calls, measured quotas or cost claims |
| Photo evaluation protocol / held-out dataset | **BLOCKED**, carried P02; no live recognition benchmark. Needs frozen matching, adjudication, aggregation, model IDs, uncertainty/stopping rules and a larger no-food holdout |
| Exact 10% client macro warning | **OPEN**, carried P03 floating-point advisory boundary; this phase did not close it |
| Explicit basis-correction provenance | **OPEN**, carried P02; unchanged/scaled canonical portion preservation is fixed, but an explicit user basis correction still needs original-basis/manualOverride handling |
| Source limits / history retention | 20-group copy cap and existing per-item range disclosed; deleted recipes retain versions until account erasure. Retention policy and very large-day workflow need review |
| Restore/deployment differences | Local PostgreSQL 16 evidence only; hosted version/tzdata/configuration and restore/client-cache reconciliation require staging evidence |

No P04 AI/OCR/photo quality, cost, latency, token or quota metric was fabricated. P02's photo preparation checks remain preparation evidence, not accuracy acceptance.

## 8. Acceptance criteria

PASS below means the named **local** behavior was actually verified; it does not close the separate complete-native/staging rows.

| Required criterion | Result | Supporting evidence |
|---|---|---|
| Owner-private recents/search/pagination/favorites; no duplicate catalog record; unfavorite preserves logs | **PASS locally** | `test_library.py`, PostgreSQL grants/owner tests; LibraryStore cache/isolation tests |
| Default Quick Add 1–2 actions, new ID/date, explicit confirmation, zero AI | **PASS locally** | Two-button real component→DraftProvider→shared review/save test; API distinct-record/source tests and rejecting provider fixture |
| Deterministic repeat/recipe scaling, fractional yield, partial/tiny/mixed-unit safety | **PASS locally** | Exact domain, persisted recurring-fraction/save, backend recipe and PostgreSQL 0.01/0.3333/3.125 cases |
| Full recipe CRUD/duplicate/components, totals/per-serving, selected serving logging and version history | **PASS locally** | Recipe API/editor/route tests; real immutable version/history API; shared library serving adapter. Full native E2E remains below |
| Recipe edit/delete leaves old logs intact; concurrent edits cannot overwrite silently | **PASS locally** | SQLite/API snapshot equality, expected-version races and restricted-role PostgreSQL tests |
| Copy preview/selection/destination; empty/populated dates and separate acknowledgement | **PASS locally** | `test_copying.py`, CopyFlow component test (no pre-confirm writes) |
| DST gap/fold/unknown time and traveling timezone preserve chosen local time | **PASS locally** | Actual ZoneInfo gap/fold/travel tests; unresolved-time UI remains outside review |
| All selected copy groups atomic/idempotent; no original/goal mutations or resurrection | **PASS locally** | Injected second-write rollback, concurrent retries, source/goal equality, tombstone tests and restored receipt tests |
| Backward compatibility and P01–P03 local regression | **PASS locally** | Full 369 backend / 181 mobile / 6 browser results; types/lint/build/format evidence |
| Independent review, confirmed fixes, additive schema and recovery | **PASS locally** | Five RED→GREEN fixes, NUMERIC migration, final restricted-role dump/restore |
| Complete E2E-05/06/07, RTL/large-text/accessibility across real app/platforms | **BLOCKED** | Only component/API and limited synthetic iOS preview evidence; full journeys not executed |
| Hosted CI/staging and physical-device acceptance, carried prior gates | **BLOCKED** | No supporting hosted/device/provider-quality verification; explicitly carried |
| P04 overall completion / production readiness | **BLOCKED — NOT COMPLETE** | Required verification remains open; default-off flags retained |

## 9. Local commits and review boundary

| Commit | Logical unit |
|---|---|
| `d412e6d` | P04-A private recents/favorites over snapshots |
| `f94467c` | P04-B Quick Add/cache/common confirmation |
| `53ebcdb` | P04-C atomic versioned recipes/duplicate receipts |
| `7dcb7eb` | P04-D recipe editor, management and serving review |
| `0bb5262` | P04-E reviewed atomic copy, DST and durable receipts |
| `cbc2f8c` | Independent-review fixes: precision, original portions, NUMERIC yield, reload reconciliation |
| `35c3669` | Native QA nutrient-caption wrapping |

The following documentation commit archives this checkpoint/evidence and updates only progress overlays; `git log` records its hash. No PR was published. Keep the attached worktree/branch for review; original checkout and pre-existing dependency symlinks are preserved.

## 10. Decisions, next phase and stop

Ordered decisions, costs if wrong and deferred minors are recorded verbatim in [progress.md](evidence/p04/progress.md). They include snapshot-derived legacy nutrition, retained recipe history, visible atomic-copy/storage bounds, and carrying every unsupported external/native/provenance/photo assertion rather than closing it.

**Next phase would be P05; prerequisites are not fully verified. P05 remains unopened.** Stop here for explicit user review/approval. P04 local code is committed, testable and recoverable; the open acceptance gates above prevent a claim of complete or production-ready delivery.
