CREATE TABLE IF NOT EXISTS recommendation_preferences (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 version INTEGER NOT NULL CHECK(version>=1),
 body TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS recommendation_source_reviews (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('meal','recipe')),
 source_id TEXT NOT NULL,
 source_revision TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version>=1),
 body TEXT NOT NULL,
 PRIMARY KEY(user_id,kind,source_id)
);
