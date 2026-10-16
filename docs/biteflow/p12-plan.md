# P12 native widgets implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline, with one final fresh reviewer. User explicitly authorized local P12 under the approved specification/roadmap; no repeated phase approval needed.

**Goal:** Native iOS/Android Today widgets using protected, minimal owner-scoped snapshots.
**Architecture:** Existing stores -> strict snapshot -> session/sequence publisher -> protected native file -> WidgetKit/AppWidget. No backend or data-contract replacement.
**Tech Stack:** Expo57, TypeScript, Swift/WidgetKit, Kotlin/RemoteViews, existing config plugins.
**Spec:** `p12-design.md`; approved requirements F18 and roadmap P12-A/B/C.

## Global Constraints

P12 only; default-off; per-account opt-in; no credentials/private identifiers in widget output; no AI/production/push/merge/deploy; preserve inherited gates. No schema changes. Native generated files come from tracked config/source. Physical/signing acceptance must remain BLOCKED absent actual evidence.

## Review Focus

- Logout/account replacement while publication is pending: native session gate rejects old writes and clear precedes new account use (Tasks1/4).
- Optimistic goals/water, offline stale data, midnight/DST/timezone changes: no invented zero or extended freshness (Tasks1–3).
- Corrupt/interrupted file, locked storage, missing App Group: generic placeholder and visible capability/error (Tasks2/3).
- Widget cached render after logout/expiry, app killed and OS scheduling: distinguish storage clearing from visible pixel refresh, preserve device gate (Tasks2–4).
- Disabled build/preference, session restoration/server switch and auth deep links: no previous-owner publish and ordinary app stays usable (Tasks1/4).

### Task 1: snapshot contract and publication policy

Files `mobile/src/native/widgets/{snapshot,publisher}.ts`, tests under `__tests__`.
Interfaces: `buildSnapshot(day,goals,water,language,now):WidgetSnapshot`; `WidgetPublisher(port,session)` with bind/publish/close; port synchronous bind(session),publish(session,sequence,json),clear(),available(). Reuse goalProgress/effectiveGoal, no account data in JSON.
- [ ] RED tests: ready/no-goal/partial/unlogged, unknown/pending water/goals, dates/expiry, minimal schema, old/pending owner rejection, failure/retry.
- [ ] Implement strict finite bounded snapshot and session lifecycle; run targeted Jest expected PASS; commit.

### Task 2: Android bridge, storage and AppWidget

Files new `mobile/modules/biteflow-widgets/android`, widget XML/layout resources; config plugin and native JVM tests. Official Expo local scaffold for both platforms.
Interfaces consume strict JSON from Task1; native policy validates schema/time/session/sequence before atomic private write; receiver renders small/medium and requests periodic/expiry refresh; explicit auth-routed deep link.
- [ ] RED JVM/config tests for invalid/corrupt/expired/owner/sequence, size/lock/unknown states and no secrets.
- [ ] Implement native module/widget/provider/resources, feature flag/config; run JVM tests and actual Android builds expected PASS or precise tool blocker; commit.

### Task 3: iOS protected App Group and WidgetKit target

Files new module iOS bridge/policy/storage, tracked `mobile/widgets/ios` extension, `plugins/with-widgets.cjs` target/entitlements generation.
Interfaces same JSON/session/sequence; dedicated group.io.github.ophbra22.foodlogger.widgets and io.github.ophbra22.foodlogger.BiteflowWidgets target; iOS16.4 floor; small/medium static configuration; placeholder on corruption/expired/read protection; no network.
- [ ] RED Swift policy/storage and plugin tests for account/expiry/corruption/atomic writes/target idempotence.
- [ ] Implement target/module; run policy tests, prebuild/pods and unsigned native app+extension builds; commit.

### Task 4: auth lifecycle, opt-in UI, full verification and review

Files `WidgetProvider.tsx`, `WidgetSettings.tsx`, native/session adapter, AuthProvider and root layout/settings integration, tests, checkpoint/gates/evidence.
- [ ] RED tests for boot clearing, opt-in, logout/401/deletion/account-switch/server-switch, late async preference read, confirmed store subscriptions, rollover and safe deep links.
- [ ] Implement minimal lifecycle/UI EN/HE, preserving existing flows; targeted/full mobile tests, typecheck/lint expected PASS.
- [ ] Full Python/PG/browser regression, Ruff/package/export, Android native + iOS extension builds; capture actual widget simulator/emulator evidence where available without personal accounts/data.
- [ ] One independent final review of immutable phase range; fix confirmed Important/Critical with RED→GREEN; archive exact results/gates/rollback/commits. Stop before P13.
