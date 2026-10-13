# Biteflow meal-analysis release — 2026-10-13

## Current status

Backend deployed and verified over public HTTPS. EAS iOS build **1.0.0 (3)** is
finished and the actual signed IPA verified. **Direct Apple upload succeeded**
at 14:55:11 UTC. At 14:59:04 UTC, App Store Connect confirmed **VALID** and
**IN_BETA_TESTING** for both internal and external testers. Build 3 is assigned
to existing groups **Personal** and **Biteflow Testers**, with the owner's user
and Sapir's membership independently verified. Test notes are saved.
No public App Store release or paid service was requested.

## Deployed backend

- Existing service: https://foodlogger-yfn4.onrender.com . Existing free Render plan.
- Source: merge commit `886b8b494c8388ea5d4d32ee743857ce72075888`,
  [PR 1](https://github.com/ophbra22/food-_loger/pull/1).
- GitHub PR and main CI passed: Python 3.11/3.12, browser, PostgreSQL and free-runtime.
  The free-runtime job reported 276 passed / 8 deselected, including 9 PostgreSQL tests.
- Render deploy `dep-db73rthsrm7s73bu6m90` became live at 14:20:56 UTC.
  Automatic deployment did not produce an event after the checks passed. A fresh
  deployment with the build cache cleared deployed the tested commit.
- Public HTTPS smoke passed at 17:25 Israel time: a licensed photo produced apple,
  almonds and spinach; analysis took 23.581 seconds. Editing to 100 g, recalculating
  totals, atomic save, identical retry, isolation, reference search and export passed.
  Both disposable accounts were deleted and sessions revoked.
- The **first production analysis attempt returned 503**. Its two disposable accounts
  were also removed. The second attempt passed; the first is preserved in
  `runtime/meal-analysis/deployed-api-attempt-1.json`. The exact provider failure cause
  was not exposed by the current production logs. This is not evidence of guaranteed
  availability. Free-tier upstream limits and temporary errors remain possible.
- Success evidence: `runtime/meal-analysis/deployed-api-smoke.json`.

## Mobile validation and source

- Jest: 107 tests across 13 suites passed. TypeScript and ESLint passed.
- iOS production JavaScript/Hermes export passed.
- Native iOS Debug build and launch passed on iPhone 17 Pro / iOS 26.5.
  The sign-in screen rendered with Orbit. Automated text/touch input did not work
  through either the native automation or simulator mirror, including taps on the
  system Home screen. The new native photo/edit/save UI flow is **not marked passed**.
  No camera or physical iPhone installation is claimed.
- Real recognition evaluation: final 8/8 licensed Nutrition5k photos completed;
  mean latency 20.67 seconds, 20/20 annotated visible components matched. This is a
  small sample, not a general accuracy guarantee. Earlier failed runs and a sauce
  misidentification on a separate challenge image are retained in the evaluation report.
- The build originally used an uncommitted mobile working tree; the build-time
  Git HEAD (`68c0a1e...`) does not represent all uploaded source. The release source
  is now checkpointed locally under Git tag `biteflow-testflight-1.0.0-3`.
  Before checkpointing, 104 mobile files matched the build's source manifest;
  only `mobile/README.md` had subsequent documentation changes. This checkpoint
  does not imply that the mobile branch has been pushed to GitHub.
  The build-time file hashes, excluding Git internals, are preserved in
  `mobile/docs/releases/1.0.0-3-source-sha256.json`. The original local manifest
  remains at `runtime/meal-analysis/mobile-source-manifest.json` (SHA256
  `0b38b8642c5859c30b764d574d907a637381f0932df7b35730a4c3ac6bacda40`).
- `.easignore` preserves root/mobile ignore rules and excludes local output, evaluation
  data, credentials, generated native folders and backend files. The inspected archive
  contains 145 files; the Google key and private credential files are absent.

## Build and delivery

- Existing Expo project `244a63eb-e8cc-4c08-b1d8-2c18d84e7ff7` and Apple app `6821706586`.
- Bundle: `io.github.ophbra22.foodlogger`; Apple team `283L7984CA`.
- Marketing version 1.0.0; remote iOS build number incremented from 2 to 3.
- Production profile: App Store distribution, physical device, HTTPS server above,
  server override disabled, Apple sign-in enabled, no non-exempt encryption declared.
- Existing remote distribution certificate and provisioning profile `5YLBD8VGJ4` reused.
  EAS verified the profile active; both expire 2027-04-25. No duplicate app was created.
- Expo Free allowance was verified before the build: 2 of 15 iOS builds used,
  upcoming bill $0; no plan upgrade was purchased.
- Build: [75116353-a9e1-4a27-a1a3-38abd5ed8ecb](https://expo.dev/accounts/ophir_braude/projects/foodlogger/builds/75116353-a9e1-4a27-a1a3-38abd5ed8ecb).
- Build finished at 14:33:44 UTC. Actual IPA verification passed: bundle/version/build,
  strict deep codesign verification, App Store provisioning, Apple sign-in entitlement,
  expected Apple team, minimum iOS 16.4, non-exempt encryption false, production HTTPS
  and both new analysis endpoints in the shipped JavaScript. The Google key is absent.
- IPA SHA256: `e912e0df6c0cc00a51cd01952d09f97937db290013b3c3adb1986e182ec8f629`.
  Evidence: `runtime/meal-analysis/ipa-3-verification.json`.
- EAS submission [5bd31300-e6a3-4e6b-ae62-6c2946818e4c](https://expo.dev/accounts/ophir_braude/projects/foodlogger/submissions/5bd31300-e6a3-4e6b-ae62-6c2946818e4c)
  was **canceled while still IN_QUEUE**, after Expo displayed an estimated 22.6-minute
  Free Tier wait. It did not upload the app. The existing Personal group was the
  requested target and automatic group creation was disabled.
- The first scheduling request, which included `--what-to-test`, was rejected because
  Expo limits that field to Enterprise plans. No submission was created by that request.
  The retry omitted the notes and successfully scheduled the same build, without a plan
  upgrade. That queued request was subsequently canceled as described above.
- Apple's installed `altool` 27.0.5 independently validated the exact IPA with no errors.
  After confirming EAS was CANCELED, `--upload-package` succeeded at 14:55:11 UTC with
  delivery UUID **`50eede60-444c-4fd1-b98d-e7a205077d5d`**. Apple acknowledged 22,290,984
  bytes transferred with no upload errors. The existing EAS-managed App Store Connect
  API key was reused; its restricted temporary file was removed after each command.
  No new key, service, app record or paid plan was created.
- Upload proof: `runtime/meal-analysis/apple-local-upload.log` and
  `apple-local-upload.json`; validation proof: `apple-local-validate.log`.
  `eas submit:status` links by version/build number, so any reference it reports to the
  canceled EAS submission is not evidence that EAS performed this upload.
- Existing group memberships independently verified through the App Store Connect API:
  own user in Personal; Sapir in Biteflow Testers. Build 2 is already IN_BETA_TESTING for
  internal and external testers. Build 3 notes were subsequently saved directly via
  Apple's API, with no Expo Enterprise subscription.
- Apple build ID: **`50eede60-444c-4fd1-b98d-e7a205077d5d`**. Final API verification:
  version 1.0.0 / build 3, processing VALID, internal IN_BETA_TESTING, external
  IN_BETA_TESTING, non-exempt encryption false, both group assignments present.
  Evidence: `runtime/meal-analysis/testflight-build-3-verified.json`.
- No outstanding signing, processing, beta-review or export-compliance requirement
  is shown for this build. The external group's public link remains disabled.
  No public App Store submission or release was created.

## Install and check on the iPhone

1. Open TestFlight, select Biteflow and choose **Update** (or **Install**) for **1.0.0 (3)**.
2. If Biteflow is not listed, accept the existing TestFlight invitation for the same
   email already assigned to the testing group. No duplicate tester needs to be added.
3. Sign in with the existing account. Pick a food photo or take one, review every
   detected component and its estimated portion, correct a quantity, confirm each
   food and save. Check the daily journal and totals.
4. Check camera permissions, Hebrew/English layout and Apple sign-in on the physical
   iPhone. Device installation and these physical-device checks remain user-side;
   this report does not claim they have been performed.

Personal group: https://appstoreconnect.apple.com/teams/5dbbfa8c-7f0e-4e72-a371-f71b262b7888/apps/6821706586/testflight/groups/b06e89c0-a800-41e1-a756-4bb9bf1ea4a2 .

## Provider and user-visible limits

Google's confirmed Free Tier project is used through the deployed backend. The app
does not require the owner's computer. The key remains in server configuration;
photos are disclosed as sent to Google, whose unpaid-service terms permit product
improvement and human review. There is no paid-provider fallback.

Portions and hidden ingredients remain estimates. Every component needs user review;
unmatched nutrition remains missing until the user selects a real reference or enters
values. Google quota errors and server errors preserve a manual-entry route.

For measuring the old Windows computer separately, see
[the Hebrew benchmark instructions](../../docs/LOCAL_VISION_BENCHMARK_HE.md) and
`output/Biteflow-PC-Benchmark.zip`. No speed has been measured on that computer.
