# P10 independent review and disposition

Reviewer: fresh `p10_final_review` agent, GPT-6 Astra, high reasoning. Immutable review range: `0bcfbaaa7f92b211d49f2bfb42f0180baa3ce2c3..26527bdcb0d27ea7ff0f61149c4a39476ea6bb7a`. Read-only review; no shared PostgreSQL, native project, Git, or production changes. The reviewer reproduced findings 1–2 with actual compiled queue code in isolated in-memory Node harnesses. Finding 3 followed from inspected mutation/store paths. No second review was commissioned; author fixes are verified by regression tests and full suites.

## Findings and fixes

| Finding | Grade | Reproduction | Fix and evidence |
|---|---|---|---|
| Concurrent startup restore overwrites newly selected consent and can re-enable weight imports | Important | Delayed first read, second restore/connect deselecting weight, release old read: old choices persisted and weight read resumes | Single-flight restore, queued consent mutations, immediate cancellation of old operations. `overlapping startup and new consent cannot restore or read deselected weight` fails before fix, passes after; asserts one read, new persisted choices, no deselected read. |
| Every unchanged sync rewrites whole history after each record | Important | Review harness: second 1,000-record sync made 1,000 native calls, 1,001 storage writes, 167,347,181 serialized bytes | Server remains durable outbox; compact scoped client acknowledgements; native/client batches <=50; acknowledged revisions skipped. New 1,000-record regression fails before fix. After fix first sync: 21 storage writes / 393,856 serialized ASCII bytes / 20 native batches; unchanged sync and restart: zero native replay and no per-record storage writes. This is mocked traffic, not measured device performance. |
| Imported weight leaves loaded weight/trend/advice views stale | Important | Import API writes canonical tracking but HealthSync only publishes its own status | Import response reports actual newly inserted weight dates; duplicate receipts report none. Each successful batch notifies tracking and its existing trend/advice invalidation callback, including when a later batch fails. RED→GREEN API/queue/tracking regressions; SQLite and actual PG tests verify receipt behavior. |

Reviewer found **zero Critical and zero Minor** issues. All three Important findings were accepted and fixed in one author fix pass.

Author confirmed an additional lifecycle issue in that pass: the iOS permission sheet's `inactive` transition canceled `connect()`. The actual provider regression failed with `Health session ended`, then passed after pausing only on `background`. The first attempt at this regression had a Jest mock-hoisting error; that failure is retained separately and is not counted as a product defect. A test-only TypeScript AppState listener mismatch was also corrected and typecheck rerun successfully. Disconnect/in-flight batch ordering and owner-scoped acknowledgement/corrupt-state tests pass.

Batch API policy tests first failed to compile because the validator did not exist, then passed 13 native policy checks. Unsigned Xcode builds compile the actual HealthKit implementation; these are not mocked HealthKit behavior tests.

## Reviewer strengths

Read-permission ambiguity is preserved; reads are only weight/steps. Explicit owner predicates, revision/tombstone identity, app-source-plus-identity deletion and immutable import receipts protect existing user deletions. Unsigned compilation is not presented as device acceptance.

## Declined-to-judge items / author rulings

- Physical permission dialogs, background transitions, HealthKit behavior, data protection, signing and E2E-16/19/20 require device evidence. Remain BLOCKED; flags remain off for live use.
- Reinstall/ledger loss, multiple devices, user deletion of Health samples, and external sample changes remain live-enablement gates. No implicit repair/resurrection promise.
- History/query caps remain explicit limits; fix 2 addresses traffic inside those limits. Large histories still need pagination/performance validation.
- Unknown legacy timestamps and individual nutrient samples remain documented design decisions; no invented occurrence time or unnecessary correlation permission.
- Production deployment, hosted recovery, real AI quotas and operational privacy approval remain outside authorized local work.

See `ledger.md` for all decisions and their costs, and `commands.jsonl` / full logs for executed checks. No device, hosted, provider or privacy gate is closed by this review.
