### Task 3: local P13 verification and rehearsals

**Files:** evidence under `docs/biteflow/evidence/p13/`, `p13-verification-matrix.md`, `p13-privacy.md`; focused tests if confirmed defects found.
**Interfaces:** exact source commit + command/result ledger, E2E01–20 and F01–20 matrix with honest scope/status; safe synthetic local performance measurements; disposable SQLite/PostgreSQL backup/restore and owner-isolation checks; dependency/secret/log review. No live recognition benchmark.
- [ ] Run Python, mobile, browser, PostgreSQL migrations/roles, lint/typecheck, exports/packages and native host/build checks. Record actual failures/skips; signed/device/hosted checks NOT RUN where unavailable.
- [ ] Rehearse copy restore, compare row/data checksums and document later-write reconciliation. Audit feature kill switches, retention, telemetry fields and current primary-source policy references without account operations.
- [ ] Capture feasible local HE/EN simulator observations; no full accessibility or device assertion without evidence. Commit evidence and classified blockers.

