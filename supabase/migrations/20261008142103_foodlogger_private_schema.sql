-- Run once as the database owner. No existing application schema is changed.
CREATE ROLE foodlogger_app NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE SCHEMA foodlogger;
REVOKE ALL ON SCHEMA foodlogger FROM PUBLIC;
GRANT USAGE ON SCHEMA foodlogger TO foodlogger_app;
DO $$ BEGIN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO foodlogger_app', current_database());
END $$;

CREATE TABLE foodlogger.schema_version (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL
);
INSERT INTO foodlogger.schema_version VALUES (1, 1);
CREATE TABLE foodlogger.users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    recovery_hash TEXT NOT NULL
);
CREATE TABLE foodlogger.sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES foodlogger.users(id) ON DELETE CASCADE,
    csrf_token TEXT NOT NULL,
    expires_at BIGINT NOT NULL
);
CREATE INDEX sessions_user_id ON foodlogger.sessions(user_id);
CREATE INDEX sessions_expiry ON foodlogger.sessions(expires_at);
CREATE TABLE foodlogger.meals (
    id TEXT PRIMARY KEY,
    day TEXT NOT NULL,
    meal_type TEXT NOT NULL,
    food_id TEXT NOT NULL,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    grams DOUBLE PRECISION NOT NULL CHECK (grams >= 1 AND grams <= 2000),
    calories DOUBLE PRECISION NOT NULL,
    protein DOUBLE PRECISION NOT NULL,
    carbs DOUBLE PRECISION NOT NULL,
    fat DOUBLE PRECISION NOT NULL,
    created_at TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES foodlogger.users(id) ON DELETE CASCADE,
    details TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX meals_owner_day ON foodlogger.meals(user_id, day);
REVOKE ALL ON ALL TABLES IN SCHEMA foodlogger FROM PUBLIC;
DO $$ DECLARE api_role TEXT; BEGIN
    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
            EXECUTE format('REVOKE ALL ON SCHEMA foodlogger FROM %I', api_role);
            EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA foodlogger FROM %I', api_role);
        END IF;
    END LOOP;
END $$;
GRANT SELECT ON foodlogger.schema_version TO foodlogger_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON foodlogger.users, foodlogger.sessions, foodlogger.meals
    TO foodlogger_app;

-- Only the Python server's dedicated role can access these private tables.
-- Individual account ownership is enforced by authenticated server queries.
ALTER TABLE foodlogger.schema_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodlogger.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodlogger.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodlogger.meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_version ON foodlogger.schema_version FOR SELECT TO foodlogger_app USING (true);
CREATE POLICY server_users ON foodlogger.users TO foodlogger_app USING (true) WITH CHECK (true);
CREATE POLICY server_sessions ON foodlogger.sessions TO foodlogger_app USING (true) WITH CHECK (true);
CREATE POLICY server_meals ON foodlogger.meals TO foodlogger_app USING (true) WITH CHECK (true);
