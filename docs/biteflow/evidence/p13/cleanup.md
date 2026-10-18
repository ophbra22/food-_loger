# P13 local resource cleanup

Only resources owned by this P13 run were targeted. `teardown.json` records exact commands/results.

- Sent SIGTERM to the verified synthetic loopback server PID 47335; Uvicorn logged orderly shutdown. The runner recorded -15 (shell exit 241), an intentional teardown, not a failed functional test.
- Stopped owned Android `emulator-5584`; its process exited 0. The existing user AVD was untouched.
- Shut down and deleted only iOS simulator `542BC740-837C-4E6A-AC2D-7A498BB7D786` (`Biteflow-P13-Local`).
- Verified P13 label and exact ID, then removed disposable `biteflow-p13-postgres` and its anonymous volume. No other Docker resource or database was targeted.
- Cleared only the XcodeBuildMCP defaults established for this run; all defaults returned to null.
- Archived task briefs/results, the decision ledger, UI/fixture helpers and immutable review diff in this evidence directory. Final candidate packages remain under `runtime/biteflow-p13-candidate/`.

Owned scratch `.superpowers/sdd/p13-plan` was removed after the ledger/helpers/review evidence were committed. Verified the owned emulator, iOS simulator, PostgreSQL container and synthetic server are absent. Sibling phase directories, `.venv`, dependencies, the attached worktree, and local `codex/biteflow-p13` branch remain. The primary checkout stays on `mobile-app` at `9198d94`, with its existing untracked documents/screenshots/output/tmp untouched. No push, merge or deployment.
