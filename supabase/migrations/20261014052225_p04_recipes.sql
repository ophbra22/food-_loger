CREATE TABLE IF NOT EXISTS foodlogger.recipe_headers (
 user_id TEXT NOT NULL REFERENCES foodlogger.users(id) ON DELETE CASCADE,
 id TEXT NOT NULL,
 current_version INTEGER NOT NULL CHECK(current_version>=1),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT,
 PRIMARY KEY(user_id,id)
);
CREATE TABLE IF NOT EXISTS foodlogger.recipe_versions (
 user_id TEXT NOT NULL, recipe_id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>=1),
 name TEXT NOT NULL, servings REAL NOT NULL CHECK(servings>=0.01 AND servings<=1000),
 created_at TEXT NOT NULL,
 PRIMARY KEY(user_id,recipe_id,version),
 FOREIGN KEY(user_id,recipe_id) REFERENCES foodlogger.recipe_headers(user_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS foodlogger.recipe_items (
 user_id TEXT NOT NULL, recipe_id TEXT NOT NULL, version INTEGER NOT NULL,
 position INTEGER NOT NULL CHECK(position>=0 AND position<15), item TEXT NOT NULL,
 PRIMARY KEY(user_id,recipe_id,version,position),
 FOREIGN KEY(user_id,recipe_id,version) REFERENCES foodlogger.recipe_versions(user_id,recipe_id,version) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS recipes_owner_updated ON foodlogger.recipe_headers(user_id,updated_at);
CREATE TABLE IF NOT EXISTS foodlogger.library_requests (
 user_id TEXT NOT NULL REFERENCES foodlogger.users(id) ON DELETE CASCADE,
 request_hash TEXT NOT NULL, digest TEXT NOT NULL, operation TEXT NOT NULL,
 result TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(user_id,request_hash)
);

REVOKE ALL ON foodlogger.recipe_headers FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON foodlogger.recipe_headers FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON foodlogger.recipe_headers TO foodlogger_app;
ALTER TABLE foodlogger.recipe_headers ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_recipe_headers ON foodlogger.recipe_headers TO foodlogger_app USING (true) WITH CHECK (true);

REVOKE ALL ON foodlogger.recipe_versions FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON foodlogger.recipe_versions FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
GRANT SELECT,INSERT,DELETE ON foodlogger.recipe_versions TO foodlogger_app;
ALTER TABLE foodlogger.recipe_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_recipe_versions ON foodlogger.recipe_versions TO foodlogger_app USING (true) WITH CHECK (true);

REVOKE ALL ON foodlogger.recipe_items FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON foodlogger.recipe_items FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
GRANT SELECT,INSERT,DELETE ON foodlogger.recipe_items TO foodlogger_app;
ALTER TABLE foodlogger.recipe_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_recipe_items ON foodlogger.recipe_items TO foodlogger_app USING (true) WITH CHECK (true);

REVOKE ALL ON foodlogger.library_requests FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON foodlogger.library_requests FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
GRANT SELECT,INSERT,DELETE ON foodlogger.library_requests TO foodlogger_app;
ALTER TABLE foodlogger.library_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_library_requests ON foodlogger.library_requests TO foodlogger_app USING (true) WITH CHECK (true);
