# P10 — local Apple Health implementation

Base `0bcfbaa`; local-only approval carries all gates. F16 and roadmap P10 only. AI remains mocked; neither HealthKit access nor production operations have been exercised. Build flags default off.

## Architecture and reuse

`health.py` reconciles existing confirmed meal component IDs and manual water records under the existing owner lock. It persists anonymous per-owner scopes, stable sample IDs, monotonic revisions and deletion tombstones in three additive private tables. Only changed payloads advance revision. Original timestamps, local dates and timezones are retained; date-only/malformed historical meals are withheld. Existing unified confirmation already offers explicit timestamp/timezone fields. Known nutrients can export individually; unknown values never become zero. Nutrition metadata says `user_confirmed_unverified`, preserving the unresolved basis-provenance gate.

Authenticated `/api/health/reconcile`, `/api/health/import` and `/api/health/imports` require the default-off health flag and P07 tracking/write capability. Weight imports create P07 rows with immutable `apple_health` external identity; step samples retain original interval, source bundle, UUID and value in the private import ledger. Duplicate import replays preserve later user changes/deletions. Conflicting source payloads fail atomically rather than overwrite. No dietary import route or read permission exists. Steps remain raw source samples; no double-counted daily total is advertised.

The Apple-only local Expo module uses installed ExpoModulesCore and HealthKit directly. The config plugin owns HealthKit entitlement and purpose strings; no background entitlement is requested. Permissions are independently opt-in for nutrition writes, water writes, weight reads and step reads. Read authorization remains `unknown`; empty results and dialog completion are not evidence of permission. Write status is checked per type. Individual quantities suffice for canonical component identity, so no meal correlation is required.

Each sample uses `HKMetadataKeySyncIdentifier` plus `HKMetadataKeySyncVersion`. Deletion combines the default app source predicate with the exact scoped sample identity. Native writes are serialized, with owner/session invalidation before each operation. A protected, backup-excluded anonymous revision ledger prevents stale work from resurrecting deleted samples. An already handed-off HealthKit operation can finish after logout; its revision is recorded only under its original scope, and no next operation starts. No third-party sample is removed.

The server revision/tombstone ledger is the durable outbox. The JS queue persists scope/consent before native writes and keeps compact acknowledged revisions afterward, in batches of at most 50. The native ledger also checkpoints at batch boundaries; a crash replays stable IDs/versions safely. Unchanged acknowledged history makes no per-record native call or storage write. A fresh authoritative snapshot supersedes obsolete pending values; server mappings/tombstones survive client logout/cache removal. Retrying after write/ack failure uses stable native identities. Single-flight restoration and serialized consent mutations prevent stale consent from overwriting new choices. Successful import batches report affected weight dates and refresh tracking/trend/advice stores; duplicate receipts do not create refresh loops. Account switch, disconnect and backgrounding invalidate pending work (an inactive permission sheet does not); foreground explicitly reconciles subscribed journal/measurement changes. Ordinary logging does not depend on Health availability. Settings are EN/HE and disclose private-journal import, estimated nutrition, read ambiguity, original-time omissions and disconnect behavior.

## Limits and gates

- Flags: `FOODLOGGER_HEALTH_ENABLED=0`, `EXPO_PUBLIC_HEALTH_ENABLED=0` by default. Local enabled native builds prove compilation only.
- Full reconciliation is bounded at 10,000 exported quantity records; no silent truncation. Imports query the last 30 days, bounded at 1,000 samples per selected type. Overflow fails before import, never treated as complete. Scaling/history coverage requires validation before live enablement.
- Foreground only. Background/killed execution is not promised. Server edits while a sync is in flight reconcile on a queued refresh or the next foreground/manual refresh.
- Imported external changes/deletions and read revocation cannot be inferred from an empty query. Existing imported snapshots remain source-attributed; no unrequested external-data deletion occurs. Conflicting UUID payloads require review.
- Device revision ledger loss/reinstall, user deletion of app-created Health samples, iCloud/multiple-device synchronization, device/account sharing, physical data-protection behavior and Health consent/retention require actual validation.
- No nutrition verification claim, quota verification, signed-release validation or device acceptance. All inherited gates remain in p10-open-gates.md.

## Capability and signing review

Expo SDK57 / RN0.86.3; Xcode27.0 available. One distribution identity exists; HealthKit-enabled provisioning, development identity, actual signed release and compatible physical iPhone execution are unverified. No signing portal changes, EAS build, device install or Health data access was made. Unsigned simulator Debug/Release checks are recorded separately from signed builds.

Official sources: [HealthKit setup](https://developer.apple.com/documentation/healthkit/setting-up-healthkit), [authorization](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data), [sync identity/version semantics](https://developer.apple.com/documentation/healthkit/hkmetadatakeysyncidentifier), [Expo local modules](https://docs.expo.dev/modules/get-started/), [SDK57](https://docs.expo.dev/versions/v57.0.0/).

## Rollback

1. Disconnect/pause every participating client and disable server/client Health flags before returning code to P09. Offline clients require later reconciliation; already submitted native operations cannot be recalled.
2. Retain all three Health tables and server scopes/revisions/tombstones/import receipts. Optional `rollback-p10.sql` revokes insert/update, retaining read/delete for privacy erasure. No destructive down migration.
3. Keep the compatible native revision ledger and queued mappings for any later re-enable. Never reset a revision namespace while retaining old Health samples. Do not erase third-party Health samples.
4. Signing out clears account-local queue/cache using existing storage epoch guards; server mapping survives. Account deletion cascades server data; existing Apple Health samples remain user-controlled and must be disclosed separately, not silently claimed erased.
5. Existing P06 label-draft, P07 pending-measurement and P08 dietary/review rollback caveats remain mandatory. Local PG backup/restore evidence is not hosted recovery validation.
