-- ONLY after backup/export and explicit environment approval. Never automatic.
-- Disable FOODLOGGER_{FOOD_SOURCES,SERVINGS,LABEL_AI,PRIVATE_PRODUCTS}_ENABLED first.
-- Saved journal snapshots are self-contained and do not reference these tables by FK.
BEGIN;
DROP TABLE foodlogger.label_cache;
DROP TABLE foodlogger.private_product_requests;
DROP TABLE foodlogger.private_product_versions;
DROP TABLE foodlogger.private_products;
DROP TABLE foodlogger.serving_conversions;
COMMIT;
