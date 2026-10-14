CREATE TABLE IF NOT EXISTS library_favorites (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('meal','recipe')),
    source_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id,kind,source_id)
);
CREATE INDEX IF NOT EXISTS library_favorites_owner_created ON library_favorites(user_id,created_at);
