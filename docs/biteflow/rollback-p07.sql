-- Local/staging rehearsal first. Operational rollback preserves all measurements,
-- retry receipts, tombstones, goals and journal data. Disable FOODLOGGER_TRACKING_WRITES
-- and FOODLOGGER_TRENDS_ENABLED in the deployment configuration before this SQL.
BEGIN;
REVOKE INSERT, UPDATE, DELETE ON foodlogger.tracking_entries, foodlogger.tracking_receipts FROM foodlogger_app;
COMMIT;
-- Re-enable only after review and verification:
-- GRANT INSERT, UPDATE, DELETE ON foodlogger.tracking_entries, foodlogger.tracking_receipts TO foodlogger_app;
-- Do not drop these tables to downgrade code. Account erasure still cascades from users.
