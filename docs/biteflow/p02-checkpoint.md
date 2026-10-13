# P02 checkpoint — 2026-10-13

**Phase:** P02 only — unified confirmation and photo hardening. **Status: IMPLEMENTED, UNVERIFIED** (local code/test evidence below; full device, staging and photo-quality gates remain open). **P03 has not started.** No production operations, remote migrations, live AI calls, deploys, pushes or merges were performed. Provider calls in tests were mocked; the isolated UI server kept AI disabled.

User approved P01 as the entry checkpoint. Work continued on `codex/biteflow-p02` in the existing attached isolated worktree, from `e961375`; P01 branch remains available. Changes are small local review units, **not published GitHub PRs**:

| Unit | Commit | Result |
|---|---|---|
| P02-A storage boundary | `5118020` | Explicit SQLite backup/rebuild and PostgreSQL v2 migration; nullable core nutrients and inclusive 0.0001–2000 g/ml; versioned day reads |
| P02-A adapters/save | `4a978e6` | Shared adapters, one canonical save facade/request identity, runtime validation, exact previews and nullable journal cache |
| P02-B shared editor | `8bc0b7a` | Existing `/add/review` hosts common editable item list for enabled catalog/manual/barcode/photo inputs; rollback/uncertain-legacy fallback |
| P02-C/D reliability | `7d1431c` | Honest offline photo protocol, cancel support and identical prepared second-angle deduplication |
| Review fixes | `b9672d0` | Full-precision label parsing/metadata, body-phase cancellation, offline editing, confirmed consumption-time display and exact lower bound |

## Feature scope and actual behavior

Primarily F20 and shared food-input/confirmation foundations; F10 nutrition precision and F14 quota regression coverage, with a narrow F01 existing DayDial compatibility change. No P03 goal/dashboard implementation.

- All enabled input methods adapt to the same canonical payload and editable multi-item confirmation. Users can add/remove/rename, edit quantity and g/ml basis, reference/manual values including optional nutrients, inspect confidence/questions/provenance, choose journal date/category and optionally supply a validated timestamp/zone. Barcode serving/brand/raw metadata remain available. Nothing is written to the journal before explicit save/confirmation.
- Exact intermediate calculations preserve tiny portions and explicit unknowns. Shared fixtures/adapters cover equivalent catalog/manual/label inputs; photo tests cover three items with an ambiguous component. Stored historical rows/totals are not recalculated.
- Canonical writes use persisted stable request identity; lost response retries do not regenerate it. Attempted legacy drafts retain their prior endpoint/body identity. Failed capability lookup allows local legacy editing; the canonical save path still checks current server capabilities before dispatch.
- **Partial/tiny compatibility gate resolved locally:** actual SQLite and restricted-role PostgreSQL saves/read/replay/delete tests pass. V2 daily totals expose NULL plus known subtotal/partial flags. V1 clients receive **409 Upgrade required** for affected days; complete legacy days/flows keep their existing response. CSV unknowns are blank. No fabricated zero or hidden partial row. Fresh SQLite files are v2; existing files require an explicit offline migration. Flags remain off by default.
- The consumption time now appears in canonical day-row metadata and the existing meal row/dial; unknown canonical consumption time is not inferred from save time. No goals or new dashboard features.
- Cancellation aborts the client request through response-body consumption and discards stale results; an already-consumed provider attempt is not refunded. The pipeline removes an identical prepared second image; distinct angles still share one analysis. Existing provider prompt/model/reference matching remain unchanged.

## Paths and migration review

Backend: `src/foodlogger/{partial_migration,database,storage,domain,meal_service,app,meal_analysis}.py`; migration `supabase/migrations/20261013191213_p02_partial_nutrition.sql`.

Mobile: `mobile/src/domain/{unified-review,canonical,exact,meal-analysis,drafts,validation,dial,nutrition}.ts`; `api/{client,endpoints,response-validation,types,errors,messages}.ts`; `data/{save-draft,journal-store}.ts`; `storage/validation.ts`; `app/(app)/add/{review,photo}.tsx`; `components/{MealAnalysisReview,MealFoodEditor,LegacyMealReview,MealRow}.tsx`; i18n files and focused tests.

See [migration/rollback operations](p02-operations.md), [photo gate](p02-photo-gate.md), [independent review](evidence/p02/review.md), and [ordered execution ledger](evidence/p02/progress.md).

## Actual validation

All commands ran locally with production/provider environment variables removed, loopback test API configured, and outbound real HTTP transports blocked by the backend test fixture. Exact commands, working directories, exit codes and elapsed times are in [commands.jsonl](evidence/p02/commands.jsonl); full logs include initial failures and corrections.

| Command / evidence | Actual result |
|---|---|
| `.venv/bin/pytest -q` with disposable `FOODLOGGER_TEST_DATABASE_URL` (`postgres-final`) | **325 passed, 9 skipped**; includes 14 real PostgreSQL tests |
| `.venv/bin/pytest -q tests/test_browser.py`, browser opt-in (`browser-final`) | **6 passed**, Playwright against disposable local backend |
| `npm test -- --runInBand` (`final-mobile`) | **140 passed**, 24 suites |
| `npm run typecheck`; `npm run lint` | Passed; final lint zero warnings |
| `.venv/bin/ruff check src tests`; `git diff --check` | Passed |
| `python -m build` (`package-review-final`) | Wheel and sdist built |
| `expo export --platform ios --platform android` (`export-final`) | Both Hermes/JS bundles exported; **not native binary builds** |
| SQLite migration/restore tests | Preserved existing rows/receipts/indexes/owner trigger, foreign keys valid, backup readable; no existing real file touched |
| Disposable PostgreSQL dump/restore (`restore-postgres`) | Schema v2, exact 0.1 g/NULL nutrient row and receipt restored |
| Offline fixture verification/preparation | **8/8 existing manifest hashes passed**; image preparation only; [raw results](evidence/p02/photo-fixtures.json) |

Nine skips in the combined suite are the six opt-in browser tests (run separately), two unavailable local Lite-runtime checks and one opt-in ML integration test. The restore rehearsal temporarily caused 14 PostgreSQL setup errors because its second database depended on the shared test role; removing only that disposable restore database resolved the fixture conflict. The final full suite passed without a product workaround.

Independent review found five Important issues, all reproduced RED then fixed GREEN in one pass. The entered-time expectation and an inclusive Decimal minimum were also reproduced/fixed. No Critical findings. See the review/ledger for exact failures; two minor items remain deferred.

## Security/privacy and native evidence

Owner isolation, cross-user mutation/retry protection, durable receipts/tombstones, session races, private roles/RLS/grants and provider quota reserve tests remain green. Migrations do not broaden grants/RLS. Photos remain transient and drafts contain no image bytes/URIs. Normalized raw label metadata is preserved as source data; it is not trusted authorization.

An isolated iOS 26.5 simulator ran the current branch's JS in an existing SDK57 development binary and displayed the local test server's sign-in screen. [Screenshot](evidence/p02/ios-startup-only.jpg) proves startup only. Input automation did not reliably focus/type fixture credentials (it triggered the developer menu/reloads), so **confirmation screenshots, HE/EN/large-text native review and photo/gallery-to-save E2E are not verified**. No new signed/native binary was built. A read-only Android emulator booted, but installing the existing local debug APK failed with insufficient internal storage. No other emulator/app data was erased to work around it. Test simulators/container/servers were stopped and the newly created iOS simulator deleted after testing.

## Defects, blockers and next gate

1. **Recognition-quality acceptance BLOCKED:** user requires mocked AI; no live precision/recall, per-item portion error, kcal MAE, calibrated coverage, provider latency/tokens/cost, allowance or billing was measured. Existing historical reports are not new evidence. Need independently adjudicated held-out data, finalized protocol, verified allowance and separate authorization before live evaluation.
2. **Device acceptance open:** restore reliable iOS UI automation and sufficient storage for a disposable Android installation; run current HE/EN/large-text confirmation and real photo/gallery → edit → confirm → save/retry flows. E2E-01/18/20 are covered only within the described mocked/domain/browser scope, not declared fully passed on devices.
3. **Staging acceptance open:** independent non-production database/roles, migration/backup rehearsal and hosted CI were not exercised. No production activation is authorized.
4. Deferred minor: basis reinterpretation clears confirmation but does not mark `manualOverride`/retain original basis in correction provenance. Deferred minor: evaluation proposal still needs frozen matching/adjudication/aggregation/model IDs, uncertainty and stopping rules, and a larger held-out no-food cohort.

**Rollback:** disable canonical writer flags; keep v2 readers/storage and all receipts/snapshots. Preserve attempted drafts. P01 PostgreSQL servers reject core schema 2; stop old workers before migration. Do not narrow nullable/tiny constraints or restore an old backup over newer writes. Detailed offline steps and limitations are in p02-operations.md.

**Next:** review this checkpoint and the remaining gates. P03 remains unopened; completing or explicitly revising these gates requires the user's next instruction. This report does not claim VERIFIED IN STAGING or full photo-quality completion.
