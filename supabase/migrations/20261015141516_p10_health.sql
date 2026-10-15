SET search_path TO foodlogger, public;
CREATE TABLE IF NOT EXISTS health_scopes (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, scope TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS health_exports (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 record_key TEXT NOT NULL, sample_id TEXT NOT NULL UNIQUE,
 revision INTEGER NOT NULL CHECK(revision>=1), payload TEXT NOT NULL,
 PRIMARY KEY(user_id,record_key)
);
CREATE TABLE IF NOT EXISTS health_imports (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 external_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(user_id,external_id)
);

REVOKE ALL ON foodlogger.health_scopes FROM PUBLIC;
DO $block$ DECLARE role_name TEXT; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON foodlogger.health_scopes FROM %I',role_name);
  END IF;
 END LOOP;
END $block$;
GRANT SELECT,INSERT,UPDATE,DELETE ON foodlogger.health_scopes TO foodlogger_app;
ALTER TABLE foodlogger.health_scopes ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_health_scopes ON foodlogger.health_scopes TO foodlogger_app USING (true) WITH CHECK (true);

REVOKE ALL ON foodlogger.health_exports FROM PUBLIC;
DO $block$ DECLARE role_name TEXT; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON foodlogger.health_exports FROM %I',role_name);
  END IF;
 END LOOP;
END $block$;
GRANT SELECT,INSERT,UPDATE,DELETE ON foodlogger.health_exports TO foodlogger_app;
ALTER TABLE foodlogger.health_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_health_exports ON foodlogger.health_exports TO foodlogger_app USING (true) WITH CHECK (true);

REVOKE ALL ON foodlogger.health_imports FROM PUBLIC;
DO $block$ DECLARE role_name TEXT; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON foodlogger.health_imports FROM %I',role_name);
  END IF;
 END LOOP;
END $block$;
GRANT SELECT,INSERT,UPDATE,DELETE ON foodlogger.health_imports TO foodlogger_app;
ALTER TABLE foodlogger.health_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_health_imports ON foodlogger.health_imports TO foodlogger_app USING (true) WITH CHECK (true);
