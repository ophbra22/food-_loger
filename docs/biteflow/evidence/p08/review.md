# Independent P08 review and author disposition

Fresh-context reviewer: gpt-6-astra high; read-only immutable `55f6409d93f7f2bd10ad365652205ad3301aa93c..146ee99e32e569614646e9038b077b692a53976d`. Reviewer inspected requirements, complete candidate and local code/probes. No implementation/index/HEAD changes, hosted operations or live AI. One independent review, no second review or claimed independent reapproval after fixes.

Strengths: exact Trends reuse; restrictions before ranking; canonical source provenance; bounded approved AI variants; consistent owner predicates/locks, additive private schema and default-off flags.

## Findings

| Grade | Candidate location | Confirmed user effect | Disposition / actual regression |
|---|---|---|---|
| Important | `src/foodlogger/recommendations.py:226,296` | Initial version0 or reused version after privacy clear could resurrect sensitive review data | Require monotonic preference revision on every source-review write under owner lock; no new schema required. `test_privacy_clear_fences_stale_source_review_writes[False/True]`: two RED failures returning200, then GREEN409 with no resurrected allergens. |
| Important | `mobile/src/domain/advice.ts:46` | Legitimate negative remaining calories/protein/carbs/fat rejected as server error | Signed finite/null remaining validation, keep nonnegative nutrient/portion checks. Four `exceeded ... target` regressions RED→GREEN. Shared mutable test fixture was isolated; an explicit temporary old-validator run reconfirmed four targeted RED failures before restoration and GREEN. |
| Important | `mobile/src/components/AdviceScreen.tsx:22` | A foregrounded old choice could bypass newly added allergy, revoked review, source/goal change | Deterministic authenticated API re-read at tap; refuse changed revision/missing candidate, refresh; only current authoritative choice becomes draft. Four external-change handoff cases RED→GREEN. |
| Important | `mobile/src/components/AdviceScreen.tsx:21` | Starting a recommendation overwrote an existing edited/uncertain draft and retry identity | Preserve current draft and offer resume; block during save/loading; recheck draft after awaited revalidation. Edited/attempted/saving/loading and intervening-draft cases RED→GREEN. |
| Minor | `mobile/src/components/FoodRestrictions.tsx:31` | App resume does not reread preferences; another-device changes can remain visible until focus/manual refresh | Deferred. CAS prevents stale writes, new authoritative selection prevents using stale restrictions. Manual Refresh remains available. |

No Critical findings. All four Important findings fixed in one pass; full suite results recorded in checkpoint/evidence. No re-review dispatched.

## Declined to judge and retained rulings

1. Physical-device navigation, accessibility, RTL and complete native E2E: no device evidence. Remains BLOCKED; previews do not close it. Cost if wrong: device usability/privacy failures.
2. Native compilation: reviewer did not independently observe completion. Executor's iOS unsigned simulator build passed; Android fails missing Java. Cost if wrong: platform packaging failure; release parity blocked.
3. Hosted PG roles/migrations/backup/restore/client rollout: excluded authorization; local PG16 is separate. Cost if wrong: hosted permission/migration/reconciliation failure; release blocked.
4. Real provider quotas, billing, policy/model behavior: only mocked/offline verified. Cost if wrong: provider failure/unexpected costs; enabling AI blocked.
5. Ingredient/allergen completeness/cross-contact: supplied user reviews cannot prove facts. No safety certification; original-label checks/release validation remain. Cost if wrong: unsuitable suggestions from inaccurate assertions.
6. Unchanged P01–P07 gates and P09 functionality: carried/excluded, never silently closed. Cost if wrong: outstanding release work and unavailable later features.

All rulings and deferred minor are also preserved in `ledger.md` and final handoff.
