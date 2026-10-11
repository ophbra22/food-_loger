# FoodLogger mobile test report

Date: 11 October 2026. Branch: `mobile-app`. App: Expo SDK 57, React Native 0.86.

Every line below was run. Nothing is listed as passed that was not executed. Three kinds of
evidence are kept apart: automated tests, simulator/emulator runs, and physical devices.

## 1. Automated tests

| Suite | Command | Result |
|---|---|---|
| Backend (existing and new) | `pytest` | 172 passed, 37 skipped |
| Backend style | `ruff check`, `ruff format --check` | clean |
| App unit tests | `npm test` (Jest) | 82 passed, 7 suites |
| App types | `npm run typecheck` | clean |
| App lint | `npm run lint` | clean |
| Expo project check | `npx expo-doctor` | 21 of 21 checks passed |

The 37 skipped backend tests are the project's optional suites. They need Chromium (browser
tests), a disposable PostgreSQL database, the LiteRT wheel, or the TensorFlow training flag,
and were not run.

New backend tests (`tests/test_mobile_api.py`, 8 tests): bearer-token sessions without a
cookie or CSRF token; browser sessions keep cookie and CSRF protection; logout revokes only
that token; accounts stay isolated; recovery returns a new code and revokes old sessions; a
repeated `Idempotency-Key` creates one meal; a custom-meal retry keeps missing nutrients
missing; invalid keys are rejected; uploads accept bearer sessions.

App unit tests cover: input validation mirroring the server, portion maths with missing versus
zero, journal dates, draft rules and retry keys, the API client (bearer header, no cookies,
expired session, timeouts, error mapping, upload part format), both translation files (same
keys, same placeholders, Hebrew plurals, mixed-direction sentences), formatting of numbers,
dates and units, the journal store (offline copy, stale answers, delete), saving a draft, and
per-account separation of data kept on the phone.

## 2. Simulator and emulator runs

Devices: iPhone 17 Pro simulator (iOS 26.5) and Pixel 10 Pro emulator (Android 17 image),
both running development builds against the local backend with the real MobileNetV2 model
(TensorFlow 2.20). iOS was driven by taps; Android by a script that finds controls by text and
test id. Server-side effects were confirmed in the backend log and the SQLite database.

| Check | iOS Hebrew | iOS English | Android English | Android Hebrew |
|---|---|---|---|---|
| Register, recovery code shown once, confirm, enter journal | pass | not run | pass | not run |
| Sign in with existing account | pass | not run | not run | pass |
| Wrong password shows a translated error | not run | not run | not run | pass |
| Add a meal from the catalog and save | pass | not run | pass | pass |
| Add from a photo: real model, confirm suggestion, save | not run | pass | pass | not run |
| Photo with no confident match | not run | pass | not run | not run |
| Recognition unavailable on the server (503) | pass | not run | not run | not run |
| Barcode: real Open Food Facts product opens for review | not run | pass | not run | not run |
| Barcode: invalid check digit caught before any request | not run | not run | pass | not run |
| Barcode: product not found, offers manual entry | not run | not run | pass | not run |
| Manual entry saved; fat 0 kept as 0, empty nutrients stay missing | not run | not run | pass | not run |
| Manual entry: required-field messages | pass | not run | not run | not run |
| Camera permission denied, alternatives offered | not run | pass | pass | not run |
| Daily totals and dial update after saving | pass | pass | pass | pass |
| Still signed in, with data, after closing and reopening the app | pass | not run | pass (release APK) | not run |
| Previous day, empty day, back to today | pass (previous day only) | not run | pass | not run |
| Meal details and delete with confirmation | pass | not run | pass | not run |
| CSV export opens the system share sheet | pass | not run | pass | not run |
| Language switch: one reload, direction flips, still signed in | pass (to English) | pass (to Hebrew) | pass (to Hebrew) | not run (to English) |
| Unsaved draft survives the language switch | not run | pass | not run | not run |
| Sign out revokes the server session | pass | not run | not run | pass |
| Offline: banner, saved copy of the day with its time | not run | not run | not run | pass |
| Offline save fails, draft kept; retry after reconnect saves once | not run | not run | not run | pass |
| Session ended mid-save: notice, sign in, draft restored, saved once | not run | not run | not run | pass |
| Another account on the same phone does not see the draft | not run | not run | not run | pass |
| Text size 150%: home and forms reflow | not run | not run | not run | pass |

Notes on how some checks were made:

- **Photo recognition** used two rendered test images (a broccoli and a pizza slice drawn from
  an emoji font), not real photographs. The server's real model returned "recognized, broccoli
  90%" and "uncertain" for them. This proves the upload, the suggestion screen and both states;
  it says nothing about accuracy on real food photos.
- **Offline** was airplane mode on the Android emulator. iOS offline was not tested.
- **Expired session** was produced by deleting the session row in the test database.
- **Persistence after reopening** was checked by terminating and relaunching the iOS app, and
  by force-stopping and relaunching the release APK on Android.
- **The release APK** was installed on the emulator. Its built-in server address was changed
  from the sign-in screen, the connection check passed, and sign-in and the journal worked.

Not verified on simulators:

- **On-screen keyboard layout.** Both simulators ran with a hardware keyboard attached, so the
  software keyboard never appeared. Typing and validation were tested; whether the focused
  field and the save button stay above the keyboard was not.
- **Screen readers.** Accessibility labels, roles and states are set and were read back from the
  Android accessibility tree, but VoiceOver and TalkBack were not operated.
- **Pull to refresh.** A simulated drag did not trigger it on iOS. The day also refreshes when
  the screen or the app comes back into view, and that was verified.
- **A lost response after the server saved.** Covered by automated tests on both sides, not
  reproduced on a device.

## 3. Physical devices

None. No phone was connected during this work. The following need a real device:

1. Taking a photo with the camera and getting suggestions.
2. Live barcode scanning, including the torch button.
3. Denying camera access twice and using "Open Settings".
4. Typing with the on-screen keyboard open on the review screen.
5. Sharing the exported CSV to another app.
6. VoiceOver and TalkBack.

Steps for each are in the Hebrew guide, `mobile/README.md`.

## 4. Problems found and fixed during testing

| Problem | Fix |
|---|---|
| Photo upload failed with "Unsupported FormDataPart" (Expo's `fetch` does not accept `{ uri }` file parts) | Upload parts now expose `name`, `type` and `bytes()`; regression test added |
| A Hebrew sentence starting with a Latin product name rendered left-to-right | Sentences get a direction mark and isolate inserted values; test added |
| A food picked from the catalog after a failed recognition was labelled "suggested from your photo" | Catalog picks are always attributed to the catalog |
| "Breakfast" broke mid-word in the meal selector | Selector lays out two per row |
| Recovery code was hard to read in the display font | Shown in a fixed-width font |
| Add-meal button was oval | Fixed sizing so it is a circle |
| Extra blank band at the top of the add-meal sheet on iOS | Top safe-area inset no longer applied twice inside the sheet |
| Release APK failed Android lint (iOS-only strings written to Android resources) | Localized native strings split per platform |
| Journal did not refresh when returning to the screen | Day reloads on screen focus and when the app returns to the foreground |

## 5. Build artifacts

| Artifact | Built | Where |
|---|---|---|
| iOS development build (simulator) | yes | installed on the iPhone 17 Pro simulator |
| Android development build | yes | installed on the Pixel 10 Pro emulator |
| Android release APK (133 MB, all CPU types, test-signed) | yes | `mobile/dist/FoodLogger-test.apk` (not in git) |
| iOS build for a physical iPhone | no | needs an Apple ID and signing set up in Xcode |
