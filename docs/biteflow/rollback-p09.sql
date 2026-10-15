-- Optional LOCAL/STAGING rehearsal after stopping every reminder worker and setting
-- FOODLOGGER_PUSH_DELIVERY_ENABLED=0, FOODLOGGER_HABITS_ENABLED=0.
-- Do NOT drop tables: preserve opt-ins and at-most-once attempt identities.
BEGIN;
REVOKE INSERT,UPDATE ON foodlogger.reminder_preferences,foodlogger.reminder_devices,foodlogger.reminder_attempts FROM foodlogger_app;
-- Keep DELETE for session/account erasure and device revocation.
COMMIT;
-- Re-enable only after approval and migration/schema verification:
-- GRANT INSERT,UPDATE ON foodlogger.reminder_preferences,foodlogger.reminder_devices,foodlogger.reminder_attempts TO foodlogger_app;
