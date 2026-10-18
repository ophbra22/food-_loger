### Task 1: compatible export stop controls and regression coverage

**Files:** `src/foodlogger/security.py`, `app.py`, `tests/test_privacy.py`; mobile `storage/export.ts`, `components/AccountExport.tsx`, `.env.example`, corresponding storage/component/auth tests.
**Interfaces:** `Settings.account_export_disabled` defaults false; `FOODLOGGER_ACCOUNT_EXPORT_DISABLED=1` returns authenticated 503 before archive reads. `EXPO_PUBLIC_ACCOUNT_EXPORT_DISABLED=1` hides the account-export card and prevents `buildAccountArchive` from loading data. These switches never gate private-file cleanup, CSV sharing/session guards or error redaction. The server setting takes effect when a new process/app is created; mobile value is compiled.
- [ ] Add failing API/configuration and mobile UI/helper tests for disabled behavior and preserved default behavior; run targeted tests and confirm expected RED.
- [ ] Add lifecycle regressions using real cleanup with a fake filesystem: leftover archive on logout/deletion, failures, unrelated-file preservation and CSV export while account archives are disabled. Retain existing pending-logout regression and exercise both profiles.
- [ ] Implement minimal controls; run targeted and full backend/mobile suites, browser, typecheck and lint. Commit verified code/tests.
