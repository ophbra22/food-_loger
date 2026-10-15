CREATE TABLE IF NOT EXISTS reminder_preferences (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 version INTEGER NOT NULL CHECK(version>=1), body TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reminder_devices (
 token TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 session_hash TEXT NOT NULL UNIQUE REFERENCES sessions(token_hash) ON DELETE CASCADE,
 platform TEXT NOT NULL CHECK(platform IN ('ios','android')),
 ready INTEGER NOT NULL CHECK(ready IN (0,1)), checked_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS reminder_device_owner ON reminder_devices(user_id);
CREATE TABLE IF NOT EXISTS reminder_attempts (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 local_date TEXT NOT NULL, category TEXT NOT NULL,
 attempted_at BIGINT NOT NULL,
 PRIMARY KEY(user_id,local_date,category)
);
