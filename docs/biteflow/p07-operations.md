# P07 local operations and recovery

P07 is weight, hydration and deterministic trends only. No health import, widget, reminder, recommendation or P08 AI capability is enabled. No live AI, production database, hosted deployment or Git push is part of this work.

## Storage and ownership

`tracking_entries` stores owner, kind, value (kg/ml), measurement instant normalized to fixed-width UTC, assigned local date, IANA zone, source/external ID, version, creation/update times and a deletion tombstone. `tracking_receipts` binds each owner/request key to its original request hash and record. Records and receipts cascade on account deletion. Meal beverage volume never writes water.

Migration `20261015112017_p07_tracking.sql` is additive. SQLite installs the equivalent packaged SQL through existing local initialization. PostgreSQL has no startup DDL. Both private tables deny PUBLIC/anon/authenticated/service_role; custom opaque sessions authorize server routes and every repository query predicates the owner. The private `foodlogger_app` role follows the existing architecture (not per-user Supabase JWT RLS). Direct-role denials are tested on disposable PostgreSQL 16; hosted grants/version remain a release gate.

Requests require an explicit offset consistent with the supplied IANA zone and local date. Manual HTTP writes cannot claim a health source. Repository source identities are unique per owner/kind/source/external ID in preparation for later native work; no sync is implemented. PATCH/DELETE require versions; stale requests cannot silently overwrite; replays of a deleted create cannot resurrect it.

## Flags

All default off: `FOODLOGGER_TRACKING_ENABLED` enables history and API reads, `FOODLOGGER_TRACKING_WRITES` enables writes only with tracking enabled, `FOODLOGGER_TRENDS_ENABLED` enables derived period queries. Goals continue to use the existing P03 flag and dated revisions. Capabilities also check schema availability. Flags were enabled only inside test processes; no deployment configuration was changed.

`GET /api/water` and `/api/weight` require `from` and `to`, inclusive 1–31 dates, with 100-row pages and explicit `has_more`. Latest/previous measurement use global measurement time, not insertion time or the selected history day. `GET /api/trends` accepts the same range and compares with the immediately preceding equal-length range. Weeks start Sunday in the UI; months use calendar bounds. Comparisons show exact dates.

Missing days remain null, not zero. Calorie/macronutrient averages use logged-day denominators; an unknown nutrient on any logged day keeps that nutrient's average unknown. Adherence discloses both logged and eligible day counts. There is no logging-complete switch. Weight averages use daily latest values and measured-date denominators; hydration averages use water-logged dates. Original provenance is reported, never upgraded by analytics. No smoothing/interpolation is presented as a measurement.

## Local data, export and deletion policy

Tracking caches are account-scoped, bounded first-page snapshots; sign-out/account deletion use the existing account erasure mechanism. Derived trends are memory-only. A pending measurement operation is persisted before transport to retain the same retry identity after restart. Unconfirmed optimistic changes visibly roll back; uncertain operations must be retried with their original identity. Definitive rejected requests can be explicitly discarded. No credentials are stored in these caches. Confirmed receipts reconcile by identity, including later edits from another device. Incomplete aggregates and global weight summaries become unavailable until refreshed when they cannot be proven from the bounded cached page. Cache eviction completes before the refresh, so old data cannot be revived during an offline read. Dedicated tracking screens refresh on focus/resume.

Authenticated paginated measurement GET responses provide JSON export of active measurements, source IDs, timestamps and versions; export one bounded date range at a time, following `has_more`/offset. No new bulk/export-sharing UI is claimed in P07. Tombstones/receipts remain internal for retry integrity and are erased on account deletion. Existing meal CSV export remains intact. Hosted retention/access-request policy approval is still required before release; no unbounded data copy or hosted export was made.

## Rollback

1. Disable tracking writes and trends flags, retain read capability where compatible.
2. Preserve a database backup and pending client operations. Execute `rollback-p07.sql` only in a reviewed environment: it revokes writes while retaining readable tables and all history. Do not drop measurement tables/receipts to downgrade code.
3. Keep the P07 client until pending measurement requests are resolved. Older clients will not display measurements; the data remains in the database. Derived trend memory can be discarded.
4. Re-enable grants using the explicit statement in the rollback file after validation; then enable write flags. Do not re-run the CREATE POLICY migration over an existing schema.
5. Code rollback can revert the P07 implementation commits in reverse order on a new branch; do not reset/shared-force-push. Retain additive schema until data migration has its own approval.

**P06 label-draft caveat remains:** P05 readers reject `origin=label` and long label text. Disabling flags while retaining the P06+ reader is safer than downgrading. Complete, export or explicitly migrate pending label drafts before any older-client rollback; never silently discard them.

Local rehearsal: write rollback preserved reads, denied writes, re-enable succeeded, and `pg_dump` restored measurement rows into a separate disposable database. Full logs and commands are in `evidence/p07`. Docker Desktop was started for this test, which also auto-resumed its existing local restart-policy containers; none of those containers was queried or modified by this task. Only the dedicated `biteflow-p07-local` database container was used for BiteFlow verification and is to be removed after testing. Hosted backups/restores remain unverified.
