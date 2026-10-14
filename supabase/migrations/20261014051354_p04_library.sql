CREATE TABLE IF NOT EXISTS foodlogger.library_favorites (
    user_id TEXT NOT NULL REFERENCES foodlogger.users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('meal','recipe')),
    source_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id,kind,source_id)
);
CREATE INDEX IF NOT EXISTS library_favorites_owner_created ON foodlogger.library_favorites(user_id,created_at);

REVOKE ALL ON foodlogger.library_favorites FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON foodlogger.library_favorites FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
GRANT SELECT,INSERT,DELETE ON foodlogger.library_favorites TO foodlogger_app;
ALTER TABLE foodlogger.library_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_library_favorites ON foodlogger.library_favorites TO foodlogger_app USING (true) WITH CHECK (true);
