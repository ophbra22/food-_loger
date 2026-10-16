-- Disable both Health Connect flags and pause clients BEFORE running locally reviewed rollback.
-- Keep receipt tombstones, linked weight rows and shared export identities; do not drop tables.
-- Retain SELECT/DELETE for account data access and erasure. Shared P10 tables are unchanged.
REVOKE INSERT, UPDATE ON foodlogger.health_connect_imports FROM foodlogger_app;
