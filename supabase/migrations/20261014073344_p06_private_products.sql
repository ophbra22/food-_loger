CREATE TABLE IF NOT EXISTS foodlogger.private_products (
 user_id TEXT NOT NULL REFERENCES foodlogger.users(id) ON DELETE CASCADE,
 id TEXT NOT NULL, current_version INTEGER NOT NULL CHECK(current_version>=1),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT,
 PRIMARY KEY(user_id,id)
);
CREATE TABLE IF NOT EXISTS foodlogger.private_product_versions (
 user_id TEXT NOT NULL, product_id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>=1),
 item TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(user_id,product_id,version),
 FOREIGN KEY(user_id,product_id) REFERENCES foodlogger.private_products(user_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS foodlogger.private_product_requests (
 user_id TEXT NOT NULL REFERENCES foodlogger.users(id) ON DELETE CASCADE,
 request_hash TEXT NOT NULL, digest TEXT NOT NULL, result TEXT NOT NULL,
 PRIMARY KEY(user_id,request_hash)
);
CREATE TABLE IF NOT EXISTS foodlogger.label_cache (
 user_id TEXT NOT NULL REFERENCES foodlogger.users(id) ON DELETE CASCADE,
 fingerprint TEXT NOT NULL, payload TEXT NOT NULL, created_at DOUBLE PRECISION NOT NULL,
 expires_at DOUBLE PRECISION NOT NULL, PRIMARY KEY(user_id,fingerprint)
);
CREATE INDEX IF NOT EXISTS private_products_owner ON foodlogger.private_products(user_id,updated_at);
CREATE INDEX IF NOT EXISTS label_cache_expiry ON foodlogger.label_cache(user_id,expires_at);

REVOKE ALL ON foodlogger.private_products FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON foodlogger.private_products FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON foodlogger.private_products TO foodlogger_app;
ALTER TABLE foodlogger.private_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_private_products ON foodlogger.private_products TO foodlogger_app USING (true) WITH CHECK (true);

REVOKE ALL ON foodlogger.private_product_versions FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON foodlogger.private_product_versions FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
GRANT SELECT,INSERT,DELETE ON foodlogger.private_product_versions TO foodlogger_app;
ALTER TABLE foodlogger.private_product_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_private_product_versions ON foodlogger.private_product_versions TO foodlogger_app USING (true) WITH CHECK (true);

REVOKE ALL ON foodlogger.private_product_requests FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON foodlogger.private_product_requests FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
GRANT SELECT,INSERT,DELETE ON foodlogger.private_product_requests TO foodlogger_app;
ALTER TABLE foodlogger.private_product_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_private_product_requests ON foodlogger.private_product_requests TO foodlogger_app USING (true) WITH CHECK (true);

REVOKE ALL ON foodlogger.label_cache FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON foodlogger.label_cache FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON foodlogger.label_cache TO foodlogger_app;
ALTER TABLE foodlogger.label_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_label_cache ON foodlogger.label_cache TO foodlogger_app USING (true) WITH CHECK (true);
