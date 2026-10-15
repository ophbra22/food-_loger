# P07 checkpoint — candidate under independent review

Scope: P07 only, base `fca475d4b9feaba2545d2c7e65b83a5692d918d0`, local `codex/biteflow-p07`. P08 is not started. No live AI/provider charges, production operations, push, merge or deployment.

Implemented locally: versioned private weight/water CRUD, deduplication and retry receipts, owner isolation and erasure; deterministic week/month/prior-range analytics; dated goal comparison, explicit logged/measured-day denominators and gaps; mobile tracking/history/edit/delete, quick hydration, normalized-unit displays, source states, dual-axis accessible charts and toggles, date drill-down, optimistic rollback and shared invalidation.

Candidate evidence: backend with disposable PostgreSQL 467 passed/9 skipped; browser regression 6 passed/470 deselected (six of the nine skips separately executed); mobile 240 passed in 52 suites; TypeScript passed; Python Ruff and format passed; mobile lint final passed; wheel/sdist and iOS/Android Hermes plus web export passed. Three optional ML tests remain unrun. These are local results, not hosted CI or native binaries.

Two browser component previews use real RN components with synthetic data (English/Hebrew) and pass 250+500/delete, chart gaps and zero runtime errors. They are not full authenticated native journeys. `evidence/p07/*.png` preserves screenshots. Query-performance fixture: 12,000 synthetic meal rows, 20 runs, 30 current/30 prior dates, median 2.998 ms/max 3.347 ms; SQLite owner/date index plans captured. No production performance claim.

Review and acceptance table will be finalized after the independent pass. Physical iOS/Android execution, hosted CI/staging and all earlier open gates remain unverified. Do not treat this candidate as unconditional production readiness.

See `p07-operations.md` for contracts, flags, export/deletion and data-preserving rollback; `evidence/p07/commands.jsonl` for exact executed commands/results including intermediate failures.
