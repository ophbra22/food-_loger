# P07 reproducible local evidence

Read [checkpoint](../../p07-checkpoint.md), [review](review.md), [ledger/rulings](ledger.md), [open gates](../../p07-open-gates.md) and [operations/rollback](../../p07-operations.md). This directory contains actual outputs, including expected TDD failures and unsuccessful intermediate checks. File names containing `green` or `final` are labels, not success claims: inspect `commands.jsonl` exit codes. Latest verified application code is `758918cb849ee9782060de55808563a3d53027cf`; following commit changes documentation/evidence only.

## Final results

- `postgres-final.log`:467 passed/9 skipped (444 regular+23 PG). `browser-reviewed.log`:6 passed/470 deselected. Unique Python473 passed/3 optional model tests NOT RUN out of476.
- `mobile-reviewed.log`:263 passed/53 suites; zero failures/skips. `types-reviewed.log`, `lint-reviewed.log`: exit0, lint no warnings. `ruff-final.log`, `ruff-format-final.log`:pass,87 files.
- `export-reviewed.log`:all Expo platforms passed after fixes. `package-candidate.log`:wheel+sdist passed; no backend source changes after this package check.
- `ios-native-build.log.gz`:actual simulator Debug native build passed, not device or release signing. Decompress to inspect; `ios-native-build.log.sha256` validates original bytes. Review fixes only change TypeScript, covered by final Hermes export.
- `android-native-build.log`:FAIL, missing Java Runtime. This is an open blocker.
- `postgres-recovery-final.log`:permission-down/read/write-denial/re-enable/dump-restore assertions pass in disposable PG16.
- `preview-reviewed.log`:two EN/HE browser component scenarios pass, no runtime errors. PNGs capture real React Native web components with synthetic fixtures, not a full authenticated app/device journey. Harness does not load the production app font; fallback font is visible.
- `query-performance.log`:12,000 synthetic meal rows/20 runs over60dates, median2.998ms/max3.347ms. Not a hosted/production load benchmark.
- `environment.json`:Python3.11.14,Node26.7.0,npm11.19.0,Xcode27.0,SupabaseCLI2.98.1; CI's Python3.12/Node24/PG17 matrix was not executed here.
- `commands.jsonl`:exact command arguments/cwd/exits/durations; failed setup and intermediate lint/type/mock cases are retained. `changed-files.txt` includes all changed paths; `commits.txt` lists four implementation commits and their paths. The final documentation commit is identified in the handoff.

## Reproduction boundaries

Use the repository's existing installed dependencies. `run.py NAME AREA COMMAND...` sanitizes inherited FOODLOGGER/GEMINI/APPLE/EXPO and DATABASE_URL values, sets CI/offline/loopback values and writes logs. It does not independently firewall arbitrary executables; Python tests block real HTTPX transport through their autouse fixture. All provider behavior in P07 tests is mocked/off.

For PostgreSQL commands, create an isolated throwaway database yourself and place its loopback DSN in a local `postgres-url` file (excluded from this archived evidence). Tests reset that explicitly named test schema. **Never point this at production/staging or a database with user data.** `rehearse.py` additionally asserts the owned `biteflow_p07_test` database and `127.0.0.1`, and uses named `biteflow-p07-local`/`biteflow_p07_restore_test` disposable resources. Fixture-only passwords in that script are not credentials. Owned resources were removed after execution; prior unrelated local Docker containers were not touched.

For component previews, temporarily copy `preview.tsx` to `mobile/p07-preview.tsx`, start offline Metro on8917, then run `preview.py`. Remove that temporary file and stop only your Metro process afterwards. `generate-fixture.py` generates the committed synthetic trends fixture. Screenshots explicitly label the component fixture preview; neither them nor simulator compilation closes physical E2E/accessibility.

Scratch native build/export files were removed after preserving logs. Branch/worktree and installed dependencies are retained, including the pre-existing `.venv` symlink. No pushes, merges, deploys, hosted migrations or live AI calls. Full acceptance remains BLOCKED; P08 has not started.
