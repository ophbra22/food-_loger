# FoodLogger stabilization report

11 October 2026, Asia/Jerusalem. Branch `mobile-app`; base/current HEAD `68c0a1e`.
Changes are **uncommitted**, with no push or deployment. The working tree was clean at the
start. The earlier report is preserved as [historical context](TEST_REPORT_INITIAL.md);
its results are not carried forward as new passes.

## Changes and observed defects

- Kept Orbit, the combined journal/day screen, existing architecture and both languages.
- **iOS review keyboard:** reproduced Save being hidden below the software keyboard.
  The shared screen now accounts for the page sheet's offset in keyboard avoidance.
- **iOS pull to refresh:** a genuine native drag reached approximately −225 points but
  made no request. Fabric could attach the refresh control before the native scroll view
  existed. Attach after the first scroll layout, and remount the control when its date
  changes. Native pulls now show a spinner and fetch the selected date. Completion uses
  `finally`; stale/offline data behavior remains in the journal store.
- **Larger text:** changing iOS Dynamic Type while running could leave stale native text
  measurements. AppText recreates native text on font-scale changes. Nutrient fields use
  a font-scaled minimum width and wrap to one column when needed, preserving decimals and
  units. Default-size Orbit layouts remain unchanged.
- **Account deletion:** Settings → current password → destructive confirmation, in HE/EN.
  `DELETE /api/auth/account` accepts `{password, confirmation: "DELETE"}`. It requires the
  authenticated session, checks the current password, rejects extra targeting fields,
  preserves browser CSRF protection, and limits attempts. Meals, sessions, recovery
  credentials and the user row are erased in one transaction; other users remain intact.
- Deletion closes the live journal before clearing local data. Late refresh/draft writes
  cannot repopulate the erased account. Credentials, account cache/drafts, exported CSVs,
  and app-owned temporary ImagePicker/ImageManipulator copies are removed. Original photo
  library assets and copies already shared to another app are not removed.
- Wrong-password and network/server failures keep the deletion screen available. A retry
  with an already-revoked token signs out and cleans local data; it does not prove whether
  the earlier deletion or another session-revocation event caused the rejection.

### Database behavior

No destructive migration is needed. SQLite startup adds `meals_require_owner` to the legacy
meals table after creating users. This blocks an in-flight save from inserting after account
deletion. Deletion uses `BEGIN IMMEDIATE`, rechecks the password hash inside the transaction,
and rolls back all changes on failure. PostgreSQL uses its existing foreign keys plus a
parent-row lock. PostgreSQL integration tests were added but were **not run** in this environment.

## Environment and builds

- iPhone 17 Pro simulator, iOS 26.5, UUID `8F01840F-A297-4F53-B868-EFFB942FAEDE`.
  Native Debug/development build, Xcode 27, Expo SDK 57 / React Native 0.86.3; final JS
  supplied by Metro. Normal simulator signing is required for Keychain. An initial build
  with `CODE_SIGNING_ALLOWED=NO` failed the sign-in storage step; normal signing resolved it.
- Pixel 10 Pro emulator, Android 17 / API 37, arm64, initially the existing 6 GiB AVD.
  Development builds were used first, followed by standalone release APKs. The existing
  AVD ran out of installation space. Only the disposable FoodLogger installation was
  removed; unrelated apps/data were preserved. Final installation used separate data files
  under `runtime/android-stabilization`, with 8 GiB storage, using the same device/system image.
- Isolated local FastAPI backend: `runtime/stabilization.sqlite3`, with real MobileNetV2 /
  TensorFlow 2.20 available. The existing development database was not used for deletion.
  Disposable accounts only: `ios_he_stab`, `ios_en_stab`, `android_en_stab`, `android_he_stab`,
  and `android_final`. The first four were deleted through UI; subsequent valid login
  requests for all four returned **401**. `android_final` remains as a local test fixture.
- Current Mac Wi-Fi IP verified as `192.168.68.61`. iOS used `localhost:8000`, Android debug
  used `10.0.2.2:8000`, release used the LAN address. No production service was changed.

## Automated results

| Check | Result | Detail |
|---|---|---|
| Backend, browser and TensorFlow smoke suites | **Passed** | 207 passed, 9 skipped, 786 dependency warnings; 26.06 s |
| Backend Ruff lint and formatting | **Passed** | 32 files formatted; lint clean |
| Mobile Jest | **Passed** | 91 tests, 10 suites; 1.812 s |
| Mobile TypeScript | **Passed** | `npm run typecheck` |
| Mobile ESLint | **Passed** | `npm run lint` |
| Expo Doctor | **Passed** | 21/21 checks |
| Patch whitespace | **Passed** | `git diff --check` |
| PostgreSQL integration | **Not run** | 7 skips: no disposable PostgreSQL URL; Docker daemon unavailable |
| LiteRT real-runtime smoke | **Not run** | 2 opt-in skips; optional LiteRT wheel unavailable |

Backend command:

```bash
FOODLOGGER_RUN_BROWSER_TESTS=1 FOODLOGGER_RUN_ML_TESTS=1 .venv/bin/pytest -q -rs
```

Playwright Chromium and psycopg were installed into the development environment to execute
previously skipped independent tests. The TensorFlow training opt-in ran. Warnings are chiefly
Keras/NumPy deprecations; they are not asserted to be resolved.

Deletion tests cover unauthenticated requests, wrong passwords/confirmation, forbidden target
injection, browser CSRF, owner isolation, all bearer/browser sessions, rejected login/recovery,
transaction rollback, a password-change race, a late save, and repeated deletion. Mobile tests
cover successful cleanup, 403/network/503 retention, revoked-token retry, late cache/draft
writes, private-file selection, and deferred refresh attachment. The refresh unit test is
supplemented by the actual simulator gestures below.

## Current-run platform/language matrix

**Passed** means executed in this stabilization run. These are separate checks, not a claim
that every screen and every edge case was exercised. Initial matrix runs used development
builds; Android English registration/recovery/sign-in, saving, sharing and deletion also ran
on a release APK. After the final layout/cache changes, relevant larger-text review screens,
installation, launch, data persistence and iOS native deletion cleanup were repeated.
The entire matrix was not repeated on every intermediate binary.

| Check | iOS HE | iOS EN | Android HE | Android EN |
|---|---|---|---|---|
| Register, show and confirm recovery code | Passed | Passed | Passed | Passed |
| Sign in | Passed | Passed | Passed | Passed |
| Recovery, replacement code, continue to journal | Passed | Passed | Passed | Passed |
| Manual entry and review, decimal amount/nutrients, save | Passed | Passed | Passed | Passed |
| Daily totals after save | Passed | Passed | Passed | Passed |
| Signed-in data after restart/relaunch | Passed | Passed | Passed | Passed |
| Previous/empty day and return to today | Passed | Passed | Passed | Passed |
| Meal details | Passed | Passed | Passed | Passed |
| Delete meal with confirmation | Passed | Passed | Passed | Passed |
| CSV opens native share sheet | Passed | Passed | Passed | Passed |
| Switch to other language with unsaved meal | Passed | Passed | Passed | Passed |
| Sign out | Passed | Passed | Passed | Passed |
| Account deletion and signed-out screen | Passed | Passed | Passed | Passed |

For manual entry, values per 100 g were 46.5 kcal, 1.2 protein, 6.7 carbohydrate and **0 fat**;
125.5 g produced 58.4 kcal, 1.5/8.4/0 g in details, and rounded 58 kcal on the day screen.
The UI and isolated database agreed. Keyboard dismissal and language reload retained inputs.

### Software keyboards and text size

Software keyboards were explicitly enabled on both platforms; Android stylus handwriting was
disabled to exercise Gboard's actual keys. iOS's password suggestions sometimes required
closing the native suggestion and toggling the software keyboard after focus. Tests did not
count hidden hardware-keyboard typing as keyboard-layout verification.

| Keyboard-open screen | iOS HE | iOS EN | Android HE | Android EN |
|---|---|---|---|---|
| Sign-in | Passed | Passed | Passed | Passed |
| Registration | Passed | Passed | Passed | Passed |
| Recovery, scroll to action | Passed | Passed | Passed | Passed |
| Manual review, numeric/decimal fields and save | Passed | Passed | Passed | Passed |
| Larger-text review and reachable save | Passed | Passed | Passed | Passed |
| Larger-text sign-in | Not run | Passed | Passed | Not run |
| Larger-text registration/recovery | Not run | Not run | Not run | Not run |

Larger text was Android `font_scale=1.5` and iOS `accessibility-large`, subject to the app's
existing text caps (1.8, display 1.3, inputs 1.6). This is not verification of every possible
accessibility size. The live iOS size-change defect was reproduced and retested after the fix.
Forms scroll; the fixed review footer remains above the keyboard. Hebrew required-field
validation was also exercised at accessibility size. No landscape support is claimed.

### iOS refresh and resilience

| Check | Language | Result | Evidence |
|---|---|---|---|
| Populated-day downward pull: spinner and successful request | HE | Passed | Native drag + backend GET |
| Populated-day failure: spinner ends, stale notice | HE | Passed | Injected GET 503 + screenshot |
| Empty selected day: downward pull requests that date | HE | Passed | Repeated GET for 2026-10-10 |
| Empty-day spinner and success after cold mount | EN | Passed | 8-second delayed GET + spinner screenshot |
| Empty-day failure ends cleanly | EN | Passed | GET 503 + screenshot |
| Return from Settings preserves selected date and refreshes | EN | Passed | Two GETs for selected 2026-10-10 |
| Background to Home, reopen via app icon | EN | Passed | Date stayed October 10; matching GET count rose 11 → 12 |
| Connection unavailable during save | EN | Passed | Local server stopped; failure notice and draft retained |
| Session expires during save | EN | Passed | Token revoked at POST; 401 and translated session notice |
| Another account cannot see that unsaved draft | EN | Passed | Second account empty; original draft restored on signing back in |
| Retry after reconnect/re-authentication | EN | Passed | Exactly one `Resilience meal` in SQLite |
| Server commits, but client receives 503; retry | EN | Passed | Exactly one `Keyboard decimal` after repeated POST |
| Actual TCP response dropped after commit | — | Not run | The last test substitutes 503, not a dropped TCP packet |
| iOS resilience scenarios repeated in Hebrew | HE | Not run | English device runs plus shared unit tests only |
| Android resilience suite rerun in this phase | HE/EN | Not run | Historical report is separate; automated regressions ran |

`mobile/scripts/stabilization_server.py` supplies test-only delays/failures against the isolated
SQLite file; the control file is now `{}`. Stopping the server tested connection failure,
not iOS radio/airplane-mode behavior. Native share sheets opening does not establish that a
recipient app received or correctly parsed the CSV.

### Native deletion cleanup verification

The final iOS English deletion included an unsaved draft and an exported CSV. Disposable
marker files were placed in the app's ImagePicker/ImageManipulator cache directories and in
the UUID-image location. After UI deletion the app showed Sign in, the user row was absent,
and all these markers and the CSV were absent from the native cache directory. These were
filesystem cleanup markers, **not food photographs or recognition evidence**.

## Screenshots

The [stabilization folder](screenshots/stabilization) contains captured device pixels. Useful
pairs and representative keyboard-open states:

- iOS sheet: [before](screenshots/stabilization/ios-he-review-keyboard-before.png),
  [after](screenshots/stabilization/ios-he-review-keyboard-after.png).
- Final larger-text review: [iOS Hebrew](screenshots/stabilization/ios-he-large-review-keyboard.png),
  [iOS English](screenshots/stabilization/ios-en-large-review-keyboard.png),
  [Android Hebrew](screenshots/stabilization/android-he-large-review-keyboard.png),
  [Android English](screenshots/stabilization/android-en-large-review-keyboard.png).
- Registration: [iOS English](screenshots/stabilization/ios-en-register-keyboard.png),
  [Android Hebrew](screenshots/stabilization/android-he-register-keyboard.png).
- Recovery: [iOS Hebrew](screenshots/stabilization/ios-he-recovery-keyboard.png),
  [iOS English](screenshots/stabilization/ios-en-recovery-keyboard.png),
  [Android English](screenshots/stabilization/android-en-recovery-keyboard.png).
- Refresh: [empty-day spinner](screenshots/stabilization/ios-en-empty-refresh-spinner.png),
  [empty-day failure](screenshots/stabilization/ios-en-empty-refresh-failure.png),
  [populated-day failure](screenshots/stabilization/ios-he-refresh-failure.png).
- Resilience: [connection failure](screenshots/stabilization/ios-en-offline-save.png),
  [expired session](screenshots/stabilization/ios-en-session-expired.png).
- [Hebrew password check](screenshots/stabilization/ios-he-delete-account-keyboard.png).

Files labelled `before` document earlier behavior and are not final verification. The Hebrew
empty-day image shows the completed state, not a spinner. Screenshots are evidence of selected
states, not proof of the entire matrix.

## Actual generated artifacts

- Android standalone test APK:
  `/Users/braude/Documents/projects/food-_loger/mobile/dist/FoodLogger-test.apk`
  (about 127 MiB, debug-key signed release variant, server override enabled).
  SHA-256: `20699b22fb834dead9144a54e8ec3f77113f28f408ffa53e60ed133cbdb3bc74`.
  Installed and launched on the isolated emulator. Sign-in, real save, and restart persistence
  were checked; final APK updates retained the test account and journal.
- iOS arm64 simulator development app:
  `/Users/braude/Documents/projects/food-_loger/mobile/dist/FoodLogger-simulator.app`
  (about 153 MiB). Built successfully with normal simulator signing, installed and launched.
  Requires the project's Metro server; not a standalone iPhone IPA.
- Xcode workspace:
  `/Users/braude/Documents/projects/food-_loger/mobile/ios/FoodLogger.xcworkspace`.
  Native directories and `dist` are generated/ignored. They exist locally but will not appear
  in a commit unless separately packaged. No store-signed build was produced.

## Physical devices and remaining checks

**Not run:** no authorized physical Android phone or iPhone was available. `adb devices`
listed only the emulator. `devicectl` listed two unavailable iPads and simulators. The local
Keychain exposed an Apple Distribution identity, not a verified development signing setup.
No device installation, paid service, store publication, push or production change occurred.

Use the [updated Hebrew setup guide](../README.md), then test on both a real Android and iPhone:

1. Reach the local backend using the computer's current LAN IP; check Local Network access.
2. Capture a real food photo and select another from the library. Record upload/processing
   success separately from recognition correctness; record actual food, suggestion and result.
3. Scan a real barcode with camera movement, focus and poor light; test torch and manual fallback.
4. Deny camera/library permission, recover it in Settings, and retry.
5. Run HE/EN forms with real software keyboards and larger text, including registration/recovery;
   operate VoiceOver/TalkBack separately (not run here).
6. Share CSV to Files and another installed app, then inspect its contents.
7. Disconnect/reconnect the phone, retry a save, switch accounts, restart, and verify no duplicates
   or cross-account data. Delete only a disposable account and check a second device loses access.

Real-camera quality, live-barcode reliability, real-food recognition accuracy, recipient CSV
handling, device signing and the skipped database/runtime suites remain unverified. Previously
rendered emoji images are not evidence of recognition accuracy. The app is ready for these
hardware checks; it is not described as fully verified.


## Sign in with Apple validation — 2026-10-11

- Mobile typecheck/lint passed; 11 test suites and 100 tests passed.
- Apple proof tests verify nonce/state, incomplete responses and cancellation. Account-flow tests verify linking preserves credentials/journal/drafts, conflict handling, successful deletion cleanup, and preservation after revocation failure.
- Backend local suite: 216 passed / 16 optional tests skipped; 15 focused Apple tests passed. GitHub runs 38170476004 and 38170620687 passed, including real PostgreSQL concurrency and free-runtime checks.
- Live HTTPS password/session/meal/export/deletion flows passed, and the disposable account was removed. Live Apple challenge configuration, invalid-token rejection, replay rejection and authenticated-only linking/deletion passed.
- Signed build 1.0.0 (2) and its Apple entitlement, provisioning profile, signature, backend URL and export-compliance flag were verified in the actual IPA.
- Actual Apple authentication on a physical iPhone remains a user-side check. Release status is tracked in `APPLE_SIGN_IN_STATUS.md`.
