### Task 1: account privacy inventory and server archive

**Files:** create `src/foodlogger/privacy.py`, `tests/test_privacy.py`; extend `src/foodlogger/app.py`, `tests/test_postgres.py`; document `p13-privacy.md`.
**Interfaces:** `account_archive(database, user_id)` returns versioned JSON of explicit approved columns, account data and disclosed exclusions from one read snapshot. Authenticated `GET /api/account/export`, no-cache attachment, bounded row/byte limits with explicit failure rather than truncation. Existing day CSV unchanged. No credentials or delivery tokens. Inventory every persisted table and deletion rule.
- [ ] Add failing API tests: owner A/B isolation, all data categories, secret exclusion, unauthenticated access, bounds, deletion and transactional rollback; PostgreSQL restricted-role coverage.
- [ ] Implement minimal archive and route; audit cascades/caches, fix confirmed privacy defects with regressions. Run `.venv/bin/python -m pytest tests/test_privacy.py -q` — expected PASS.
- [ ] Commit verified server privacy change.

