# Biteflow TestFlight status — 2026-10-13

**Latest release: Biteflow 1.0.0 (3), including multi-food photo analysis and Sign in with Apple, is uploaded, processed (VALID / IN_BETA_TESTING for internal and external testing), and assigned to Personal and Biteflow Testers. The owner's user and Sapir's membership are verified. See [the meal-analysis release record](MEAL_ANALYSIS_RELEASE.md) for actual build/upload evidence, test limits and installation instructions.** The original build-1 record follows for history; [build 2's Apple sign-in release](APPLE_SIGN_IN_STATUS.md) is also preserved.

**Biteflow 1.0.0 (1) is uploaded, processed by Apple, and available to the Personal internal-testing group. Your account is invited. Installation on the physical iPhone remains user-side and has not been verified.** The Orbit design and app functionality have not been changed for this release preparation.

## Verified configuration

- Display name: Biteflow (previously FoodLogger).
- Bundle identifier: `io.github.ophbra22.foodlogger` (preserved).
- Marketing version: `1.0.0`.
- Version/build: `1.0.0 (1)`. EAS remote build counter initialized to 1 after verifying that the new Apple app record had no builds.
- Expo account: `ophir_braude`; account dashboard contained three unrelated projects and no FoodLogger project before setup.
- Created and linked exactly one Expo project: `244a63eb-e8cc-4c08-b1d8-2c18d84e7ff7`, https://expo.dev/accounts/ophir_braude/projects/foodlogger . Verified with `eas project:info`.
- Expo Free plan: dashboard showed 0 builds used, 15 iOS builds included. No upgrade or paid service was purchased.
- Production profile: store distribution, physical iOS device, no development client, automatic remote build-number increment, production environment, server override disabled.
- Configured backend: https://foodlogger-yfn4.onrender.com . This is the existing free Render service, not a new deployment.
- Apple team: `283L7984CA` (Ophir Braude, Individual). EAS validated the Apple session after the user completed two-factor verification directly in Terminal.
- Reused existing Apple distribution certificate `8T3RSF224V`; created app-specific active provisioning profile `5YLBD8VGJ4`. Both expire 2027-04-25. EAS confirmed all signing credentials are ready.
- Reused existing team App Store Connect API key `7LP2KWZBQA` and assigned it to this Expo project for EAS Submit.
- App icon is 1024×1024 RGB PNG with no alpha channel.
- `ITSAppUsesNonExemptEncryption` is already false. Verified false in the actual archive. Apple processing is VALID and internal status is IN_BETA_TESTING, with no pending export-compliance prompt.

## Backend deployment — verified live

The user approved publishing and deploying the backend update. Commit `85c6106b888c72238c8773d2c2c1d1068bdfc9de` is on `main`. GitHub workflow `38167480542` passed Python 3.11/3.12 tests, browser tests and the PostgreSQL/free-runtime checks. Local isolated checkout: 201 tests passed, 15 optional-environment tests skipped; lint and format checks passed.

Render deployment `dep-db5u3uavcj2c7399ev10` went live on 2026-10-11 at 22:23:43 Israel time, using the existing free service and database. No hosting plan changed.

Verified over public HTTPS with a disposable account:
- Health endpoint and account-deletion route.
- Registration and login return mobile bearer credentials.
- Authenticated account lookup.
- Meal saving and an identical retry create one meal (201 then 200).
- Journal retrieval and CSV export.
- Account deletion succeeds; both sessions are revoked and further login fails.
- Both disposable verification accounts were erased, including cleanup after an initial verification-script assertion expected the wrong duplicate-retry status. No app fix was needed for that assertion.
- No error-level Render logs were returned during initial post-deployment checks.

## Apple record and signing — verified

Checked existing App Store Connect apps and Developer identifiers before creating the missing matching records. Registered `io.github.ophbra22.foodlogger` under team `283L7984CA`, then created one Biteflow iOS record: Apple ID `6821706586`, SKU `biteflow-ios`, primary language English (U.S.). The production submission profile points to this exact record.

Created the Personal internal-testing group (`b06e89c0-a800-41e1-a756-4bb9bf1ea4a2`) and added the existing Account Holder user `ophbra22@gmail.com`. Verified 1 tester and 1 build after assigning 1.0.0 (1). Automatic distribution remains off. The existing user shows Invited on October 11, 2026.

## Build and upload — verified complete

EAS CLI 24.12.1 started production store build `fc9fea83-8d73-47f2-8e7c-1b89ccd8db49` on 2026-10-11 at 19:28 UTC. Finished successfully at 19:35:02 UTC. Version 1.0.0, build 1, physical device, intended bundle ID. Build URL: https://expo.dev/accounts/ophir_braude/projects/foodlogger/builds/fc9fea83-8d73-47f2-8e7c-1b89ccd8db49 .

Source snapshot includes the current uncommitted mobile work and release configuration. Git HEAD recorded by EAS is `68c0a1e89c237d4bc6cd95aa431a0164ce72b519`; that commit alone does not represent the entire uploaded source snapshot.

Downloaded and verified the actual IPA: Biteflow, expected bundle ID, version 1.0.0 (1), minimum iOS 16.4, non-exempt encryption flag false, live HTTPS URL in shipped JavaScript, correct Apple team, App Store provisioning (no device list; get-task-allow false), and strict deep codesign verification passed. Local archive: `runtime/testflight/Biteflow-1.0.0-1.ipa`.

Submission `c3c568d1-3146-471e-994a-ebce2e953ad2` FINISHED at 19:36:59 UTC (22:36:59 Israel time) for this exact build using the existing API key. URL: https://expo.dev/accounts/ophir_braude/projects/foodlogger/submissions/c3c568d1-3146-471e-994a-ebce2e953ad2 . EAS confirms upload completion. Apple subsequently reported processingState VALID and internalState IN_BETA_TESTING for the exact EAS build/submission IDs. Apple upload/build ID: `879d9662-9574-421e-af97-e1c14089eefc`. The build is assigned to Personal with testing notes saved. No outstanding signing, processing or export-compliance requirement is shown for internal testing. No public App Store review or release is authorized or initiated.

## Install on your iPhone — remaining manual step

The App Store Connect setup is done: Apps → Biteflow → TestFlight → Internal Testing → Personal contains the existing user and build 1.0.0 (1). Group URL: https://appstoreconnect.apple.com/teams/5dbbfa8c-7f0e-4e72-a371-f71b262b7888/apps/6821706586/testflight/groups/b06e89c0-a800-41e1-a756-4bb9bf1ea4a2 .

1. Install Apple's TestFlight app from the App Store on your iPhone (this Biteflow build requires iOS 16.4 or newer).
2. Open the TestFlight invitation addressed to `ophbra22@gmail.com` on the iPhone. Tap View in TestFlight, then Accept and Install for Biteflow.
3. If the invitation is not visible yet, check spam and reopen TestFlight. App Store Connect currently confirms Invited; actual email delivery and device installation have not been independently verified.
4. Launch Biteflow and test sign-in and saving a meal. The existing free Render backend was live-tested; a cold start can make the first request slower.

Proof: `screenshots/testflight/personal-invited.png` shows Personal with 1 tester, 1 build and Invited status.

Official guidance: https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/ and https://docs.expo.dev/submit/ios/ .

## Validation this session

- Mobile typecheck: passed.
- Mobile lint: passed.
- Focused backend mobile-authentication and account-deletion tests: 14 passed; full isolated backend run: 201 passed, 15 skipped. GitHub deployment checks passed.
- Live HTTPS mobile flows and disposable-account cleanup: passed.
- Expo project linkage and production configuration checks: passed.
- Signed distribution build: FINISHED; actual archive and signature verified.
- Upload: FINISHED, verified through EAS submit:view; submission ID above.
- Apple processing: VALID; internal state: IN_BETA_TESTING. No pending compliance or signing requirement shown.
- Personal group, own tester membership and build assignment: verified. Tester status: Invited. Physical iPhone installation: not yet verified.
