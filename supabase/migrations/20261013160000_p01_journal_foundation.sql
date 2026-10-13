-- Additive only. Apply as owner after separate environment approval; never at server startup.
-- Core schema_version remains 1 so existing servers can still read complete legacy rows.
SET LOCAL search_path TO foodlogger, pg_catalog;
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

REVOKE ALL ON foodlogger.foundation_migrations, foodlogger.foundation_jobs, foodlogger.meal_groups,
 foodlogger.meal_group_items, foodlogger.save_receipts FROM PUBLIC;
DO $$ DECLARE role_name TEXT; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON foodlogger.foundation_migrations, foodlogger.foundation_jobs, foodlogger.meal_groups, foodlogger.meal_group_items, foodlogger.save_receipts FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
GRANT SELECT ON foodlogger.foundation_migrations TO foodlogger_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON foodlogger.foundation_jobs,foodlogger.meal_groups,
 foodlogger.meal_group_items,foodlogger.save_receipts TO foodlogger_app;
ALTER TABLE foodlogger.foundation_migrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_foundation_migrations ON foodlogger.foundation_migrations TO foodlogger_app USING (true) WITH CHECK (true);
ALTER TABLE foodlogger.foundation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_foundation_jobs ON foodlogger.foundation_jobs TO foodlogger_app USING (true) WITH CHECK (true);
ALTER TABLE foodlogger.meal_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_meal_groups ON foodlogger.meal_groups TO foodlogger_app USING (true) WITH CHECK (true);
ALTER TABLE foodlogger.meal_group_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_meal_group_items ON foodlogger.meal_group_items TO foodlogger_app USING (true) WITH CHECK (true);
ALTER TABLE foodlogger.save_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_save_receipts ON foodlogger.save_receipts TO foodlogger_app USING (true) WITH CHECK (true);
INSERT INTO foodlogger.foundation_migrations(name,applied_at) VALUES ('p01-journal-v1',CURRENT_TIMESTAMP::text);
