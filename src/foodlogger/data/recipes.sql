CREATE TABLE IF NOT EXISTS recipe_headers (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 id TEXT NOT NULL,
 current_version INTEGER NOT NULL CHECK(current_version>=1),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT,
 PRIMARY KEY(user_id,id)
);
CREATE TABLE IF NOT EXISTS recipe_versions (
 user_id TEXT NOT NULL, recipe_id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>=1),
 name TEXT NOT NULL, servings REAL NOT NULL CHECK(servings>=0.01 AND servings<=1000),
 created_at TEXT NOT NULL,
 PRIMARY KEY(user_id,recipe_id,version),
 FOREIGN KEY(user_id,recipe_id) REFERENCES recipe_headers(user_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS recipe_items (
 user_id TEXT NOT NULL, recipe_id TEXT NOT NULL, version INTEGER NOT NULL,
 position INTEGER NOT NULL CHECK(position>=0 AND position<15), item TEXT NOT NULL,
 PRIMARY KEY(user_id,recipe_id,version,position),
 FOREIGN KEY(user_id,recipe_id,version) REFERENCES recipe_versions(user_id,recipe_id,version) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS recipes_owner_updated ON recipe_headers(user_id,updated_at);
CREATE TABLE IF NOT EXISTS library_requests (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_hash TEXT NOT NULL, digest TEXT NOT NULL, operation TEXT NOT NULL,
 result TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(user_id,request_hash)
);
