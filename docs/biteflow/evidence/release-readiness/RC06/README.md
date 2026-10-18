# RC06 evidence index

The checkpoint is ../../../release-readiness/RC06.md. `source-manifest.json` identifies33 changed implementation/test files ataf9993b. `command-index.json` contains55 executed command records, including nonzero attempts; check exit codes and feature flags, not command names. `test-counts.json` and `regression-comparison.json` report unique test definitions rather than adding repeat runs. `independent-review.md` identifies the immutable review range and later author fixes.

`native-lint-summary.json` deliberately says FAIL despite Gradle exit0. `widgets-lint-accepted.xml` contains0 own-widget findings after the final fix. `native-artifacts.json` records two local Debug-signed APKs and hashes. APK binaries, package build directories and credentials are not committed. Large raw logs/XML/JSON/resource dumps are gzip-compressed without altering decompressed contents.

`inherited-rc02-*` are copied earlier verification records, not RC06 scans or fresh vulnerability conclusions. All original gate/coverage rows remain; no inherited issue was silently closed. `rollback-result.json` proves byte restoration in an isolated temporary Git repository only. The first drill's enclosing-repository error and failed artifact attempts are preserved, including the real missing-Hebrew defect, optimized Release resource names and a call made before Release build completed.

Python helper files are records of the local harness; their paths/environment match the ignored runtime/rc06-20261018 location used during execution. Do not execute them in this documentation directory. Reproduction needs the recorded local toolchain and a newly owned disposable test database; never substitute production/staging credentials. Provider keys are stripped, tests use mocked providers and loopback test servers, and actual ML opt-ins were not enabled.

`archive-manifest.json` hashes every other file in this directory. Review-file whitespace may originate in raw logs and is preserved. Product/docs whitespace checks exclude byte-preserved raw evidence.
