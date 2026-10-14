CREATE TABLE IF NOT EXISTS user_nutrition_goal_revisions (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version >= 1),
    effective_local_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    calorie_target REAL CHECK (calorie_target >= 1 AND calorie_target <= 10000),
    protein_g REAL CHECK (protein_g >= 0.1 AND protein_g <= 500),
    carbs_g REAL CHECK (carbs_g >= 0.1 AND carbs_g <= 1500),
    fat_g REAL CHECK (fat_g >= 0.1 AND fat_g <= 500),
    water_ml REAL CHECK (water_ml >= 1 AND water_ml <= 15000),
    target_weight_kg REAL CHECK (target_weight_kg >= 1 AND target_weight_kg <= 500),
    calorie_min_percent REAL NOT NULL DEFAULT 90 CHECK (calorie_min_percent BETWEEN 50 AND 100),
    calorie_max_percent REAL NOT NULL DEFAULT 110 CHECK (calorie_max_percent BETWEEN 100 AND 150),
    PRIMARY KEY (user_id, version),
    UNIQUE (user_id, id)
);
CREATE INDEX IF NOT EXISTS goals_owner_date ON user_nutrition_goal_revisions(user_id,effective_local_date,version);
