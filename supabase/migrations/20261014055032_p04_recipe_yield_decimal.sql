-- Preserve decimal serving yields and accept the inclusive 0.01 boundary.
-- Retain existing versions/receipts. Operational rollback disables recipe writes;
-- do not narrow NUMERIC back to REAL, which loses precision and rejects 0.01.
ALTER TABLE foodlogger.recipe_versions
 ALTER COLUMN servings TYPE NUMERIC USING servings::text::numeric;
