# P02 execution evidence

Date: 2026-10-13. Code range: e961375..b9672d0, local branch codex/biteflow-p02. No live AI or production/staging changes. See ../../p02-checkpoint.md.

commands.jsonl contains actual commands/cwd/exit/timing; logs include failing tests and final successes. run.py is the archived sanitized runner with its root path adjusted for this archive. PostgreSQL commands require a fresh **disposable** local database whose name ends in `_test`, and a locally supplied `postgres-url` file beside the runner (not committed). Tests reset schema/roles; never point it at real data. The original throwaway container was removed. restore.py names that throwaway container explicitly and should only be reused after recreating it; it is evidence, not a production restore recipe.

photo-fixtures.json measures integrity/prepare_image only, not recognition. ios-startup-only.jpg is the real startup screen from current branch JS in an existing SDK57 debug binary, not a confirmation or completed E2E screenshot. Native device findings/limits are in the checkpoint. Raw logs include a failed PostgreSQL run caused by a disposable restore DB's role dependency, followed by a clean run after that fixture database was removed. Test RED failures are intentionally retained.

No fixture databases, backup contents, real credentials, provider keys, build bundles, packages or user photos are included. Ordered decisions/risks and deferred minors are in progress.md; final independent review findings in review.md.
