# P01 evidence

Final implementation under test: `a702455` (baseline `9198d94`). Documentation-only commits after this do not change product code. All external AI transports were mocked; no production operations.

- `commands.jsonl`: exact command arrays, cwd, exit code, seconds. Nonzero RED runs are intentionally retained, along with intermediate failed quality runs and subsequent fixes.
- `progress.md`: decisions, slice results, review findings and disposition.
- `review.md`: independent whole-branch review; four Important findings fixed in one TDD pass; no second review.
- `postgres-review-full.log`: final backend + disposable PostgreSQL result and skip reasons.
- `browser-review-final.log`, `review-mobile-full.log`, `review-mobile-types.log`, `review-mobile-lint.log`, `review-ruff.log`, `review-format.log`: final respective checks.
- `review-export-final.log`, `review-package-final.log`, `review-restore.log`: final bundles, packaging and ten-table backup/restore evidence.
- `run.py`, `package_check.py`, `restore_rehearsal.py`: frozen execution sources. They ran from `.superpowers/sdd/roadmap` under the worktree; historical paths remain in the command log. To reproduce, first copy these sources back into that layout, supply local dependencies, and create a NEW isolated loopback PostgreSQL container matching the documented disposable fixture settings. The original container has been stopped/removed. Do not point reset/restore tests at real data. The runner removes inherited database/provider/Apple/Expo settings and sets source PYTHONPATH and a loopback mobile API URL.

PostgreSQL credentials in these frozen scripts are literal local throwaway test fixtures, not deployment credentials. Raw dumps were temporary and removed. The checksum logs contain counts and hashes, no raw account rows. No actual project quotas, live cost or recognition-quality results are inferred from mock inputs.

Local `.venv` and `mobile/node_modules` symlinks remain untracked for continuation; no dependency tree or production environment file was committed. The clean-source package check explicitly excluded them through `git archive`.
