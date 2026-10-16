# P12 — native home-screen widgets, local design

Authorized scope: approved F18 / roadmap P12-A/B/C only, from P11 `a2fac88`. All inherited gates/rollback caveats remain. No P13, AI calls, production, push/merge/deploy, signing portal or store operations.

## Capability review before implementation

No widget target/module/snapshot exists. Expo57.0.27/RN0.86.3, Xcode27.0 and Android Studio bundled JDK21.0.10 / installed SDK are available. Existing iOS app16.4+ and Android24+ floors stay. Native generators own ignored ios/android output. Existing Release Android signing is debug; iOS App Group provisioning/device signing unverified.

Evaluated official SDK57 expo-widgets documentation and the SDK-pinned 57.0.23 npm archive (SHA1 352c453847ff0bd7d368e130f1aecd8cd780ddea). `ios/WidgetsStorage.swift` stores layout/timeline props in App Group UserDefaults; `WidgetObject.swift` reloads WidgetKit after writing. Our strict protected-file/account-generation contract would require additional native control. Choose a small tracked WidgetKit extension + local Expo bridge and Android RemoteViews AppWidget, avoiding a second runtime and extra npm dependency. Cost: native source/config maintenance. This is implementation judgment within the already approved F18 design, not a new phase.

Sources: https://docs.expo.dev/versions/v57.0.0/sdk/widgets/ ; https://docs.expo.dev/modules/module-api/ ; https://developer.apple.com/documentation/widgetkit/creating-a-widget-extension ; https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date ; https://developer.android.com/develop/ui/views/appwidgets ; https://developer.android.com/develop/ui/views/appwidgets/advanced . Apple documentation JSON inspected for Data Protection/placeholder and timeline behavior. No real Health/provider access.

## Snapshot and lifecycle

Reuse confirmed JournalStore/GoalsStore/TrackingStore. No new API, DB table, goal arithmetic or Health aggregation. Only Today calories, remaining kcal, protein/target/status, water/target, partial/unlogged/no-goal/unknown/stale states and timestamp reach widgets. No auth token, username, raw meal/weight/steps, photo or API URL. Random local session ID scopes writes; no account identifier displayed. Strict bounded version1 JSON, finite values, date/timezone, 15-minute expiry capped at next local midnight. Incomplete/optimistic/pending inputs are withheld, not fabricated as zero. Reuse goalProgress/effectiveGoal and existing canonical known totals.

Native synchronous bind clears old snapshot and establishes a random session. Publish requires that exact session and monotonically increasing sequence. Native writes are atomic and protected; invalid/corrupt/expired/mismatched content renders a generic open-app state. iOS uses dedicated App Group file with complete protection and backup exclusion; extension has complete Data Protection entitlement and privacySensitive views. Android uses credential-protected noBackupFilesDir/AtomicFile, no exported data provider, immutable explicit app PendingIntent, home-screen-only widget category. No credentials cross the bridge/storage boundary.

Default-off build flag and per-account opt-in. Clear on initial auth boot, sign-out/session rejection/deletion/account replacement and preference disable. Stop publishing synchronously before an in-flight operation can finish. Deep links contain no owner/record values and enter existing authenticated routes. Native clear failure must be surfaced; never claim OS-cached pixels were synchronously recalled. Data files and future renders clear first; OS refresh/locked-device behavior remains a mandatory device gate. No network in widget extension/receiver.

Observe journal/goal/water confirmed changes and foreground/time/day changes. Coalesce publication, serialize via session/sequence, preserve original data timestamp; expire rather than extend old offline data. Refresh canonical stores only on entry/foreground/manual refresh/day rollover. iOS timeline includes placeholder at expiry; Android periodic and inexact expiry/timezone refresh requests. OS controls actual display timing. Small/medium native layouts, English/Hebrew, large text/accessibility and last-updated. No Live Activities, background fetch, interactive logging or P13 work.

## Verification and rollback

Failing-first TS snapshot/lifecycle/race/corruption/partial/goals/water tests; Swift/Kotlin policy and storage tests; config target/entitlement/manifest tests; full mobile/backend/browser/PG regression, lint/typecheck, packaging/export, real native app+extension Debug/Release builds. One independent final review, one confirmed-fix pass. Simulator/emulator gallery/home-screen evidence where feasible is labeled separately from physical-device acceptance; E2E17/19/20 remains blocked without observations.

Rollback: disable publishing, clear widget-owned protected snapshots, retain ordinary journal/Health interfaces and all inherited caveats. No schema migration required. Widget target removal needs an approved future compatible build; already rendered OS snapshots may lag reload requests. Do not claim complete privacy or native acceptance solely from tests/builds.
