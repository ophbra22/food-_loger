# P05 evidence index

Local work only, 2026-10-14; product base `3e96392`, final product `18c84a2`. All providers mocked, no production/hosted operation. The [checkpoint](../../p05-checkpoint.md) is the acceptance report; [operations](../../p05-operations.md) gives rollback.

- [commands.jsonl](commands.jsonl): exact commands, cwd, exit codes and durations. Names ending “green” do not override failed exit statuses. Matching `.log` files retain intermediate failures and reruns; trailing whitespace and empty EOF lines are normalized for Git, without changing result text.
- [run.py](run.py): environment-clearing command harness. Credentials and disposable database URL are deliberately excluded from this archive. Create a fresh disposable `_test` database before reproducing PostgreSQL runs.
- [postgres-p05-final.log](postgres-p05-final.log): **395 passed / 9 documented skips** with real disposable PostgreSQL 16 enabled.
- [mobile-p05-final2.log](mobile-p05-final2.log): **212 passed, 41 suites**; [browser-p05-final.log](browser-p05-final.log): **6 passed**. Backend tests globally reject real HTTPX transport.
- [review.md](review.md): independent read-only review, five Important findings and one fix pass; associated RED/GREEN logs are retained. Reviewer did not independently rerun the full suites.
- [progress.md](progress.md): ordered rulings, costs and deferred gate disposition, archived before scratch cleanup.
- [native-build-summary.json](native-build-summary.json), [ios-build-final.json](ios-build-final.json): actual regenerated iOS compile success, **634 warnings / 0 errors**. Build diagnostics are not device transcription or privacy evidence. Prior initial build result is also retained.
- [speech-permissions-green2.log](speech-permissions-green2.log), [speech-b-plugin.log](speech-b-plugin.log): effective native permission checks for both flag states and pinned patch fail-closed/idempotence tests.
- [voice-export-final.log](voice-export-final.log): both final Hermes bundles; [package-p05-final.log](package-p05-final.log): final wheel/sdist.
- [android-native-build.log](android-native-build.log): actual failed compile attempt, missing Java runtime.
- [speech-package.json](speech-package.json): observed exact package version/integrity; baseline/current audit logs retain **67 advisories** each, exit 1. No clean dependency audit claimed.
- [changed-files.txt](changed-files.txt): product change paths; [cleanup.json](cleanup.json): owned resource cleanup and preserved worktree/dependencies.

Metro logs belong to deliberate local route-type generation servers. Their runners were interrupted during cleanup; no successful server-test completion is implied. The `--forceExit` diagnostic runs only isolated a Jest AppState test-boundary problem; final full mobile tests passed **without forceExit**.

No raw audio, private user meal data, provider credentials, database credentials, production environment values, generated bundles/binaries, node_modules, DerivedData or held-out recognition metrics are archived. Native microphone and full mobile E2E gates remain open. Original uploaded requirements and earlier-phase evidence are unchanged.
