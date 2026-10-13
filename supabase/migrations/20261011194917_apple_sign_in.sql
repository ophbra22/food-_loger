-- Additive: preserves existing accounts, passwords, meals and version-1 clients.
CREATE TABLE foodlogger.apple_identities (
    subject TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES foodlogger.users(id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL,
    has_password INTEGER NOT NULL CHECK (has_password IN (0, 1))
);
CREATE TABLE foodlogger.apple_challenges (
    id TEXT PRIMARY KEY,
    nonce TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN ('login', 'link', 'delete')),
    session_hash TEXT NOT NULL,
    user_id TEXT REFERENCES foodlogger.users(id) ON DELETE CASCADE,
    expires_at BIGINT NOT NULL
);
CREATE INDEX apple_challenges_expiry ON foodlogger.apple_challenges(expires_at);
CREATE INDEX apple_challenges_user ON foodlogger.apple_challenges(user_id);
REVOKE ALL ON foodlogger.apple_identities, foodlogger.apple_challenges FROM PUBLIC;
DO $$ DECLARE api_role TEXT; BEGIN
    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
            EXECUTE format('REVOKE ALL ON foodlogger.apple_identities, foodlogger.apple_challenges FROM %I', api_role);
        END IF;
    END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON foodlogger.apple_identities, foodlogger.apple_challenges
    TO foodlogger_app;
ALTER TABLE foodlogger.apple_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodlogger.apple_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_apple_identities ON foodlogger.apple_identities
    FOR ALL TO foodlogger_app USING (true) WITH CHECK (true);
CREATE POLICY server_apple_challenges ON foodlogger.apple_challenges
    FOR ALL TO foodlogger_app USING (true) WITH CHECK (true);
