# Independent P06 review and disposition

Fresh-context `gpt-6-astra`, high reasoning, reviewed immutable `1167851..e569e509f6bc6aca5a0e35a926ac910003f4460f`. No child reviewers, database tests, provider calls or checkout edits. Reviewer independently executed scrubbed-environment Python parser reproductions and a read-only TypeScript provenance reproduction. Full suites below are implementer-run evidence, not independent reviewer reruns. Verdict: **With fixes**. No Critical findings. One fix pass; no second review.

## Important findings — all accepted by user impact

1. `PrivateProductSave.tsx` / `MealAnalysisReview.tsx`: delayed private save overwrote intervening edits with captured analysis and restored old confirmation. Fix: shared private-save busy state locks editors, additions/removals, time/category, discard and journal save until success/failure. `PrivateProductReview.test.tsx` exercises deferred response, blocked correction/logging, subsequent edits and versioned update. Initial test setup raced hydration and then attempted a nonexistent host event prop; corrected harness **fails against pre-fix product code** (`p06-private-race-red2`) and passes after the fix.
2. `unified-review.ts`: saving a selected USDA food privately serialized private provider with USDA reference ID/version. Fix: private origin identity wins serialization; selected USDA reference remains available for version-bound conversions, and the first immutable private version retains the original source snapshot. `label-input.test.ts` covers original USDA and private versions 1/2; component test covers subsequent expected-version update. RED/GREEN retained.
3. `label_input.py`: prefix matching parsed “Carbohydrates 40 g” as an invalid `s` value and missed common plural/total headings. Fix: explicit normal headings, longest-first and boundary-aware matching; unsupported terms remain unknown. Realistic English regression alongside Hebrew fixture. RED/GREEN retained.
4. `label_input.py`: contradictory kcal/kJ and sodium/salt observations produced no warning. Fix: preserve printed kcal/sodium, compare equivalent values and show localized conflict warnings before confirmation. Rounding tolerance per normalized 100 g/ml is the larger of 5% or 2 kcal / 0.02 g sodium. Conflicting and normally rounded pairs tested RED/GREEN. No recalculation silently replaces printed kcal.
5. `LabelEntry.tsx`: barcode returned by OCR skipped exact-product lookup. Fix: resolve returned barcode before review, use the attributed exact product when available, otherwise retain extracted label for an explicit fallback choice. Session/generation guards prevent cancelled lookup from opening review. Mocked extraction/exact lookup/failure/cancel tests run; no real API/provider traffic.

## Minor — deferred

`ServingSelector.tsx` renders raw English source serving labels and confidence codes in Hebrew mode. Translate display labels while preserving original source labels in provenance. This remains a visible localization limitation, not a completed bilingual device acceptance gate.

## Declined judgments and implementer disposition

- Actual Hebrew camera OCR/correction quality: remains BLOCKED, no held-out image/device evidence.
- Live quota/billing/throughput: retained as external enablement gates; mocked tests cannot close them.
- Hosted migration/restore/roles: remains unverified; disposable local PostgreSQL does not prove hosted behavior.
- Physical-device permission/navigation/RTL/accessibility: remains unverified.
- Existing basis-switch provenance and other P01–P05 gates: explicitly carried, outside this P06 diff.

Every declined judgment has a ruling and cost in the archived ledger. Full regression after the fix pass and exact commit identities are in the checkpoint/evidence index.
