# P13 Android emulator observations

These are six narrow manual observations, not six automated tests or completed E2E-01–20 journeys. No physical-device or screen-reader acceptance is claimed.

Environment: owned blank `BiteflowP13` AVD, `emulator-5584`, Pixel 10 Pro profile, Android 17 preview / API 37, arm64. Local Release APK is the `2d0b3d6` mobile tree recorded in `manifest.json`; that tree is unchanged at final implementation `46b3a91`. It uses loopback API, debug signing and disabled unverified native integrations. The synthetic backend on `127.0.0.1:8765` had AI disabled, one local test account and one 150 g banana entry (133.5 kcal). Its process loaded before the final server pagination fix; the final server fix was independently exercised by the full Python/PostgreSQL/browser suites and packaged from `46b3a91`.

| Observation | Result and evidence |
|---|---|
| Native sign-in and Today | Observed successful synthetic-account sign-in and 133.5 kcal entry; no external identity/provider used. |
| English Settings export | Sensitive-data disclosure and explicit action visible in existing dark theme; `android-en-export.png` and `.xml`. |
| Explicit account export | Action opened the actual Android share sheet for an account JSON file; `android-export-share-sheet.png` and `.xml`. Cancelled with Back; no destination selected and no file/message sent. |
| English Trends values | Expanded seven dates: 133.5 kcal on one date, six unlogged dates with unknown energy, missing weight and no target; `android-en-values.png` and `.xml`. |
| Hebrew Settings | In-app language switch reloaded into Hebrew/RTL; disclosure/action visible; `android-he-export.png` and `.xml`. |
| Hebrew values with enlarged text | Set emulator `font_scale` to 1.3, reopened Trends after app recreation, expanded and scrolled values. All seven rows wrapped visibly without observed truncation; missing data remained unknown, not zero. `android-he-values-large.png` and `.xml`. |

Observed UI hierarchy came from Android `uiautomator dump`; screenshots came from `adb exec-out screencap -p` and were visually inspected. The archived `android_ui.py` helper selected exact visible labels and their observed bounds. Other operations used `adb -s emulator-5584 shell input swipe`, `shell input keyevent 4`, `shell settings put system font_scale 1.3`, and the app's observed navigation/deep links. API routing used `adb -s emulator-5584 reverse tcp:8765 tcp:8765`; package installation is in `android-install.log` and the command ledger.

Not verified: private-file erasure at OS level, recipient retention, file protection, TalkBack/VoiceOver, focus order under assistive technology, every supported OS/device/font size/theme, camera/speech/push/Health/widget lifecycle, offline recovery and signed distribution. Automated cleanup/session tests are separate evidence. iOS build attempts failed; no P13 iOS app or UI pass exists. The preview Android emulator does not establish compatibility with the supported production matrix.
