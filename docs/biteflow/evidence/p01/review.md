# Independent review and disposition

Fresh-context gpt-6-astra reviewer; read-only range `9198d94..09c93b5`. The reviewer separately ran 33 targeted tests and reproduced interleavings with temporary SQLite/in-memory storage. No files edited or external providers called. No Critical findings or deferred Minors. Original verdict: **With fixes**.

| Important finding | Reproduction | Fix at `a702455` and verification |
| --- | --- | --- |
| Backfill grouped different legacy dates under the first date and incorrectly declared readiness | Same owner/group ID on October12/13; batches mapped both into one date | Private quarantine reasons, preserved originals, no readiness for unmapped issue rows; mixed-date separate-batch and malformed-JSON RED→GREEN regressions plus PostgreSQL coverage/grants/erasure |
| Draft preflight escaped discard and account generation ordering | Suspend `getItem`, discard or erase+reopen owner, resume stale write | Capture ownership before await; serialize complete logical operations. Two mobile RED→GREEN interleaving regressions |
| Failed cleanup could recover obsolete legacy draft/key | Current attempted v2 + old legacy draft; delete v2 then fail legacy removal | Legacy first, authoritative envelope last; failure at either removal restores current attempted identity. Mobile RED→GREEN |
| Erased-owner reservation could still dispatch | Reserve, erase account (owner null), dispatch within same second | Atomic dispatch predicate requires non-null owner; mocked transport remains untouched, anonymous quota retained. RED→GREEN and PostgreSQL regression |

One implementer fix pass; no second reviewer invocation. Final backend/PostgreSQL316 passed/9 skipped; browser6 passed; mobile124 passed/17 suites; quality/types/build/export/restore checks pass. See actual logs/commands.

Reviewer declined judgments: live provider allowance/billing/project binding/token bounds; real production/staging role behavior; device/hosted-CI execution; partial/tiny persistence and unified P02 UI. Executor disposition: all remain explicit gates/deferred scope under user authorization, with no invented evidence or live activation. See checkpoint and ledger.
