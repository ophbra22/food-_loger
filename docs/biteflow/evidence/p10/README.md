# P10 local verification evidence

Implementation: `f754beda346aec725f0cccb527a55308d1dc8c4b`; base `0bcfbaaa7f92b211d49f2bfb42f0180baa3ce2c3`; branch `codex/biteflow-p10`. No P11, live AI, real Health data access, production database changes, push/merge/deploy or signing portal changes.

[Checkpoint](../../p10-checkpoint.md) • [review and fixes](review.md) • [decision ledger](ledger.md) • [complete open gates](../../p10-open-gates.md) • [device protocol—not executed](../../p10-device-protocol.md)

## Final results

| Evidence | Result |
|---|---|
| `postgres-final.log` | 550 passed, 9 skipped, 0 failed; includes 27 actual PostgreSQL tests. 559 collected. |
| `browser-final.log` | 6 passed, 553 deselected, 0 failed. These run the six browser cases skipped in the full run. |
| `mobile-final.log` | 341 passed, 68 suites, no skips/failures. |
| `native-policy-reviewed.log` | 13 Swift policy checks passed; native batch compile in `native-batch-green.log`. |
| `types-final.log`, `lint-final.log` | TypeScript and mobile lint passed. |
| `ruff-full-final.log`, `format-full-final.log` | Ruff/format passed for src/tests/scripts; 100 files. |
| `package-clean-final.log`, `built-artifacts.json` | Clean `git archive f754bed` wheel/sdist passed; hashes and inclusion of Health service/schema checked. |
| `export-final.log` | iOS/Android/web Expo export passed. |
| `prebuild-final.log`, `pods-final.log`, `generated-capability.json` | Native generation/pods passed; Health capability and EN/HE purpose strings inspected. |
| `ios-debug-final.log` + `.gz` | Unsigned simulator Debug passed, 207.17s. |
| `ios-release-final.log` + `.gz` | Unsigned simulator Release passed, 205.01s. |
| `ios-device-release-final.log` + `.gz` | Unsigned iPhoneOS Release compiled, 111.14s; no physical execution/signing. |
| `postgres-recovery-expanded.log`, `rehearse.py` | Write pause/read preservation and local backup/restore preserved exact scope, stable identity, revision-2 tombstone, import receipt and tracking rows. |
| `android-native.log` | Command failed: Java Runtime missing. Android compilation BLOCKED. |
| `cleanup.log` | Owned Expo process/container stopped, only task-owned build scratch removed after archiving logs/hash evidence. |

Unique Python passes: **556**. Three optional model cases remain NOT RUN (two LiteRT, one TensorFlow). No other test pass is inferred. Native E2E-16/19/20, real HealthKit read/write/deduplication, signed builds, physical-device privacy/accessibility, live providers, hosted CI/staging and production validation remain NOT RUN/BLOCKED. No Python static type-check command is configured/run.

## Reproducibility and scope

`commands.jsonl` contains exact commands, cwd, exit codes and elapsed seconds. `run.py` sanitizes provider/production settings, sets offline Expo/local API configuration, and selects the owned PostgreSQL DSN only for `postgres-*` names. `postgres-url` contains an ephemeral loopback trust-auth test DSN, not a production credential. PostgreSQL 16 ran in owned container `biteflow-p10-local`, port 55420, database `biteflow_p10_test`; it was removed after checks. Tests deliberately recreate fixture schemas only in the disposable database. Recreate that isolated environment before using the recovery helper; never substitute a real environment. Hosted PG17 compatibility remains a separate gate.

Native compile commands used `EXPO_PUBLIC_HEALTH_ENABLED=1` only for these local generated builds and `CODE_SIGNING_ALLOWED=NO`. The source defaults remain off. Simulator/device-SDK binaries were not launched for Health access. `built-artifacts.json` identifies compiled executables and package hashes, not deployable signed artifacts. Generated ignored native directories remain available; no generated native source was hand-edited. The primary `mobile-app` checkout was left alone.

Large native logs are gzip-compressed without dropping output; their `.log` files point to the full archive and show the raw hash/final excerpt. `compressed-logs.json` lists raw hashes/byte sizes. `manifest.sha256` covers all retained evidence except itself. Source/test changes and final report are in Git; [changed-files.txt](changed-files.txt) lists the complete P10 diff.

## Failed/intermediate runs retained

Initial TDD failures are expected and preserved, not final successes. Other corrected issues include a backend route/service name collision, test URL corrections, stale generated Expo route types, lint formatting/state-update issues, test mock hoisting and AppState listener typing. `review-mobile-red.log`, `review-backend-red.log` and `review-lifecycle-red-2.log` reproduce actual review/lifecycle defects. `review-lifecycle-red.log` is a harness error, not product evidence. Later green/full logs supersede them. `native-batch-red.log` is the expected missing-validator compile failure. Android's missing-Java failure remains unresolved.

The 1,000-record mocked queue regression records 21 first-sync storage writes / 393,856 serialized ASCII bytes / 20 native batches; unchanged/restarted sync skips native replay and per-record persistence. It is not an on-device performance benchmark. No photo benchmark or provider quota was measured.

Captured stdout is preserved verbatim, including trailing whitespace in pytest/npm/Xcode output. An unrestricted Git whitespace check reports those raw-log lines; the source/documentation check excludes `*.log` and passes. No execution output was rewritten to hide a failure.
