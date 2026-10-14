# P05 speech feasibility and dependency safeguard

Observed 2026-10-14. The app uses Expo 57.0.27 / React Native 0.86.3. `expo-speech-recognition` **57.1.1** is pinned in package/lock. Its npm integrity is recorded in the P05 evidence. No cloud STT, model download or recording persistence is implemented. Voice is off unless `EXPO_PUBLIC_VOICE_ENABLED=1` in a separately reviewed native build.

Primary sources read: [SDK 57](https://docs.expo.dev/versions/v57.0.0/), [speech package](https://github.com/jamsch/expo-speech-recognition), [published native API types](https://github.com/jamsch/expo-speech-recognition/blob/main/src/ExpoSpeechRecognitionModule.types.ts), [React Native AppState](https://reactnative.dev/docs/appstate), [Expo config plugins](https://docs.expo.dev/config-plugins/dangerous-mods/). Installed package source, not README claims, determined the safeguards below.

## Platform selection

- **iOS:** module podspec minimum 16.4; current local simulator runtime is 26.5. The package uses Apple's `SFSpeechRecognizer`. Recognition requires the selected locale's on-device support plus microphone permission. An unsupported recognizer must fail before audio capture; no network Speech permission is requested by the JS adapter. EN/HE permission descriptions are included for rebuilt apps. A binary without the safeguard constant is rejected by JS.
- **Android:** adapter requires API 33+ and an installed `en-US` or `he-IL` on-device locale reported by the recognizer. Package source selects `createOnDeviceSpeechRecognizer` at API 33+ with the mandatory on-device flag. Older Android versions, missing offline models or unavailable recognition fall back to editable text. No automatic model download.
- **Web / older native binary / feature off:** microphone adapter unavailable; text/manual remain available.

SDK support and mock tests **do not verify Hebrew or English transcription accuracy, real installed models, microphone routing, privacy traffic, interruption behavior or accessibility on a device**. Actual target-device transcription/correction/error evidence remains an open P05 acceptance gate. The regenerated iOS simulator compile succeeded (634 warnings, zero errors). Android compile exited 1 because Java is unavailable. These outcomes do not establish device behavior. Detailed results are in the checkpoint.

## Inspected upstream issue and narrow safeguard

Published 57.1.1 iOS code reports every supported locale as installed, checks on-device support for the default locale, and conditionally assigns the request's on-device requirement. That is insufficient to guarantee on-device-only behavior for the selected locale.

`plugins/with-on-device-speech.cjs` applies two reviewed changes to the pinned installed native sources during iOS prebuild: filter reported installed locales by each recognizer's on-device support; and reject unsupported on-device requests before preparing audio/request state. It also exports `biteflowOnDeviceGuard=true`. `native/speech.ts` refuses any iOS binary lacking that marker. The existing upstream request sets `requiresOnDeviceRecognition=true` after this native guard succeeds.

`plugins/speech-guard.json` records original/patched SHA-256 values and exact replacements. All files are validated before writes; repeat prebuilds are idempotent; unexpected version/source changes stop prebuild. This is a maintained dependency patch, not proof of physical-device privacy. Review it on **every dependency upgrade**. Do not bypass the marker, checksum or native guard to unblock a build. Reinstall the pinned dependency to recover original vendor files; prebuild reapplies the guard. Generated native projects are not committed.

## Lifecycle

Permission is checked for each user-initiated recording; a request occurs only when the OS permits asking. Denied/revoked/unavailable/error states leave text editable. Cancel/background/unmount invalidate pending permission and recognition callbacks, abort native capture and remove listeners. Stop waits for final transcript with a bounded timeout; recording is limited to 60 seconds. Raw audio is never requested as a persisted file (`persist:false`) and no audio URI is stored. A transcript is private account draft text and is editable before the same F06 parser/shared confirmation.

## Dependency installation and audit

`expo install expo-speech-recognition@57.1.1 -- --ignore-scripts` installed the package/lock but exited 1 because the dynamic app config needed a manual plugin entry; config/prebuild checks followed that edit. The original checkout's dependencies were not modified: this worktree uses an isolated copy during implementation.

Fresh `npm audit --json` returned **67 reported vulnerabilities: 17 moderate, 50 high, 0 critical** in both the baseline lock and the P05 lock. There are no newly named vulnerable packages in P05's report; the audit itself is **not passing**. These existing dependency advisories require separate triage and remain visible as a release risk. No blanket dependency upgrades were attempted in P05.
