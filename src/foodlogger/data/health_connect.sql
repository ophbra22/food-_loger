CREATE TABLE IF NOT EXISTS health_connect_imports (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 external_id TEXT NOT NULL, payload TEXT, modified_at TEXT, tracking_id TEXT,
 deleted INTEGER NOT NULL CHECK(deleted IN (0,1)), updated_at TEXT NOT NULL,
 PRIMARY KEY(user_id,external_id),
 CHECK(deleted=1 OR (payload IS NOT NULL AND modified_at IS NOT NULL))
);
