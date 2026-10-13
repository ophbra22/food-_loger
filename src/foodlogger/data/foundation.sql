CREATE TABLE IF NOT EXISTS foundation_migrations (
    name TEXT PRIMARY KEY, applied_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS foundation_jobs (
    name TEXT PRIMARY KEY, processed INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS meals_owner_identity ON meals(user_id, id);
CREATE TABLE IF NOT EXISTS meal_groups (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    local_date TEXT NOT NULL,
    occurred_at TEXT,
    timezone_id TEXT,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    deleted_at TEXT,
    snapshot TEXT NOT NULL,
    PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS meal_groups_owner_day ON meal_groups(user_id, local_date);
CREATE TABLE IF NOT EXISTS meal_group_items (
    entry_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    FOREIGN KEY (user_id, group_id) REFERENCES meal_groups(user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, entry_id) REFERENCES meals(user_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS meal_group_items_owner_group ON meal_group_items(user_id, group_id);
CREATE TABLE IF NOT EXISTS save_receipts (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_hash TEXT NOT NULL,
    digest TEXT,
    operation TEXT NOT NULL,
    group_id TEXT NOT NULL,
    result_ids TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active','deleted','changed')),
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, request_hash),
    FOREIGN KEY (user_id, group_id) REFERENCES meal_groups(user_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS save_receipts_owner_group ON save_receipts(user_id, group_id);

CREATE TABLE IF NOT EXISTS foundation_issues (
    entry_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('invalid_metadata','inconsistent_group_date','deleted_group')),
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id, entry_id) REFERENCES meals(user_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS foundation_issues_owner ON foundation_issues(user_id);
