# P10 device evidence still required — NOT EXECUTED

This protocol records outstanding P10-C work. It grants no permission to install, sign, access personal Health data, change signing portals, migrate a hosted database, or enable a live feature. P11 remains unopened.

## Prerequisites

Record the exact commit/build hash, iPhone model, iOS version, bundle ID, development/release configuration, HealthKit-enabled provisioning and entitlements. Use an explicitly approved isolated test account/backend and synthetic test records, with AI providers mocked/off. Verify the informed opt-in text and health-data retention/export/deletion policy before importing actual device data. Confirm no unrelated app/Health records may be removed. A certificate or unsigned build is insufficient.

## Required measured cases

| Case | Evidence required |
|---|---|
| Capability and consent | Health available/unavailable; select none, each group separately, all groups; deny all and partial per-type writes; revoked permission; actual EN/HE purpose dialogs; ordinary food/water logging still works. Read status stays unknown; empty results never imply permission granted. |
| Original-time exports | Confirm known synthetic kcal/protein/carbs/fat and manual water with explicit time/zone. Inspect sample amounts/units/time/source/sync identity/revision. Unknown nutrients omitted, legacy date-only meals withheld and explained. |
| Repeat/retry (E2E-16) | Count samples after first sync, repeated sync, foregrounding, queued edit, interrupted write/ack, restart and retry. Counts and values converge without duplication. Test at meaningful history volume and record duration/storage traffic on device. |
| Edits/deletes | Edit one meal/water entry, then delete. Only exact owned identity is changed/deleted; unrelated BiteFlow identities and external app samples remain intact. Repeated deletion cannot resurrect prior values. |
| Weight/steps import | Inspect real source bundle, external UUID, original interval/timezone and value; repeat import; confirm no nutrition read/import. Imported weight updates loaded Weight/Trends/Advice. Raw overlapping steps are not advertised as deduplicated daily totals. Check 30-day/1,000-per-type bounds and overflow disclosure. |
| Permission/lifecycle | Permission sheet inactive state completes; genuine background pauses future operations; next active sync resumes. Observe background/killed state, disconnect/reconnect, logout during each await, account A→B and stale native callbacks. Already submitted operations may finish only under original scope. |
| Source changes and recovery | Reinstall/native ledger loss, user deletion of app-created Health samples, two devices/iCloud, external edit/delete/UUID conflicts and server restore. Define and validate repair policy before live enablement; currently open gates, not claimed solved. |
| Privacy/security (E2E-19) | No credentials or unnecessary identifiers in Health metadata; protected backup-excluded native ledger; owner isolation; account-local storage erasure; server account cascade; separately disclose that existing Apple Health samples are user-controlled after account deletion. |
| Accessibility (E2E-20) | EN/HE/RTL, large text, VoiceOver focus, meaningful permission/error/withheld states and source labels, keyboard/navigation. |
| Signed release | Install and exercise the signed Release artifact on a compatible physical iPhone, repeating the core permission/read/write/retry/edit/delete/sign-out cases. |

Capture actual values and counts, screenshots or screen recordings with consent, timestamps, failures and exact reproduction steps. Do not substitute mocked adapter tests, simulator compilation or Expo exports. Full P10 stays BLOCKED until required evidence passes and open live-enablement policies are resolved. If any release omits Health, keep both flags off and explicitly scope that release.
