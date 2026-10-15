SET search_path TO foodlogger, public;
CREATE TABLE IF NOT EXISTS reminder_preferences (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 version INTEGER NOT NULL CHECK(version>=1), body TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reminder_devices (
 token TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 session_hash TEXT NOT NULL UNIQUE REFERENCES sessions(token_hash) ON DELETE CASCADE,
 platform TEXT NOT NULL CHECK(platform IN ('ios','android')),
 ready INTEGER NOT NULL CHECK(ready IN (0,1)), checked_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS reminder_device_owner ON reminder_devices(user_id);
CREATE TABLE IF NOT EXISTS reminder_attempts (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 local_date TEXT NOT NULL, category TEXT NOT NULL,
 attempted_at BIGINT NOT NULL,
 PRIMARY KEY(user_id,local_date,category)
);

REVOKE ALL ON foodlogger.reminder_preferences FROM PUBLIC;
DO $block$ DECLARE role_name TEXT; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON foodlogger.reminder_preferences FROM %I',role_name);
  END IF;
 END LOOP;
END $block$;
GRANT SELECT,INSERT,UPDATE,DELETE ON foodlogger.reminder_preferences TO foodlogger_app;
ALTER TABLE foodlogger.reminder_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_reminder_preferences ON foodlogger.reminder_preferences TO foodlogger_app USING (true) WITH CHECK (true);

REVOKE ALL ON foodlogger.reminder_devices FROM PUBLIC;
DO $block$ DECLARE role_name TEXT; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON foodlogger.reminder_devices FROM %I',role_name);
  END IF;
 END LOOP;
END $block$;
GRANT SELECT,INSERT,UPDATE,DELETE ON foodlogger.reminder_devices TO foodlogger_app;
ALTER TABLE foodlogger.reminder_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_reminder_devices ON foodlogger.reminder_devices TO foodlogger_app USING (true) WITH CHECK (true);

REVOKE ALL ON foodlogger.reminder_attempts FROM PUBLIC;
DO $block$ DECLARE role_name TEXT; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON foodlogger.reminder_attempts FROM %I',role_name);
  END IF;
 END LOOP;
END $block$;
GRANT SELECT,INSERT,UPDATE,DELETE ON foodlogger.reminder_attempts TO foodlogger_app;
ALTER TABLE foodlogger.reminder_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_reminder_attempts ON foodlogger.reminder_attempts TO foodlogger_app USING (true) WITH CHECK (true);
