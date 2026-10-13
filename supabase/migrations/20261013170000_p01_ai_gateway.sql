-- Additive accounting only; no policy is enabled or populated by this migration.
SET LOCAL search_path TO foodlogger,pg_catalog;
CREATE TABLE IF NOT EXISTS ai_projects (
    id TEXT PRIMARY KEY, policy TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS ai_attempts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES ai_projects(id),
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    request_hash TEXT NOT NULL,
    payload_digest TEXT NOT NULL,
    attempt INTEGER NOT NULL CHECK (attempt >= 0 AND attempt <= 1),
    feature TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    provider_day TEXT NOT NULL,
    started_at BIGINT NOT NULL,
    reserved_tokens INTEGER NOT NULL CHECK (reserved_tokens >= 0),
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_microusd BIGINT,
    state TEXT NOT NULL CHECK (state IN ('reserved','dispatched','consumed','uncertain','released')),
    UNIQUE (project_id, request_hash, attempt)
);
CREATE INDEX IF NOT EXISTS ai_attempts_project_day ON ai_attempts(project_id, provider_day);
CREATE INDEX IF NOT EXISTS ai_attempts_project_time ON ai_attempts(project_id, started_at);
CREATE INDEX IF NOT EXISTS ai_attempts_owner_day ON ai_attempts(user_id, provider_day);

REVOKE ALL ON foodlogger.ai_projects, foodlogger.ai_attempts FROM PUBLIC;
DO $$ DECLARE role_name TEXT; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON foodlogger.ai_projects, foodlogger.ai_attempts FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON foodlogger.ai_projects,foodlogger.ai_attempts TO foodlogger_app;
ALTER TABLE foodlogger.ai_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodlogger.ai_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_ai_projects ON foodlogger.ai_projects TO foodlogger_app USING(true) WITH CHECK(true);
CREATE POLICY server_ai_attempts ON foodlogger.ai_attempts TO foodlogger_app USING(true) WITH CHECK(true);
INSERT INTO foodlogger.foundation_migrations(name,applied_at) VALUES ('p01-ai-v1',CURRENT_TIMESTAMP::text);
