-- First disable client Health sync and FOODLOGGER_HEALTH_ENABLED; do not drop
-- anonymous scopes, monotonic revisions, tombstones or imported provenance.
-- Keep DELETE for account erasure. Re-enable only after an approved rollout.
REVOKE INSERT,UPDATE ON foodlogger.health_scopes,foodlogger.health_exports,foodlogger.health_imports FROM foodlogger_app;
