# P01 rollout and rollback runbook

Status: local implementation only. These are future operator instructions, **not authorization to run against production or staging**. P02 is not started. All provider tests use MockTransport. No quotas in tests are account facts.

## Deployment identity and flags

The application still uses its existing custom accounts and opaque sessions in private `foodlogger`, not Supabase Auth. Only the backend connects to that schema. Owner predicates are required even with backend-role RLS; a permissive backend policy is not per-user isolation. Data API roles `anon`, `authenticated` and `service_role` have no access to these new tables.

| Setting | Default | Meaning |
| --- | --- | --- |
| `FOODLOGGER_CANONICAL_WRITES` | `0` | Enables new canonical mutation endpoints only after this account has no unmapped legacy meals. Existing complete legacy routes remain usable. |
| `FOODLOGGER_AI_ENABLED` | `0` | Server kill switch; verified enabled DB policy is also required. Existing provider environment names are preserved. |
| `FOODLOGGER_AI_PROJECT_ID` | `unconfigured` | Accounting project, must match an operator-provisioned policy and the actual API key's project before activation. |
| `FOODLOGGER_ADMIN_USER_IDS` | empty | Comma-separated custom server user IDs (32 lowercase hex); no username, request header, client claim or AI output grants admin. |

Boolean flags accept only `0`, `1`, `false`, `true`. Policies are configured through the internal `AIGateway.configure(BudgetPolicy(...))` operator method, not a user API. There is no automatically enabled or assumed 500/day policy. `GET /api/capabilities` requires authentication. `GET /api/admin/ai-budget` requires a configured admin ID and returns budget metadata only; no raw images, prompts, food text or request keys.

AI capability is readiness, not a guarantee of remaining budget; each attempt must pass reservations. Metadata reports unknown costs separately; `known_cost_microusd=0` is not proof that unknown attempts were free. No pricing or billed-cost query was performed. Reported input tokens are partial when responses lack usage. Conservative held tokens remain charged to their minute even when reported usage is lower. Every actual retry gets its own ledger row; failed/uncertain calls retain their charge. Account deletion nulls attempt ownership while retaining aggregate project usage.

The API always injects the gateway into its analysis service. Direct provider methods remain available for isolated transport tests and explicit offline developer experiments; they are not a second public HTTP path. The gateway currently admits the configured Gemini-free adapter only. Live Ollama experiments are not enabled by these flags.

## Activation gate (still blocked)

Before separately authorized live activation, record independently verified actual project/API-key binding, model, tier, billing status, current daily/RPM/input-TPM allowances, provider reset timezone, and a conservative maximum input token bound covering the bounded images and prompt. Compare the policy against all of them. Confirm other applications using that provider project cannot consume unaccounted traffic, or allocate a documented safety margin. Gateway reservations govern only traffic through this app; they cannot enforce external project traffic or prove the provider's allowance.

Policies require a verification timestamp and expire after their configured TTL (default seven days, maximum thirty). Unverified, future, expired, absent, disabled and provider-mismatched policies reject dispatch. A wrong input-token bound freezes the policy after usage exceeds it; it does not undo a consumed request. Policy changes invalidate pending reservations. Reservations that cannot dispatch within their accounted second fail closed, retaining budget until an operator can establish that they were not sent. No automatic refund/retry after an uncertain outcome.

A result is cached per owner/request in memory for ten minutes. A same-key retry after cache/process loss fails closed instead of spending again. The user can explicitly begin a new request. Budget records contain only hashes and accounting data, not result caches.

## Additive migrations and backfill

New migrations, reviewed as source only outside the disposable local PostgreSQL instance:

1. `supabase/migrations/20261013160000_p01_journal_foundation.sql`
2. `supabase/migrations/20261013170000_p01_ai_gateway.sql`

Keep core `schema_version=1`; separately check `foundation_migrations` for `p01-journal-v1` and `p01-ai-v1`. PostgreSQL application startup never applies these migrations. SQLite initializes the additive tables after authentication creates `users`. SQL resources are included in the Python package.

On an authorized isolated copy: back up first; record row IDs, owners, days, counts and nutrition checksums. Apply additions, then invoke `Foundation(database).backfill_batch(limit=100)` until `processed=0`; rerun once. Each batch is transactional and resumable. Anonymous legacy rows remain outside account groups. Preserve unknown original time/provenance and exact historical meal values. Canonical reads/writes for an account remain unavailable until all its owned meals map to groups. Existing browser/native complete-row readers continue to use `/api/meals`.

Do not enable partial-core or tiny-portion persistence: the original table requires four core nutrients and 1–2000 g/ml. Canonical DTOs/arithmetic preserve nulls and exact values, but new canonical persistence deliberately rejects incompatible partial/tiny data. A later independently reviewed compatibility step must widen constraints and validate all readers. This P01 implementation does not claim that P02 adapter/editor work is done.

Inspect malformed historical metadata on the copy before activation. Backfill fails its transaction on invalid stored JSON rather than rewriting it or guessing; preserve and diagnose the source row. No automated historical-data repair is authorized. Mixed-date legacy group identifiers need review before treating them as a canonical group.

## Backup and restore rehearsal

Executed only in temporary SQLite files and the owned `biteflow-p01-pg` PostgreSQL 16 container on loopback. The PostgreSQL test database ends in `_test`; test fixtures intentionally reset only their schema/role. Never pass a real DSN to those tests.

SQLite: use SQLite's connection `backup()` API into another temporary database, compare deterministic snapshots of all nine application/foundation/accounting tables, reopen the copy, and replay a saved canonical request. PostgreSQL: `pg_dump --format=custom --schema=foodlogger` from the disposable source, create an empty disposable restore database, `pg_restore --exit-on-error`, then perform the same snapshot and receipt-replay checks. Existing roles must be established when restoring to a different cluster. Restore grants/RLS with the schema; test using the backend role after any real migration.

The retained P01 evidence includes exact commands, source scripts, checksum/count results, fixture role tests and elapsed times. Local PostgreSQL 16 evidence is not a claim that deployed Supabase/PostgreSQL 17 or staging was tested. No production backup was taken or inspected.

## Rollback

Disable `FOODLOGGER_CANONICAL_WRITES` and `FOODLOGGER_AI_ENABLED`, restart only the separately authorized environment, and retain all new tables, snapshots, receipts and quota records. Keep the P01-compatible backend so legacy routes still maintain durable tombstones. A pre-P01 backend writing/deleting after rollback would bypass those guarantees and is not a safe mutation rollback. Old UI readers can continue reading complete original meal rows through compatible routes.

Stop backfill between batches and resume later. Do not drop additions or recompute saved nutrition. Restore a backup only under a separate approved incident procedure with reconciliation of writes made since that backup. A migration reversal is not a data recovery plan.

Pre-P01 deleted request IDs that were never recorded cannot be reconstructed. Tombstones protect saves/deletions recorded after this rollout; they do not retroactively recover forgotten historical requests. Invalidating a receipt on edit/delete returns a conflict instead of recreating an earlier snapshot.
