# Independent P05 review and disposition

Reviewer: fresh-context `gpt-6-astra`, `/root/p05_final_review`, read-only range `3e96392..d941e5a`. No subagents, edits or real provider/network/production operations. Parent made one TDD fix pass in `18c84a2`; no second review is asserted.

## Reviewer assessment

Strengths: existing confirmation/canonical save reused; unknown quantities and sources explicit; opt-in one-attempt budgeted AI; default-off guarded on-device speech and lifecycle cleanup; checksum validation before any vendor write; honest device limitations.

**No Critical or Minor findings. Five Important findings:**

1. **P1 Numeric normalization changed quantities** — `text_input.py` segments stripped the leading dot (`.5g`→5g); Unicode replacement concatenated a whole number (`1½ g`→10.5g). Correct amounts must survive normalization.
2. **P1 Token bound / policy race** — text checked a policy snapshot before `reserve()` read its locked policy. MockTransport reproduction lowered max input and TPM to 1 just before reserve; a 979-byte payload was dispatched with 1 reserved token. Bound must be checked atomically.
3. **P2 Resume route discarded the usable entry flow** — Home/Add sent unfinished descriptions to `/add/review`, which converted an empty manual shell into a blank food. Text remained stored but was neither visible nor parsed. Unparsed text/voice must resume entry; parsed drafts keep shared review.
4. **P2 Generated recurring quantities were unsaveable** — `1/3 kg chicken` produced a 28-digit decimal string accepted by the proposal validator but rejected by keyboard precision validation; null totals and confirmation disabled. Use validated canonical precision through persistence/review.
5. **P2 Hebrew attached numeric conjunction merged foods** — `200 גרם עוף ו100 גרם אורז` became one 200g food named `עוף ו100 גרם אורז`. Split before supported numeric prefixes.

Reviewer verification used source/diff inspection, pure Python/TypeScript execution and temporary SQLite + MockTransport; no full suite independently rerun. Verdict: **with fixes for local P05 checkpoint; full acceptance blocked**.

## One fix pass, all accepted as Important

| Finding | Reproduction / green evidence | Fix |
|---|---|---|
| 1 | `review-backend-red.log` → `review-backend-green2.log`; leading decimal and Unicode mixed cases | Expand mixed fractions arithmetically before NFKC; preserve decimal punctuation; allow leading decimal numeric grammar |
| 2 | Same logs; `test_review_policy_shrink_before_reservation_never_dispatches` | Optional `required_input_tokens` bound is validated under `reserve()`'s existing policy transaction/lock. Existing callers retain compatibility. Dispatch still revalidates policy hash |
| 3 | `review-mobile-red.log` → `review-mobile-green2.log`, real Home/Add/Review components | `resumeDraftPath`; redirect unparsed descriptions before canonical upgrade; parsed reviews retained |
| 4 | Same mobile logs; persisted recurring quantity, totals, confirmation and actual canonical payload | Normalize generated amount to the canonical numeric representation and preserve validated original metric portion. Keyboard precision policy unchanged |
| 5 | Backend RED/GREEN logs, named Hebrew quantity test | Recognize attached conjunction before digits/decimal numeric prefixes; retain each item's amount |

During these fixes, two related gaps were also reproduced: kg/l original quantities were mislabeled g/ml (`review-units-red.log`), and choosing a different source erased the generated metric-portion precision (`review-fraction-source-red2.log`). Both fixed and covered by final suites. Food-specific household conversions are still cleared when replacing sources; no P06 density/conversion was added. A first source-choice regression used the wrong helper name; corrected before the behavioral RED was recorded. A missing `estimated` field in an intermediate fix was caught by persisted draft validation and corrected.

Final suites: **395 backend passed, 9 documented skips; 212 mobile passed in 41 suites; 6 browser passed**. Types, lint (zero warnings), Ruff/format, Python package and both Hermes exports passed. Native module/config did not change during the review fix pass; its final regenerated iOS compile evidence predates only the Python/JS review fixes.

## Declined to judge — reviewer list, executor rulings retained

- Physical-device HE/EN accuracy/correction rates, microphone routing/interruption, accessibility and network privacy need device evidence; remain blocked/default-off.
- Final regenerated iOS build was ongoing for reviewer; executor subsequently observed compile success. Android still lacks Java; no Android compile success.
- Actual provider allowances/configuration/behavior were prohibited from live verification; remain mocked/unverified.
- Household density/mass conversions and expanded Israeli coverage belong to P06; unresolved is correct.
- Earlier P00–P04 acceptance/release gates were not reopened/certified by this review; remain carried.
- Existing dependency vulnerability remediation is outside this patch; 67-advisory audit remains a release risk.

Every executor ruling and cost is recorded in `progress.md`. No newly deferred Minor finding; earlier exact-10% and basis-correction issues remain visible.
