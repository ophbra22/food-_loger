-- Additive private goal history. No existing meal or goal values are rewritten.
SET LOCAL search_path TO foodlogger, pg_catalog;
CREATE TABLE IF NOT EXISTS user_nutrition_goal_revisions (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version >= 1),
    effective_local_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    calorie_target DOUBLE PRECISION CHECK (calorie_target > 0 AND calorie_target <= 10000),
    protein_g DOUBLE PRECISION CHECK (protein_g > 0 AND protein_g <= 500),
    carbs_g DOUBLE PRECISION CHECK (carbs_g > 0 AND carbs_g <= 1500),
    fat_g DOUBLE PRECISION CHECK (fat_g > 0 AND fat_g <= 500),
    water_ml DOUBLE PRECISION CHECK (water_ml > 0 AND water_ml <= 15000),
    target_weight_kg DOUBLE PRECISION CHECK (target_weight_kg > 0 AND target_weight_kg <= 500),
    calorie_min_percent DOUBLE PRECISION NOT NULL DEFAULT 90 CHECK (calorie_min_percent BETWEEN 50 AND 100),
    calorie_max_percent DOUBLE PRECISION NOT NULL DEFAULT 110 CHECK (calorie_max_percent BETWEEN 100 AND 150),
    PRIMARY KEY (user_id, version),
    UNIQUE (user_id, id)
);
CREATE INDEX IF NOT EXISTS goals_owner_date ON user_nutrition_goal_revisions(user_id,effective_local_date,version);

REVOKE ALL ON foodlogger.user_nutrition_goal_revisions FROM PUBLIC;
DO $$ DECLARE role_name TEXT; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON foodlogger.user_nutrition_goal_revisions FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
-- Custom opaque sessions are verified by the server. This private role is never sent to clients.
GRANT SELECT,INSERT,DELETE ON foodlogger.user_nutrition_goal_revisions TO foodlogger_app;
ALTER TABLE foodlogger.user_nutrition_goal_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_goal_revisions ON foodlogger.user_nutrition_goal_revisions TO foodlogger_app USING (true) WITH CHECK (true);
INSERT INTO foodlogger.foundation_migrations(name,applied_at) VALUES ('p03-goals-v1',CURRENT_TIMESTAMP::text);
