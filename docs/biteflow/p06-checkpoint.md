# P06 checkpoint — 2026-10-14

**Scope: P06 only (F09/F10/F11). Local implementation and one independent review/fix pass are finished; full acceptance is BLOCKED. P06 is not claimed complete or production-ready.** P07 is not started. Real Hebrew camera OCR, held-out package images, physical-device journeys and hosted gates are unverified. No real AI calls, production operations, push, merge or deployment.

The approved P00–P05 checkpoints, specification and P06 roadmap were reviewed. Work reuses `/Users/braude/.codex/worktrees/biteflow-p01/food-_loger`, branch `codex/biteflow-p06`, base `1167851`. Original checkout product files remain unchanged.

## Implemented

- **Sources:** attributed/versioned USDA candidates, regional Hebrew aliases, composite-food ambiguity, distinct record/source display, exact barcode preference, source-outage status. OFF keeps its existing bounded lookup and gains Hebrew name/version metadata. USDA import now requires explicit output or a validation-only dry-run. The actual 13,225-record dry-run passed without writing. The Ministry dataset exists and its terms are documented, but CSV download returned 403; approved USDA/OFF/private-product fallback used. See [source evidence](p06-sources.md).
- **Household measures:** 27 pinned USDA facts/explicit US spoon derivations for seven selected foods, source/version-specific lookup, evidence/confidence, original quantity/unit saved with canonical normalized g/ml. Small/large pita half portions are 14/30 g; tahini tablespoon 15 g versus selected cooked rice 9.875 g. Unknown conversions/density require weighed input. Shared review supports deliberate unit/quantity application and invalidates confirmation; replacing a food clears incompatible conversions. Label serving shortcut retains its original unit.
- **Labels:** editable bilingual transcription, optional default-off gateway OCR, user crop/EXIF orientation and bounded JPEG input. Strict observations retain printed columns/units/field evidence/confidence. Correct per-100/per-serving, g/ml, kcal/kJ, sodium/salt normalization; missing/unreadable/out-of-range values stay null. Conflicting columns remain flagged. No guessed serving mass, barcode or nutrition. Exact barcode reuse and label input reach the existing review/save flow.
- **Private products:** explicit confirmation, owner-scoped immutable versions, optimistic update checks, stable retry identities, list/search/reuse/delete. Reuse asks for a new eaten amount and confirmation. Owner-only label fingerprint cache (bounded size/count/TTL), account deletion cascades, no global publication or image storage.

## Architecture and changed components

New server modules: `food_providers.py`, `servings.py`, `label_input.py`, `private_products.py`; routes/settings and optional provenance fields extend existing contracts. Existing canonical nutrition engine/writer, shared editor, auth, gateway, owner locks, idempotency and journal/DayDial remain authoritative. `GeminiText` exposes its response model for bounded transport reuse by label extraction.

New mobile routes: `add/label.tsx`, `add/private-products.tsx`; `LabelEntry`, `ServingSelector`, `PrivateProductSave`; domain validators and API methods. Label is an existing server input-method value added to mobile drafts/resume validation. Two additive migrations add five private-schema tables. No native dependency or native source change. See [operations/rollback](p06-operations.md) and [down SQL](rollback-p06.sql).

## Actual final verification

| Command | Actual result |
|---|---|
| `.venv/bin/pytest -q -rs` with owned disposable PostgreSQL | **439 passed, 9 skipped** (`postgres-p06-final2`; after review fixes and disposable restore-database cleanup) |
| `npm test -- --runInBand` in mobile | **226 passed / 47 suites** (`p06-mobile-final2`) |
| `.venv/bin/pytest -m browser -q` with browser flag | **6 passed**; existing browser journeys, not full native label E2E |
| `npm run typecheck`; `npm run lint` | **PASS**, zero current lint warnings |
| `.venv/bin/ruff check src tests scripts`; `ruff format --check` | **PASS** |
| `.venv/bin/python -m build --no-isolation ...` | Wheel and sdist **PASS**, new data assets included |
| `npx --no-install expo export --platform ios --platform android ...` | Both Hermes JS bundles **PASS**; not native compilation/device proof |
| USDA importer `--dry-run` against actual local archives | **13,225 valid**, zero errors; checksum in log; no output write |
| `pg_dump -Fc` then `pg_restore --exit-on-error` into separate owned test database | **PASS**, two immutable versions and owner cache isolation |
| macOS Swift Vision language probe | Ran successfully; revision 3, Hebrew not listed; not an iOS quality test |

Tests cover mocked OCR success/429/timeout/malformed/oversize/duplicate request, no pre-confirmation meal, EXIF orientation, same-image owner cache, private isolation/version races, rollback and existing journal preservation. One actual Israeli product **retailer table transcription** has seven expected fields tested; it is not a camera OCR dataset. OCR precision/recall/correction rate are **not measured**. Existing P01–P05 tests are included in full suites. The nine full-suite skips are six opt-in browser tests (run separately: six passed), two LiteRT smoke tests and one ML smoke test. No model weights/inference claim is made. No new native compile was run: P06 has no native source/dependency change; JS export does not close the Android Java or device gates.

Observed failures were retained in logs: an initial PostgreSQL run raced server startup; subsequent readiness-confirmed tests passed. New optional provenance fields initially added null keys to old label snapshots; the serializer now omits absent fields, restoring exact prior round trips. A regression test showed nutrient text could be mistaken for a quantity header; parsing now requires explicit whole-cell basis declarations. Intermediate import/type/lint errors were fixed; generated route types required an offline Metro start. A post-review backend run produced 417 passes/22 setup errors because the restored test database retained the shared `foodlogger_app` role. Dropping only that owned restore database resolved setup; the final full run succeeded. Review test harnesses also required hydration/deferred-event corrections; the corrected race test was rerun against the pre-fix code and failed at the intended editable-state assertion. Intermediate type/lint failures were fixed and are preserved in logs. Test counts above are actual successful runs, not inferred.

## Independent review

A fresh reviewer inspected `1167851..e569e50`, independently reproduced parser/source bugs, and found **five Important issues, no Critical, and one deferred minor**. All five Important findings were accepted and addressed in one fix pass with failing-then-passing regression tests:

1. Delayed private saves could restore stale confirmed values over edits. A shared busy state now blocks editing and journal save until private save settles; deferred-response test also verifies subsequent edits and version updates.
2. A private product created from USDA could serialize its private provider with the USDA ID/version. Private identity now wins; selected USDA evidence remains available for conversions and the original immutable private snapshot retains upstream attribution.
3. Normal English headings such as “Carbohydrates” failed prefix parsing. Explicit plural/total aliases and complete heading boundaries fix this; unsupported terms remain unknown.
4. Contradictory kcal/kJ or sodium/salt were silent. Material disagreements now display localized warnings without replacing printed kcal/sodium; ordinary rounding is tolerated and tested.
5. OCR-returned barcodes skipped exact lookup. Mocked integration now resolves the exact attributed product before review, requires an explicit retained-label fallback on failure, and rejects late results after cancellation.

**Deferred minor:** household serving labels and confidence codes still display raw English source text in Hebrew mode. It remains a localization limitation. The complete review, decisions and RED/GREEN evidence are in [review.md](evidence/p06/review.md) and [ledger](evidence/p06/progress.md).

## Acceptance and carried gates

| Criterion | Status and evidence |
|---|---|
| Lawful source conclusion, actual dry-run/version/attribution, no fabricated official data | **PASS locally**; Ministry CSV access **BLOCKED**; explicit fallback allowed by roadmap |
| Regional aliases, exact barcode preference, private/generic disambiguation and source failure | **PASS locally** in source/OFF tests; broad Israeli coverage remains partial |
| Food/version measures, half-pita, different spoon weights, missing density clarification, original snapshot | **PASS for implemented local records and unit/domain/UI tests**; device usability and broader evidence-backed measures unverified |
| Label schema/bases/nutrients/uncertain evidence/manual correction and shared confirmation | **PASS locally with mocked extraction and transcription fixture** |
| Automatic Hebrew OCR quality on actual Israeli package images; field/correction metrics | **BLOCKED**; no actual package-image held-out dataset or device capture; default-off |
| Private persistence, ownership, retry/version concurrency, cache isolation, no global publication | **PASS locally**, SQLite and PostgreSQL; strict physical cache erasure scheduling remains an operational item |
| Migrations/down/up preserve existing journal | **PASS locally** on owned disposable PostgreSQL; hosted staging/backup validation **BLOCKED** |
| Full E2E-08/09/18/19 native routes, permissions, RTL/accessibility | **BLOCKED**; domain/component/API/browser tests do not establish complete physical-device journeys |
| Independent critical review and confirmed fixes | **PASS locally**; five Important fixes, one deferred minor; final full regressions green |

Carry forward **all** P01–P05 open gates: real provider quotas/tier/reset/policy and paid-fallback verification; hosted CI/staging/roles/backups; physical-device/native E2E and accessibility; exact 10% macro warning boundary; explicit basis-correction provenance; photo protocol and held-out dataset; Hebrew/English device speech and privacy evidence (voice default-off); Android native compile blocked by missing Java; native patch maintenance; dependency audit baseline/current 67 advisories (17 moderate/50 high), not closed by P06. No live provider or production claim is made.

## Git and rollback

Local branch `codex/biteflow-p06`, based on `1167851`; no push, merge or deployment. Logical implementation commits:

- `71c3c16` — source attribution, aliases and explicit offline importer validation.
- `c013f3c` — food/version-bound household conversions and shared editor.
- `c8603da` — label normalization, bounded mocked-gateway adapter, private product/version/cache persistence.
- `e569e50` — label entry/review and private product mobile reuse.
- `12f984f` — five review fixes and covering regressions.

The final documentation commit archives this report/evidence. See [changed paths](evidence/p06/changed-files.txt) for the complete component/file list and [operations](p06-operations.md) for flags, migrations and rollback. Keep additive tables for the safest code rollback; destructive down SQL requires an approved backup/export. Local down/up and backup/restore passed; hosted recovery remains unverified.

## Blockers and residual risks

Full P06 acceptance is **BLOCKED**, primarily because required actual Hebrew package-image OCR and field/correction metrics were not verified. No suitable held-out image dataset exists here. One retailer transcription establishes parsing facts only. Ministry CSV access returned 403; the explicitly approved fallback is implemented, not an official imported catalog. Native E2E-08/09/18/19, device permissions/RTL/accessibility, hosted CI/staging and all carried gates need separate evidence. Expired label cache rows are unreadable after seven days but are physically pruned on next owner write/account deletion; scheduled strict erasure remains an operational release item. Translations noted above remain a deferred minor.

Stop at this checkpoint. P07 requires explicit user review/approval.
