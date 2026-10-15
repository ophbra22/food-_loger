SET search_path TO foodlogger, public;
CREATE TABLE IF NOT EXISTS recommendation_preferences (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 version INTEGER NOT NULL CHECK(version>=1),
 body TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS recommendation_source_reviews (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('meal','recipe')),
 source_id TEXT NOT NULL,
 source_revision TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version>=1),
 body TEXT NOT NULL,
 PRIMARY KEY(user_id,kind,source_id)
);

REVOKE ALL ON foodlogger.recommendation_preferences FROM PUBLIC;
DO $block$ DECLARE role_name TEXT; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON foodlogger.recommendation_preferences FROM %I',role_name);
  END IF;
 END LOOP;
END $block$;
GRANT SELECT,INSERT,UPDATE,DELETE ON foodlogger.recommendation_preferences TO foodlogger_app;
ALTER TABLE foodlogger.recommendation_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_recommendation_preferences ON foodlogger.recommendation_preferences TO foodlogger_app USING (true) WITH CHECK (true);

REVOKE ALL ON foodlogger.recommendation_source_reviews FROM PUBLIC;
DO $block$ DECLARE role_name TEXT; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON foodlogger.recommendation_source_reviews FROM %I',role_name);
  END IF;
 END LOOP;
END $block$;
GRANT SELECT,INSERT,UPDATE,DELETE ON foodlogger.recommendation_source_reviews TO foodlogger_app;
ALTER TABLE foodlogger.recommendation_source_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_recommendation_source_reviews ON foodlogger.recommendation_source_reviews TO foodlogger_app USING (true) WITH CHECK (true);
