# BiteFlow TestFlight preparation for RC12–RC15

Base: e7a5bf49e35d866c05af4aefafcf951da95983ba. Branch: codex/biteflow-testflight-rc12-15.
Authority: user requests a new TestFlight beta for physical RC12–RC15 tests; existing release-readiness roadmap Tasks12–15 and all inherited gates remain binding. This is beta preparation, not RC12–15 acceptance or production release.

## Constraints
Reuse existing EAS project, Apple team, app and bundle ID. The user selected a separate staging environment in Render My Workspace and subsequently requested working AI in the beta. All automated tests remain mocked; activating AI requires verified project/tier/quota and permitted input scope. No paid upgrade or spend is authorized. No production writes/deployment, repository push, merge, migrations against shared data or public release. A separate staging deployment is authorized once its source and infrastructure prerequisites are satisfied. Signed upload is only to the existing TestFlight app after the candidate is locally verified and its test backend and credentials are resolved. Never expand tester groups automatically.

## Task 1: Native packaging and dedicated beta profile
Declare the existing WidgetKit extension to EAS before prebuild; retain cleanup entitlements even with widgets disabled. Match extension marketing/build versions to the main app after EAS version injection. Write real config/Xcode project regression tests before fixes. Add an explicit beta profile for iOS speech, Health, widgets and reminders, using the existing app identifiers and a test backend only. Validate effective config and generated project. Commit locally.

## Task 2: Backend/session isolation and device handoff
Use the separately authorized staging environment. Prevent old sessions or a persisted production override from contacting production in the beta. Reuse existing architecture, mock external AI in tests and retain compatibility data. Prepare the smallest isolated test-server setup needed for RC12–15 and device checklist. Test startup and isolation with synthetic data. Keep deployed AI disabled until its policy and permitted input scope are verified. No real notification delivery until a test device is registered and a bounded test is selected.

## Task 3: Verify, review, build and handoff
Run current mobile suite, types, lint and relevant backend/native tests. Inspect the exact generated entitlements and embedded extension versions. One independent whole-change review, fix confirmed important issues with regressions. Record commands/counts and unrun checks. Use existing EAS credentials and an exact candidate ID if build/submit prerequisites are satisfied; distinguish build success, upload, processing and availability. If an external prerequisite remains unavailable, finish all independent work and name the exact missing input. Keep every inherited gate and rollback floor e70f17a; preserve cleanup, compatible readers, pending requests, receipts and leases.

## Review focus
Effective EAS config versus generated native target; remote version increments; widgets-off cleanup; production URL overrides, legacy sessions and cross-server credentials; artifacts uploaded to EAS must exclude credentials/local logs; native entitlements are not proof of device execution; stop/drain and Health/widget cleanup survive rollback.
