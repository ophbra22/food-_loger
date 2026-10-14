# P06 operations and recovery

No deployment, hosted migration, provider call or production operation is authorized by this document.

## Enablement

All new server controls default false: `FOODLOGGER_FOOD_SOURCES_ENABLED`, `FOODLOGGER_SERVINGS_ENABLED`, `FOODLOGGER_LABEL_AI_ENABLED`, `FOODLOGGER_PRIVATE_PRODUCTS_ENABLED`. Mobile OCR also requires `EXPO_PUBLIC_LABEL_OCR_ENABLED=1`. A label OCR request still requires the existing verified project policy, OCR feature allowance, photo reserve, per-user/rate/token budgets and provider identity match. No second provider or paid fallback. Keep OCR off until real quota and Hebrew image-quality gates pass. Manual transcription and existing barcode/manual entry work without OCR.

PostgreSQL additive migrations (generated with `supabase migration new`, never applied remotely):

1. `supabase/migrations/20261014072459_p06_servings.sql` — pinned public-domain portion facts; app role SELECT only.
2. `supabase/migrations/20261014073344_p06_private_products.sql` — owner composite keys, immutable product versions, idempotency receipts and private label cache. Users FK cascade on account deletion. Public/anon/authenticated/service_role access revoked; private schema server-role RLS follows the existing architecture. App owner predicates/locks remain the isolation boundary, not Supabase auth.uid.

SQLite initializes the same private tables locally and seeds pinned serving facts lazily. No historical nutrition rows or totals are rewritten. Product updates are new versions; previously saved meals keep their nutrient/portion/source/label snapshots. A private catalog has at most 100 active products; product versions/receipts are retained until account deletion. Latest products can be exported through the authenticated list endpoint; historic versions can be retrieved by version before deletion. Soft product deletion preserves existing journal snapshots.

Label cache: SHA-256 over processing version, language and normalized image; composite owner key; max 32 entries/owner; 64 KiB payload cap; 7-day lookup TTL. No image bytes/path are saved. Expired rows are removed on the owner's next cache write; inactive expired rows can physically remain until cleanup/account deletion. Do not describe this as a strict physical erasure deadline. For an operational erasure deadline, schedule approved expiry cleanup before release. Cross-owner lookup cannot hit another account's entry.

## Rollback

First disable the four server flags and mobile OCR flag. Keep the additive tables and immutable snapshots for the safest rollback. Existing OFF/manual/reference and P01–P05 paths remain available. Retain the branch and revert P06 commits in reverse order if needed; do not rewrite shared history.

Before destructive schema rollback, export private products/versions and take an environment-approved backup. `rollback-p06.sql` removes only the five P06 tables. It intentionally destroys new private products/cache/receipts; applying the forward migrations again recreates the schema and serving facts, not those private records. Restore a backup to recover them. Account deletion intentionally cascades versions/receipts/cache. Never run the down script on production merely because it passed locally.

The disposable PostgreSQL tests execute the exact down script, prove an existing journal meal remains readable, reapply the two up migrations and confirm the journal is unchanged. Hosted backup/restore, role configuration and staging migrations remain gates. Local default settings can serve the pre-P06 PostgreSQL schema without querying these optional tables.

Local recovery drill also uses `pg_dump -Fc` → a separate owned `biteflow_p06_restore_test` database → `pg_restore --exit-on-error`, comparing two immutable product versions and cache owner isolation. The private URL and binary dump remain ignored scratch; only sanitized commands/results/scripts are retained in evidence. Production/hosted recovery has not been tested.
