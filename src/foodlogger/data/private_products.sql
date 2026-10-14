CREATE TABLE IF NOT EXISTS private_products (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 id TEXT NOT NULL, current_version INTEGER NOT NULL CHECK(current_version>=1),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT,
 PRIMARY KEY(user_id,id)
);
CREATE TABLE IF NOT EXISTS private_product_versions (
 user_id TEXT NOT NULL, product_id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>=1),
 item TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(user_id,product_id,version),
 FOREIGN KEY(user_id,product_id) REFERENCES private_products(user_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS private_product_requests (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_hash TEXT NOT NULL, digest TEXT NOT NULL, result TEXT NOT NULL,
 PRIMARY KEY(user_id,request_hash)
);
CREATE TABLE IF NOT EXISTS label_cache (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 fingerprint TEXT NOT NULL, payload TEXT NOT NULL, created_at DOUBLE PRECISION NOT NULL,
 expires_at DOUBLE PRECISION NOT NULL, PRIMARY KEY(user_id,fingerprint)
);
CREATE INDEX IF NOT EXISTS private_products_owner ON private_products(user_id,updated_at);
CREATE INDEX IF NOT EXISTS label_cache_expiry ON label_cache(user_id,expires_at);
