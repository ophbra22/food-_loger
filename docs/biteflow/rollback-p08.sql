-- Authorized local rehearsal only. For any hosted use obtain separate release approval.
-- First disable FOODLOGGER_WORDING_ENABLED, then recommendation writes and recommendations.
-- Preserve all data. Do not drop these tables or erase restrictions on downgrade.
BEGIN;
REVOKE INSERT, UPDATE, DELETE ON
    foodlogger.recommendation_preferences,
    foodlogger.recommendation_source_reviews FROM foodlogger_app;
COMMIT;
-- Restore writes only after checking the compatible server and owner isolation:
-- GRANT INSERT, UPDATE, DELETE ON foodlogger.recommendation_preferences,
--   foodlogger.recommendation_source_reviews TO foodlogger_app;
