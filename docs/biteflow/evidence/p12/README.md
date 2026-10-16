# P12 local verification evidence

All AI calls mocked/off; only disposable local database / synthetic loopback account. `commands.jsonl` is the exact command, cwd, return code and timing ledger. `run.py` strips provider/application env, pins loopback, disables dotenv/telemetry and isolates final native/Metro temp caches. Native build flags are enabled only for local artifacts; source defaults off. No hosted CI/production operations.

- `review.md`: one independent read-only review and four fixes; no second review claimed.
- `mobile-final.log`:402 tests /78 suites; `postgres-full-corrected.log`:566 pass9skip; `browser-retry.log`:6 pass. Combined unique Python572 pass3 optional-model skipped.
- Native XML records10 widget +12 existing Health JVM cases. Swift policy13 + capability3 checks; existing Health13 policy cases. Host checks are not physical device tests.
- `android-lint-full.log`: inherited Worklets analyzer crash; focused XML0 errors8 warnings. Transitive lint remains blocked.
- `ios-metadata-red/green.log` and install logs capture compile-vs-install difference. Native small/medium iOS and Android synthetic-data/placeholder screenshots are observations, not full E2E17/19/20 acceptance.
- Initial failed/malformed harness attempts remain recorded: lint3errors4warnings thenfixed; DBname suffix28errors thencorrected; browser startup2errors under concurrent native load thenall6passed; Swift/Kotlin/Jest red regressions; iOS module collision and stale derived products thencleanbuild; first extension installation missingCFBundleName thenfixed.
- Older test API URL was observed in cached Android Metro output despite loopback environment; isolated TMPDIR rebuilt it to loopback. Final artifact hashes/signing and exact scope are in checkpoint. No fixture sign-in was sent to the old address.
- `../../p12-device-protocol.md` is a future protocol, not executed evidence. All inherited gates remain in `../../p12-open-gates.md`.

Large build logs are gzip-compressed with readable tails; logs with trailing whitespace retain their original bytes in gzip and have whitespace-normalized readable copies; `.log.gz` is the complete output where present. Synthetic account responses/tokens, test database connection file, disposable DB/native simulator state and generated binaries are not committed.
