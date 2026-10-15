CREATE TABLE IF NOT EXISTS tracking_entries (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('water','weight')),
 value REAL NOT NULL CHECK(value >= 0.1 AND value <= 15000 AND (kind != 'weight' OR value BETWEEN 1 AND 500)),
 occurred_at TEXT NOT NULL,
 local_date TEXT NOT NULL,
 timezone_id TEXT NOT NULL,
 source TEXT NOT NULL CHECK(source IN ('manual','apple_health','health_connect')),
 external_id TEXT,
 version INTEGER NOT NULL CHECK(version >= 1),
 deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(user_id,id),
 UNIQUE(user_id,kind,source,external_id),
 CHECK((source='manual' AND external_id IS NULL) OR (source!='manual' AND external_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS tracking_owner_day ON tracking_entries(user_id,kind,deleted,local_date,occurred_at,id);
CREATE INDEX IF NOT EXISTS tracking_owner_time ON tracking_entries(user_id,kind,deleted,occurred_at,id);
CREATE TABLE IF NOT EXISTS tracking_receipts (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 entry_id TEXT NOT NULL,
 PRIMARY KEY(user_id,request_key),
 FOREIGN KEY(user_id,entry_id) REFERENCES tracking_entries(user_id,id) ON DELETE CASCADE
);
