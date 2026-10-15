# P08 local operations and rollback

This is a development checkpoint, not authorization to enable hosted features. All feature flags default off. P09 is excluded.

## Architecture and contracts

`Insights` reads the existing atomic `Trends.snapshot` and returns the identical Trends document. Summary averages use logged dates, protein achievement uses eligible dated goals, meal distribution counts food components and category-logged dates, and the preceding equal-length week is explicit. Missing logs are never zeros. No low-breakfast-protein assertion is generated. User/week/language/data+goal hash identifies cached output. Memory cache: 128 entries, five-minute read TTL, defensive copies and erasure-generation fence; no persisted derived health cache.

`Recommendations` locks the owner, reads current goals, journal, preferences and up to 60 distinct familiar sources (20 favorites +20 saved recipes +20 recent meal groups), then filters before ranking. Known allergies/diets require user-reviewed ingredients for the exact source version; unknown allergies remain unknown. An unlisted allergy suppresses automatic choices. Reviews are user assertions, not independent verification; UI requests original label, ingredient and cross-contact checks. No name-based allergen inference. Scoring compares existing snapshot nutrition to known positive remaining targets, favors familiar sources, and selects .5/1/1.5/2 servings where editable bounds permit. Missing targets use a familiar one-serving option. Zero safe choices is a valid result; the engine never invents options to reach two.

New private tables: `recommendation_preferences` and `recommendation_source_reviews`. Owner foreign keys cascade on account deletion; optimistic versions reject stale updates. Source-review writes also require the current monotonic preference revision, checked under the owner lock, so clearing cannot permit stale initial or ABA reviews to resurrect deleted data. Server role alone has access; anon/authenticated/service_role/public are denied. RLS follows the existing private server-role pattern; API predicates and owner locks enforce isolation. Additive migration: `supabase/migrations/20261015122803_p08_recommendations.sql`. Existing meal/nutrition/draft/goal/tracking contracts remain unchanged.

`Wording` accepts only a current revision. The existing gateway reserves/accounts `insight` or `recommendation` before provider dispatch. It sends bounded structured metrics, opaque candidate hashes, and approved bilingual sentence variants; never food names, allergy lists, user text or unrestricted prompts. It validates the entire returned revision, numbers, candidate IDs and ordered sentence IDs. A model can only select approved variants. Invalid responses, policy/quota failure and timeout keep deterministic content. No automatic retry. Usage ledger stores feature/provider/model/token accounting, not raw health content. Memory cache includes all facts, language and schema version; owner deletion/clearing invalidates it.

Mobile has three new routes: Week in Review, recommendations, and food restrictions/privacy. API validators reject malformed nested values. Advice cache is owner-scoped, memory-only and bounded to 12 views; journal/goal/tracking changes invalidate it, focus/resume rereads authoritative state, and sign-out destroys it. The restrictions editor itself refreshes on navigation focus/manual Refresh; AppState resume refresh is a documented deferred minor. Selection rereads the authoritative recommendation revision and refuses changes before opening confirmation. Existing/loading/saving/uncertain drafts are preserved with a resume action; selection cannot replace the retry identity. A choice reuses `draftFromCanonical` and the existing recipe/repeat origins, then opens `/add/review`; only the established explicit save action writes a meal. No new native packages or draft format.

## Local flags and migration order

Keep `FOODLOGGER_INSIGHTS_ENABLED`, `FOODLOGGER_RECOMMENDATIONS_ENABLED`, `FOODLOGGER_RECOMMENDATION_WRITES`, `FOODLOGGER_WORDING_ENABLED` disabled in existing environments. Only local fixture tests enabled them. P01–P07 schema dependencies precede P08; recommendation readiness checks all required tables. Never turn on AI based on a nominal quota number. Actual provider-account policy/billing/model verification remains open.

For a separately authorized rollout: obtain backups and verify restore; apply the additive migration with migration-owner credentials in staging; verify restricted roles, API owner predicates and cascade behavior; enable template/rule reads; enable preference writes only with compatible UI; leave wording off until provider and privacy gates pass. This document does not execute or authorize that rollout.

## Recovery

1. Turn optional wording off first. Template/rule features remain usable.
2. If recommendation integrity is in doubt, disable recommendations and writes. Retain all allergy/preferences/reviews; do not silently serve an older filter against dropped restrictions.
3. Optional write pause: `docs/biteflow/rollback-p08.sql` revokes INSERT/UPDATE/DELETE from the server role while retaining private reads and all data. Its commented GRANT reverses the pause after compatibility checks.
4. Revert P08 implementation commits in reverse order on a new local rollback branch; retain additive tables and restore-compatible backups. Do not reset, force-push, drop tables or erase user data. The final checkpoint lists hashes.
5. P06 caveat remains: pre-P06 readers reject pending label drafts/long text. P07 caveat remains: retain compatible readers and receipts until pending measurements are reconciled. P08 itself creates only existing recipe/repeat draft origins, but does not remove either earlier caveat.
6. Memory caches can be discarded. Preference/privacy clearing increments the preference revision, resets optional fields and deletes ingredient reviews; no derived values are written into meals. Account deletion cascades both private tables.

The local PG16 rehearsal verifies readable preserved preferences/reviews, write denial, reenabling and `pg_dump` restoration in a separate disposable database. Hosted PG17, client rollout, retention/export policy approval and real device restore remain unverified.
