# BiteFlow P01 checkpoint

**Phase:** P01 — Data contracts, security and safe migrations  
**Status:** IMPLEMENTED, UNVERIFIED — local checks pass; all four Important independent-review findings are fixed with failing-then-passing regressions. Staging, real quota and native-device gates are not verified.  
**Feature IDs covered:** F14 foundations; shared contracts, persistence and reliability foundations for F20 and future food-input features. No full F01–F20 feature is being promoted to complete.  
**Next phase:** P02 — NOT STARTED; requires review of this checkpoint and explicit user approval. No automatic progression.

## Repository baseline and review units

Baseline `9198d94e003e1aefff2ccfd44e741eb21efa7d5e` on `mobile-app`. Isolated branch `codex/biteflow-p01`, worktree `/Users/braude/.codex/worktrees/biteflow-p01/food-_loger`. The original checkout is unchanged by implementation. P00 documents were preserved in `572ba1c` before the following small-PR units; no branches were pushed and no remote PR/deployment was created.

| Slice | Local commit | Result |
| --- | --- | --- |
| P01-A | `4de28e8` | Versioned Python/TypeScript canonical contracts, precise arithmetic, legacy adapters and shared fixtures |
| P01-B | `38ad321` | Additive private groups/ownership/migration metadata; resumable historical backfill |
| P01-C | `4f9fcb4` | Durable save receipts, confirmed canonical create/patch/delete, legacy route integration and browser retries |
| P01-D | `56edab2` | Critical draft persistence, schema validation, account erasure generations and cache invalidation |
| P01-E | `8299d35` | Atomic project/user/feature reservations, each retry accounted, gateway around photo provider |
| P01-F | `09c93b5` | Default-off flags, owner readiness, admin budget access, mobile CI and operations runbook |
| Review fixes | `a702455` | Historical quarantine, draft ordering/cleanup, erased-owner dispatch |

Changed product/test/config files and migrations are listed in the retained [changed-paths artifact](evidence/p01/changed-paths.txt). P00 audit content remains historical; the [matrix overlay](implementation-matrix.md) and [roadmap](roadmap.md) show P01 progress without implying later phases are complete.

## Functional behavior

- Canonical DTOs carry schema/calculation version, original/normalized quantity, nullable nutrients, provenance, input/category and explicit local-date/zone/offset context. Decimal/rational arithmetic distinguishes unknown from zero, preserves partial totals, and tests kJ, sodium/salt, density and DST. Original persisted nutrition values are not recomputed.
- Canonical confirmed creates, optimistic-version edits and deletions share the existing journal. Atomic owner-scoped receipts make repeat saves deterministic; changed canonical/analyzed content conflicts. Edited/deleted receipts prevent stale retries from recreating removed food. Legacy complete-record endpoints remain available.
- Draft storage failures are visible and block a server save before its retry identity is durable. Unknown draft formats are preserved until explicit discard. A confirmed server save with local cleanup failure retains the attempted key and reports that state. Cache revisions prevent stale reads from overwriting confirmed adds/deletes.
- AI reservations enforce configured project/day/user/feature/request and rolling minute budgets on both database engines. Non-photo traffic cannot consume the photo reserve. Each actual retry consumes an attempt; uncertain consumption is retained. Default flags and missing/expired/mismatched policy prevent live activation. The operator budget API contains accounting metadata only.
- The Python CI jobs remain; a mobile job adds locked dependency install, lint, typecheck, Jest and local iOS/Android export. Hosted execution is still unverified.

Canonical persistence intentionally accepts only complete four-core-nutrient records with the existing 1–2000 g/ml constraints. Partial/tiny draft representation exists, but persistence is gated pending the P02 compatibility decision. The shared P02 editor/input adapters and all later product features are untouched.

## Security / privacy checks

Verified with temporary SQLite files and PostgreSQL 16.13 using `foodlogger_app`: owner isolation, group/entry foreign keys, backend-only role grants/RLS, account deletion, save tombstones/version conflicts, and 100 competing journal saves. The gateway has 100-request burst tests across independent instances, per-user/project caps, photo reserve, midnight vs rolling-minute boundaries, retries, timeout retention, cache/restart behavior, kill switch and policy/model changes. Actual database locks and transactions are exercised; only external HTTP provider responses are mocked.

Authentication remains the existing custom session model. New admin rights come only from server-managed user IDs. No production secrets were copied to artifacts, no real AI transports were used, and no real project databases were queried/migrated. Routine tests now reject real HTTPX network transport. Dependency and penetration scans beyond these code/role checks were not performed in P01.

## Tests executed

The [command ledger](evidence/p01/commands.jsonl) records exact commands, directories, exit codes and elapsed times. [Test logs](evidence/p01) preserve both intentionally failing TDD runs and successful verification. Use the supplied sanitized runner or explicitly remove production/provider environment settings before reproducing.

| Check | Command (relative to worktree) | Final actual result |
| --- | --- | --- |
| Backend + PostgreSQL | Disposable DSN + `.venv/bin/python -m pytest -q -p no:cacheprovider` | 316 passed, 9 skipped; 9.76s pytest time |
| Browser | `FOODLOGGER_RUN_BROWSER_TESTS=1 .venv/bin/python -m pytest -m browser -q -p no:cacheprovider` | 6 passed, 319 deselected; 16.03s |
| Mobile | In `mobile`: `npm test -- --runInBand --watch=false --no-cache` | 124 passed, 17 suites; 3.51s Jest time |
| Mobile types/lint | In `mobile`: `npm run typecheck`; `npm run lint` | Exit 0 each |
| Python quality | `.venv/bin/ruff check src tests scripts`; `.venv/bin/ruff format --check src tests scripts` | Exit 0; 63 files formatted |
| Package | Clean `git archive HEAD` snapshot; `.venv/bin/python -m build --no-isolation <snapshot>` | sdist + wheel built; both SQL resources and new modules verified in wheel |
| Mobile bundles | In `mobile`: `npx --no-install expo export --platform ios --platform android --output-dir /tmp/biteflow-p01-export-final` | Both Hermes bundles exported, 3.1 MB iOS / 3.4 MB Android |
| Restore | `.venv/bin/python .superpowers/sdd/roadmap/restore_rehearsal.py` | SQLite backup and PostgreSQL pg_dump/pg_restore: exact ten-table checksum/count match; same receipt replay creates zero extra meals |

Nine backend skips are six browser tests (run separately), two optional Lite checks and one optional training smoke test. Current machine: Python 3.11.14, Node 26.7.0, PostgreSQL 16.13. CI specifies Python 3.11/3.12, PostgreSQL 17 and mobile Node 24; those hosted combinations were not run here. Dependencies were reused through local symlinks; no fresh `npm ci` was run locally. No native module/dependency was added.

## Build / native-device validation

Python packaging and both JS/Hermes exports passed. Fresh signed iOS/Android native builds, physical-device journeys, and screenshots of changed notice states in both languages: **NOT RUN**. Export is not a native-build or device result. Existing native permissions, entitlements and health/widget feasibility remain as recorded in P00.

## Photo/OCR/AI metrics

Real provider requests: **0**. Real token/cost/quota measurements: **NOT RUN**. The tests use synthetic inputs and mocked responses, including scripted retries/timeouts; these prove accounting behavior, not recognition quality or actual free-tier allowance. No new photo/OCR quality benchmark was performed in P01. No 500/350/150 budget has been asserted or enabled.

## Open defects and blockers

Independent whole-branch review found four Important issues and no Critical or Minor issues. All four were reproduced and fixed in one TDD pass; the complete suites pass afterward. [Review disposition](evidence/p01/review.md). Remaining environment/phase gates:

1. **Live AI activation blocked:** actual provider project/key binding, model/tier/billing/daily/RPM/TPM and conservative input-token bound need independent current evidence. Defaults remain disabled. External traffic sharing the project must be accounted for separately.
2. **Staging/hosted CI unverified:** only disposable local DBs were used. No staging or production operations were authorized/performed. PostgreSQL 17 hosted CI remains pending.
3. **Native/UI evidence unverified:** physical devices/signing/builds and notice-state screenshots have not been exercised in this checkpoint.
4. **Partial/tiny persistence gated:** legacy SQL constraints and readers remain unchanged. P02 must settle the explicit compatibility migration before enabling such writes.
5. **Historical limits:** previously deleted pre-P01 request IDs cannot be reconstructed. Lost in-memory AI results after a worker restart require an explicit new request instead of an automatic paid retry. Bad historical metadata is quarantined, retains its original values, and blocks owner readiness until reviewed.

## Rollback plan

See [p01-operations.md](p01-operations.md) for flags, migration/backfill, restore and limitations. Keep the compatible P01 backend with new writes/AI disabled and preserve additions/receipts/quota records. Do not downgrade to an old mutating backend that bypasses tombstones, drop schema additions, or recompute historical nutrition. Any real migration, data restore, deployment or live AI activation needs separate authorization.

## Review decisions

The [execution ledger](evidence/p01/progress.md) preserves rulings and RED→GREEN evidence. No deferred minor findings. The final reviewer did not re-review the fix commit; each accepted finding has a reproducing regression and the full suites were rerun.

Decisions retained for the next reviewer:

- New contracts preserve nulls/precision while persisted rows remain complete and within legacy quantity bounds. P02 must review widening.
- SQLite additions initialize after users; PostgreSQL migrations are explicit. Keep core schema version 1 plus independent foundation ledgers and owner predicates.
- Legacy first-write-wins remains; canonical/analyzed conflicting content and changed/deleted receipts return conflicts. Unknown pre-P01 deleted identities cannot be recovered.
- Critical draft durability blocks a send when disk writes fail. Caches remain best-effort; all logical draft operations capture ownership before async preflight.
- AI stays disabled without current verified policy. Uncertain calls remain charged; lost in-memory results need an explicit new request. A conservative token bound and other project traffic require real verification.
- Incomplete/quarantined backfill blocks canonical capabilities for that owner. No historical dates/values are guessed or repaired automatically.
- Local commits are the review units. Keep the managed worktree for review; no push, merge or production activation. Hosted CI, staging and device evidence remain unverified.

P02 prerequisites are **not all satisfied**. This handoff is for review, not release approval.
