# P03 local evidence — 2026-10-14

Product baseline: `3662048`; implementation `1c97a5f`, `d5c7394`, `3b19546`; review fix `2aa7b4d`. See [checkpoint](../../p03-checkpoint.md), [operations](../../p03-operations.md), [changed files](changed-files.txt), [review](review.md) and [ledger](progress.md).

## Commands and isolation

`commands.jsonl` preserves exact argv, working directory, duration and exit code, including failing intermediate runs. `run.py` is the archived runner (repository-root depth adjusted for its archive location). It strips ambient DATABASE_URL and FOODLOGGER_/GEMINI_/APPLE_/EXPO_ variables, sets an explicit loopback API URL, disables Expo telemetry and works offline. Backend tests reject real outbound HTTP transports in conftest; all provider responses are mocked.

PostgreSQL commands used a disposable loopback PostgreSQL 16 container `biteflow-p03-pg` and database `biteflow_p03_test`. Its local DSN file, database, SQL dumps, build bundles, dependency trees and credentials are deliberately absent from this archive. For a separately authorized local replay, create a fresh disposable test database and supply its DSN in an untracked `postgres-url` alongside the runner; never use an existing personal/staging/production database. `restore-goals.py` is specific to the named disposable fixture/container and rejects a non-loopback or differently named source. Run it from the repository root with the same isolated test environment. Recorded original commands reference the now-removed private execution directory; use the corresponding archived script for replay. Ordinary tests live in the product test directories.

## Final result index

| Evidence | Result |
|---|---|
| `postgres-p03c-suite.log` | 347 passed, 9 skipped; 16 real PostgreSQL cases included |
| `review-mobile-suite.log` | 161 passed, 28 suites, after final race fix |
| `browser-p03.log` | 6 passed, 350 deselected; actual local Playwright |
| `review-mobile-types.log`, `review-mobile-lint.log` | Exit 0; zero lint warnings |
| `p03-python-style.log`, `p03-python-format.log` | Exit 0; 67 files already formatted |
| `p03-package.log` | sdist/wheel built including goals SQL |
| `review-mobile-export.log` | iOS/Android Hermes JavaScript exported after final fix; no native build |
| `postgres-goals-restore.log` | Two exact private goal revisions restored; 2300/2500 dates preserved |
| `review-reload-race-red.log`, `review-reload-race-green.log` | Reproduced and fixed delayed selected-date reload race |

Archived logs have trailing whitespace and terminal blank lines trimmed for Git; result text and failure output are retained. Initial failures are retained. Examples include missing new modules during TDD, exact arithmetic boundary errors, a standalone AuthStore table dependency, stale/generated Expo route types, and pre-existing P02 format differences. The backend dependency/arithmetic errors were corrected; route types regenerated through local Metro; the P02 test file received format-only changes. A log whose name says “green” but has nonzero exit is still a failure; the manifest is authoritative.

## Native component preview: limited evidence

An **existing** SDK57 development binary (`io.github.ophbra22.foodlogger`) loaded current P03 component JavaScript in a newly created iPhone 17 Pro / iOS 26.5 simulator. This is not a new native build, physical-device check or complete app navigation test. `native-preview.tsx` records the synthetic harness: real DayDial, GoalDashboard, GoalSettings and GoalsStore, synthetic targets 2300 kcal/150 g protein and logged totals 2070 kcal/150 g protein; no AI, real account, photo or remote database. The preview Metro began before the final form race fix; final source passed the separate tests/exports above, but screenshots must not be used as evidence for that asynchronous fix.

- `p03_en_screenshot.jpg`, `p03_he_screenshot.jpg`: normal system text, English LTR / Hebrew RTL dial and calorie/protein cards, 90% calories and 100% protein.
- `p03_he_settings.jpg`: real manual goal form in Hebrew RTL with synthetic values.
- `p03_en_large.jpg`, `p03_en_large_scrolled.jpg`, `p03_he_settings_large.jpg`: maximum accessibility text setting. Visible production component text wraps; the harness's bare React Native header/buttons are clipped and are **not** production navigation. These images do not pass the full large-text gate.
- `p03_he_large.jpg`: failed useful dashboard capture after cold launch at maximum size; harness header occupies most of the viewport. Retained as an explicit limitation, not acceptance evidence.

Language forcing required restarting the test app; a development reload temporarily produced a blank view. Tool tap success did not always cause a screen change. Full keyboard/save navigation, VoiceOver/TalkBack, complete English/Hebrew large-text journeys and Android layouts remain unverified. No current P03 Android installation was attempted after P02's known disposable-emulator storage failure. The saved-meal UI has no edit screen; canonical API and store tests cover edits, not that missing UI journey.

Both owned Metro servers exited 0 after SIGINT. The disposable PostgreSQL container was stopped/removed, its restore database dropped, and only the newly created `BiteFlow-P03-Preview` simulator was shut down/deleted. Xcode tool defaults were restored; existing user simulators were untouched. No remote CI, migration, AI call, deployment, push or merge occurred.
