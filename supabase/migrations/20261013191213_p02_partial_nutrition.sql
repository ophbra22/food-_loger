-- P02 compatibility boundary: back up and stop old servers before applying.
-- This changes constraints only; existing rows, receipts, grants and RLS stay intact.
ALTER TABLE foodlogger.meals
  ALTER COLUMN calories DROP NOT NULL,
  ALTER COLUMN protein DROP NOT NULL,
  ALTER COLUMN carbs DROP NOT NULL,
  ALTER COLUMN fat DROP NOT NULL,
  DROP CONSTRAINT meals_grams_check,
  ADD CONSTRAINT meals_grams_check CHECK (grams >= 0.0001 AND grams <= 2000);
UPDATE foodlogger.schema_version SET version = 2 WHERE id = 1;
-- No destructive down migration: old servers refuse version 2. Roll back the
-- writer flag and keep v2 readers, or restore an offline backup without new writes.
