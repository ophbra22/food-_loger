# P13 rollback follow-up evidence

Base: `49141be841f114530fa606890f1d156e25a24d68`. Initial implementation: `581664748d2eb53426ec906514b7ece0775a61fc`; final implementation including review fix: `4d9778467d98562f7a5f61131f1ede31051cabc5`. Local-only follow-up, no P14.

`commands.jsonl` records exact commands, working directories, exit codes and wall times; named logs contain full output. `run.py` removes ambient service/provider configuration, disables Expo dotenv/telemetry/network mode, uses loopback API and default-off native capabilities. Tests mock provider/native boundaries; PostgreSQL uses only the owned disposable local fixture DB. Its random password is never part of committed evidence.

`api-red.log` and `mobile-red.log` are expected pre-implementation failures; subsequent targeted and full suites passed. These RED runs are not hidden or counted as final regression failures. The checkpoint distinguishes the main-suite skips, separately executed browser cases and three model cases not run.

`manifest.json` identifies the retained APK and source trees. `verify_artifacts.py` checks ZIP/hash/source integrity and uses the installed Hermes compiler to inspect the packaged flag/cleanup matcher. An initial manual invocation without `-b` failed to parse executable bytecode; the corrected `hermesc -b -dump-bytecode` and automated verifier succeeded. Bytecode inspection is static evidence, not a signed physical-device test.

The Android APK lives in ignored local `runtime/biteflow-p13-rollback-candidate/`; it is debug-signed and uses loopback, not a distributable store release. No iOS candidate is claimed. The existing full Android dependency lint and iOS toolchain failures, npm advisories and all external gates remain open.

See [checkpoint](../../p13-rollback-checkpoint.md), [compatible rollback procedure](../../p13-release-plan.md), and [complete inherited gates](../../p13-open-gates.md). Review/ledger/teardown records are retained here at handoff; original P13 evidence remains historical and unchanged.

Final `review-*` logs record the missing recovery-screen regression and fix: a native-fixture correction preceded the meaningful four-test RED; targeted24/full mobile428 then passed. Lint found two unnamed test mocks; the corrected final lint passed. `postgres-review-full.log` records 583 passes/9 skips after the fix. `rollback-android-final.log` and `artifacts-final.log` describe the rebuilt final APK, not the earlier package. `manifest-before-review.json` is historical.

Trailing empty lines in text logs/briefs were trimmed for repository whitespace checks; command output content/results are unchanged. The immutable review diff is retained as `review-49141be..7f1ff62.diff.gz`.
