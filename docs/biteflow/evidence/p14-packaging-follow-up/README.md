# P14 packaging follow-up evidence

2026-10-18 local verification of fix/tests at `fcc116db8287e58da9f6844ea2c36312d95157ae`, based on `d036aaa`. [Checkpoint](../../p14-packaging-follow-up.md). This is not release or observed-product evidence. Full P14 acceptance stays BLOCKED.

- `regression-red.*`: three expected failures against the original stale-path helper. Final tests additionally assert fresh generation on failure paths; that strengthening did not change the reproduced defect.
- `regression-green.*`: 77 passing packaging/measurement tests, including three new cases and two existing precision cases.
- `backend.*`: 660 passed, nine skipped; JUnit gives per-case outcomes. Includes 29 real owned PostgreSQL cases and 16 privacy cases.
- `browser.*`: six opt-in browser cases passed separately. Thus 666 unique Python passes; only three model smoke tests remain NOT RUN.
- `mobile.*`: 428 passed across 83 suites. `types.*`, `mobile-lint.*`, `python-lint.*`, `python-format.*`: passing commands and logs.
- `package.*`: the actual fixed committed helper built from `git archive fcc116d`, installed offline into a separate venv and validated its fresh output. `package-manifest.json` identifies retained ignored wheel/sdist paths, hashes, sizes and source/test trees. The build log contains expected byte-compilation-disabled warnings, not a failed build.
- `fresh-installed-report/`: actual installed no-data CLI output. All 22 metrics are missing/empty and acceptance is BLOCKED. No synthetic numbers are used in this smoke check.
- `follow-up-checks.*`, `follow-up-evidence.json`: independent cross-check within the executor's verification run: correct fresh path with old path absent, report contents/files, two installed precision probes, gate/register identity, original report reproduction, preserved P13 rollback APK/ZIP/bundle hashes and two reverse patch checks. Not a separate reviewer or physical rollback claim.
- `run.py`, `postgres.py`, `check-follow-up.py`: archived command helpers used in `runtime/p14-packaging-follow-up-20261018`. For replay, copy to a fresh owned `runtime/<new-name>` directory and adapt the recorded source/path references; the runner derives the repository root from that layout. The PostgreSQL helper uses a random owned local container, cached image only, loopback binding, a `_test` database, private credential file and matching-label cleanup. No secret is archived.
- `cleanup.log`: owned database and subsequent build-environment cleanup. Historical evidence under `../p14/` is retained, not overwritten.
- `raw-evidence-whitespace.*`: whole-range Git whitespace check exit 2 for raw log/generated-HTML whitespace, preserved as emitted. The authored source/docs/helper/JSON/XML check passes excluding raw `.log`/`.html` artifacts; this is a non-blocking evidence-format observation.

Native/hosted/physical/provider/real-data checks remain NOT RUN. No production, live AI, push, merge, deployment, collector or post-release metric claim. Reproducing the package helper requires a fresh owned `.superpowers/sdd/p14-plan` directory; never reuse or overwrite prior evidence. Read the checkpoint for all limitations and inherited rollback caveats.
