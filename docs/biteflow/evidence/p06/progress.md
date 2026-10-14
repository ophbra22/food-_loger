# SDD ledger — plan: docs/biteflow/roadmap.md
P06 ONLY; base 1167851, branch codex/biteflow-p06. Retain attached worktree. User approved P05 with open gates. No real AI, production, push, merge, deploy or P07.
Ruling: Execute approved P06-A/B/C/D as recorded task units rather than numbered helper syntax — preserve the existing roadmap — cost if wrong: manual bookkeeping.
Pre-flight: A supplies attributed versioned source candidates; B binds household conversions to selected food/version; C supplies uncertain label fields; D stores only owner-confirmed products and bounded owner fingerprints. All feed the existing canonical confirmation/writer. No global user publication or universal density.
Task 1: P06-A in progress: inspect existing USDA/OFF, source licensing and dry-run adapters.
Task 2: P06-B pending.
Task 3: P06-C pending.
Task 4: P06-D pending.

Ruling: Use the approved USDA/OFF/private-food fallback after the official Ministry CSV returned 403 — metadata and license are documented but no rows were obtainable — cost if wrong: repeat source integration after access is restored.
Ruling: Keep automatic label OCR default-off behind the existing budgeted gateway — physical Hebrew OCR quality is unverified — cost if wrong: an additional device evaluation before enablement.

Task 1: complete (71c3c16; p06-a-green3: 43 passed; actual USDA dry-run: 13,225 valid records, no write).
Task 2: local implementation green (17 API/domain + 2 mobile domain + 4 UI tests; types passed); PostgreSQL/final regressions pending.

Task 2: complete locally; 27 version-bound facts; p06-mobile-candidate 221/46, postgres-p06-candidate 437 passed/9 skips.
Task 3: complete locally with mocked OCR; p06-basis-green 18 passed; native Hebrew quality and real package dataset BLOCKED.
Task 4: complete locally; PostgreSQL owner/race/down/up checks pass in full suite; full device journeys BLOCKED.

Final review: fresh gpt-6-astra/high, immutable 1167851..e569e50. Five Important findings accepted by user impact; no Critical. One fix pass: private-save edit race, private source identity, English nutrient headings, equivalent-unit conflicts, OCR-returned exact barcode integration.
Final: minor (deferred): Translate raw English household serving labels and confidence codes for Hebrew display; retain original labels as provenance.
Final: Ruling: Actual Hebrew camera OCR accuracy/correction metrics remain BLOCKED — no held-out package images or device evidence exists — cost if wrong: more dataset/device evaluation before enablement.
Final: Ruling: Live quota, billing and throughput remain external enablement gates — mocked tests cannot establish account policy or operational capacity — cost if wrong: revised budgets/provider configuration before live use.
Final: Ruling: Hosted migrations, restore and role deployment remain unverified — local PostgreSQL evidence is separate from prohibited hosted operations — cost if wrong: additional staging migration/restore work.
Final: Ruling: Physical-device permissions, navigation, RTL and accessibility acceptance remain unverified — local component tests and exports are insufficient — cost if wrong: native interaction fixes after device evaluation.
Final: Ruling: Basis-switch provenance and other P01–P05 gates remain open — they predate and are outside this P06 diff — cost if wrong: earlier-phase follow-up before release.

Final: fixed private-save stale edits — PrivateProductReview delayed response test RED→GREEN (corrected harness), update version retained; full suite 226/226 mobile.
Final: fixed private provider/reference pairing — label-input private source test RED→GREEN, immutable upstream source retained; full suite 226/226 mobile.
Final: fixed ordinary English label headings — test_common_english_label_headings_match_whole_names RED→GREEN; full backend 439 passed/9 skips.
Final: fixed equivalent-unit label conflicts — test_equivalent_label_units_conflict_is_visible_without_overwriting_printed_values RED→GREEN; full backend 439 passed/9 skips.
Final: fixed OCR-returned barcode integration — LabelEntry exact lookup/fallback/cancel tests RED→GREEN; full mobile 226/226.
Final fix commit: 12f984f. Tests: postgres-p06-final2 439 passed/9 skips; p06-mobile-final2 226/47; browser-p06-final 6 passed; final types/lint/Ruff/format/package/iOS+Android Hermes exports PASS. No live AI, production, push, merge, deploy or P07.
Final environment note: first post-review PG run failed because the successful restore drill retained shared-role dependencies in the owned second database. Dropped only biteflow_p06_restore_test; rerun passed. This was a disposable fixture conflict, not a hidden passing result.
Finish: user already required local-only work; retain codex/biteflow-p06/worktree rather than offer a merge/push menu. Archive evidence before deleting only this plan scratch. Full P06 acceptance BLOCKED.
