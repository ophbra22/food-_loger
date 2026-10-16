SET search_path TO foodlogger, public;
CREATE TABLE IF NOT EXISTS health_connect_imports (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 external_id TEXT NOT NULL, payload TEXT, modified_at TEXT, tracking_id TEXT,
 deleted INTEGER NOT NULL CHECK(deleted IN (0,1)), updated_at TEXT NOT NULL,
 PRIMARY KEY(user_id,external_id),
 CHECK(deleted=1 OR (payload IS NOT NULL AND modified_at IS NOT NULL))
);

REVOKE ALL ON foodlogger.health_connect_imports FROM PUBLIC;
DO $block$ DECLARE role_name TEXT; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON foodlogger.health_connect_imports FROM %I',role_name);
  END IF;
 END LOOP;
END $block$;
GRANT SELECT,INSERT,UPDATE,DELETE ON foodlogger.health_connect_imports TO foodlogger_app;
ALTER TABLE foodlogger.health_connect_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_health_connect_imports ON foodlogger.health_connect_imports TO foodlogger_app USING (true) WITH CHECK (true);
