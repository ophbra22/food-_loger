# P02 migration and rollback review

No production/staging migration or rollout has been performed. The code retains `FOODLOGGER_CANONICAL_WRITES=false` by default. Provider flags remain off. User approval of this checkpoint is not an instruction to deploy or start P03.

## Compatibility contract

The same `meals` rows remain authoritative. Core nutrient columns accept NULL; normalized quantity accepts 0.0001–2000 g/ml. Zero nutrients remain known zero. Canonical input/snapshot, source, label metadata and exact calculation version live alongside the row. Historical rows/IDs/nutrient snapshots are copied exactly, never recalculated.

`GET /api/meals?day=…&schema_version=2` returns nullable totals plus `known_totals` and per-nutrient `partial` flags. Default v1 reads retain their complete-day shape/rounding. A day containing any unknown core value or a portion under 1 returns **409 Upgrade required**, rather than hiding records or inventing values. CSV encodes unknowns as blank cells. Old complete saves/endpoints remain available. This is a deliberate, visible compatibility boundary, not full old-client support for partial days. The legacy browser surfaces the server error; new mobile requests v2 and displays unknowns as not provided.

The common mobile editor activates only when server capabilities say canonical, partial and tiny writes are ready. The existing editor remains the rollback path and preserves already-attempted legacy requests. No outcome-unknown draft is silently converted/re-keyed. Upgraded drafts retain their v2 wire format and fail safely if the writer is disabled; never silently send a different legacy payload. Editing an attempted draft intentionally obtains a new key via the existing durability mechanism.

## PostgreSQL (review only; not a deployment procedure executed here)

1. Confirm an independently provisioned non-production target, owner-scoped backfill readiness, backup permissions, expected core/P01 migrations and absence of old workers. Stop writers and obtain a verified backup first.
2. Apply `supabase/migrations/20261013191213_p02_partial_nutrition.sql` through the project's controlled migration procedure. It widens constraints and advances `schema_version` from 1 to 2. P01 servers reject version 2 at startup; do not leave already-running older workers alive.
3. Use the new server with writer flags off; verify row/ID/count/hash preservation, RLS/grants/owner isolation, receipts, v1 complete-day reads, v1 partial rejection and v2 partial reads. The migration changes no grants or policies. The existing private `foodlogger_app` architecture/custom sessions remain in force.
4. Enable canonical writes only after non-production acceptance and explicit rollout authorization. Apply no destructive reverse migration. The local disposable PostgreSQL rehearsal used the existing restricted app role and tested a dump/restore including a NULL/tiny row and receipt.

## SQLite (explicit offline command, never automatic startup rebuild)

First stop **all** processes that access the file; local backups must be protected like the original journal. Run the module on an authorized copy before considering the real file:

```sh
PYTHONPATH=src python -m foodlogger.partial_migration /absolute/authorized-copy.sqlite3 /absolute/new-backup.sqlite3
```

The backup path must be new and separate. The implementation uses SQLite backup, disables foreign keys outside its exclusive transaction, copies named columns into a new table, replaces the original, recreates indexes/triggers and validates foreign keys before commit. Unknown columns or any views cause an explicit refusal and rollback, with the backup preserved. Existing files are not rebuilt during app startup. Fresh development/test databases use v2 from creation.

Stop writers throughout backup/migration/verification. The backup and rebuild are not a zero-downtime migration. A custom schema requires a separate reviewed adaptation. Restore the backup only while offline and only when doing so cannot erase newer writes; after new v2 saves, rollback must keep v2 storage/readers and merely disable the writer flag.

## Evidence and limits

See `evidence/p02/commands.jsonl`, logs and checkpoint. SQLite tests preserve complete rows, receipts, indexes/triggers, verify foreign keys and read the backup; PostgreSQL tests use only a newly created disposable loopback container. Hosted Supabase migration/grants, actual staging data and production backup availability are unverified. No remote SQL or advisor queries were issued.

Reviewed current official references: [SQLite generalized ALTER TABLE procedure](https://www.sqlite.org/lang_altertable.html), [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase changelog](https://supabase.com/changelog) (2026-10-13; no relevant migration API change found), [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/). Migration file created with local Supabase CLI 2.98.1 `migration new`; no CLI dependency upgrade was necessary.
