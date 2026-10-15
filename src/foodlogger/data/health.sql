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
