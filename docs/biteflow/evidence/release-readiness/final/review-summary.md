# Independent final review and one fix pass

Reviewed immutable range: `e7f7c9deaae32d600ec4499018451f9cc0612229..a00943ec51005ea53f3bf06b67330aa2254d53fa`. Fresh-context reviewer: `rc00_05_final_review` (gpt-6-astra, high), read-only. This is the executor's structured transcription of the returned findings, not an assertion that post-review documents were independently reviewed.

Critical:0. Important:1. Minor:0. Verdict: with fixes; not release-ready.

## Important finding, accepted and fixed

Known-group reload used the original date's group list. If another device moved the meal to a different day, conflict→discard/reload searched the old day, failed notFound, and never issued GET for the stable group ID. Same risk after lost-reply move plus a subsequent concurrent edit. Reviewer reproduced it in `review-final-moved-reload.log`.

Fix `5455c49`: explicit `kind=group` on rejected-edit reload; route and loader fetch known group directly. Ordinary component navigation still resolves through the day list. No ID-shape guessing, stale fallback, new backend API or POST. Tests cover moved-group latest version/day, real route wiring, discard navigation and deleted-group failure. Targeted RED5/12, final GREEN12/12, whole mobile458/458 (91 suites). Two English button labels in the new tests were corrected to the actual existing labels; early RED included those harness mismatches. Separate reviewer reproduction and loader/route failures establish the product defect independently. Backend664/9skip plus browser6pass; types/lint pass. No second review loop.

## Declined to judge; gates retained

1. Physical Health/widget, permissions, storage loss, cached pixels, lock/reboot and mobile OS erasure: RC13–14/18–19 device evidence.
2. Mixed-version deployment, older-client writes and operational downgrade: RC16/19. Capabilities alone cannot prove safety.
3. Real AI quality, retries, budget and held-out data: RC09–11/17/21, outside the mocked wave.
4. Retention, large-export support, production signing/staging/release/telemetry: outside RC00–05 and still gated.
5. Pending final builds, unresolved advisories and upstream full-lint failure: actual results must remain distinct; RC02 stays BLOCKED.
6. Documents/evidence after the reviewed head: executor must verify manifests and consistency; they are not part of the independent reviewed range.

Each item is an explicit ruling in the archived execution ledger. No inherited risk was waived. Local review does not approve release or rollback on a real device.
