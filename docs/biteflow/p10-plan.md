# P10 local execution plan — Apple Health

Authority: approved roadmap P10-A/B/C and specification F16. User explicitly approved local P10 with all P09/inherited gates carried forward. Base: 0bcfbaaa7f92b211d49f2bfb42f0180baa3ce2c3. Branch: codex/biteflow-p10. No P11, production, push, deployment, live AI, Health data access or signing-portal changes.

## Capability review (before implementation)

Existing client: Expo 57.0.27, RN 0.86.3, generated/ignored iOS project, custom opaque owner sessions and private server-role DB. No existing Health adapter, sync ledger or capability. Existing confirmed meal rows and P07 water/weight measurements are reused. Xcode 27.0 (27A266a) and one distribution signing identity are present. No HealthKit-enabled provisioning profile, physical-device execution, signed release, or entitlement approval has been verified. A certificate is not sufficient evidence.

Use a local Apple-only Expo module against the installed ExpoModulesCore, without adding an unverified third-party Health wrapper. Native module and config plugin are tracked; generated iOS files are not edited by hand. Feature flags default off. No HealthKit background-delivery entitlement: sync is explicit/foreground, pauses in background and resumes only for an opted-in active account.

References reviewed: [Expo SDK57](https://docs.expo.dev/versions/v57.0.0/), [local modules](https://docs.expo.dev/modules/get-started/), [module API](https://docs.expo.dev/modules/module-api/), [autolinking](https://docs.expo.dev/modules/autolinking/), [HealthKit setup](https://developer.apple.com/documentation/healthkit/setting-up-healthkit), [authorization](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data). Apple SDK headers are also checked for exact native contracts. Read authorization cannot be inferred from empty results or the authorization-dialog completion boolean.

### Task 1: Durable canonical mappings and imports (P10-B server)

Add private owner scopes, versioned export mappings/tombstones and external import provenance, behind a default-off capability. Reconcile confirmed meal components and manual water only, preserving original timestamps, local dates and source. Unknown nutrient values are omitted; absent/invalid historical timestamps are withheld, not invented. Use stable per-owner sample identities and monotonic revisions; missing entries become tombstones. Imports accept only weight/steps, external UUID/source/time, preserving source IDs; weights reuse P07 tracking. Replays do not overwrite user edits/deletions. No nutrition read path.

Interfaces: authenticated bounded sync snapshot and import API -> native queue. Existing meal/tracking contracts unchanged. Additive SQLite/PostgreSQL schema; owner cascades, explicit owner predicates, existing server-role RLS. Rollback preserves mappings and receipts, disables writes.

Tests first: flags/auth/isolation, stable revisions/retry/edit/delete/null/timestamp/provenance, weight/step import replay/rejection, account erasure and PostgreSQL roles/rollback. Expected: targeted tests fail before implementation, then pass; full backend suite remains green (external opt-ins reported).

### Task 2: Native adapter and permission boundary (P10-A)

Apple-only Expo module, config plugin, typed adapter. Read weight/steps only; write kcal/protein/carbs/fat/ml water only. Minimal user-selected permission groups, explicit read-status unknown, per-write-type authorization. Stable sync identifiers/revisions, deletion predicate restricted to default app source plus exact owned identity. Serialized operations and native session invalidation. Evaluate correlations: individual quantity samples suffice for existing component IDs; no unnecessary correlation permission.

Tests first: typed adapter absence/denied/partial/stale-session behavior and plugin config; native policy test/build. Build Debug and Release without signing; never call HealthKit on a real device. Expected: tests pass; any signing/device limitation stays BLOCKED.

### Task 3: Durable queue, reconciliation and settings (P10-B mobile)

Owner-scoped durable pending state, server-backed canonical revisions, idempotent native replay after write/ack crash, serialized foreground sync and explicit retry. Account switch/logout invalidates native and JS work before new operations; disconnect retains mappings. Reconcile changes during sync and remove only app-owned samples. Import recent weight/step samples with external IDs; display source/time and read ambiguity, never aggregate overlapping raw steps into invented totals. UI EN/HE with capability, permission, pending/error/paused states. Ordinary logging works independently.

Tests first: repeated sync, storage failure/corruption, crash between write and ack, edits while syncing, permission changes, account switch/sign-out, disconnect, imports and UI. Expected: targeted and full mobile tests, typecheck/lint pass.

### Task 4: Verification and checkpoint (P10-C)

Run full backend/mobile/browser suites, local PostgreSQL migration/role/rollback/recovery, lint/typecheck/package/Expo exports, Debug and Release native builds as feasible. One independent whole-branch review; reproduce/fix Important/Critical findings and rerun affected/full tests. Record exact results and evidence, commits, rollback, acceptance matrix and complete inherited gates. Real-device/signed release E2E-16/19/20 remain BLOCKED without actual evidence. Stop before P11.

## Review focus

Health privacy/read-permission ambiguity; source/owner/server identity isolation; replay across crashes, logout and account switch; monotonic revision/tombstone behavior; imports preserving user edits and never reimporting nutrition; incomplete/legacy timestamps and provenance; native permission denial and app-owned-only deletion; queue failures not breaking logging; zero live operations; native build evidence versus real-device acceptance.
