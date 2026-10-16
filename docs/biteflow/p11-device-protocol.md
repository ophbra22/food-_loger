# P11 Android device acceptance protocol — NOT RUN

This is a future verification procedure, not observed results or permission to enable production. Full phase acceptance remains BLOCKED. Use a separately approved local/mock server, synthetic records and a dedicated test device/account. Keep AI disabled. Never use or erase a person's Health data.

Record device model, Android/API/security build, Health Connect provider/version, app commit/build/hash, signing certificate, timezone/locale, install history and feature flags. Cover supported stable Android/provider combinations and API24–27 ordinary startup separately. The current API37 preview-emulator launch/rationale smoke does not satisfy this matrix.

| Scenario | Required observation | Current result |
|---|---|---|
| Availability | API24–27 app opens/logs without SDK initialization; unsupported/install-required/available states accurate | NOT RUN |
| Permissions | None, each partial combination, deny, revoke while pending, regrant; permission sheet returns correctly; ordinary logging works | NOT RUN |
| Exports | Known kcal/protein/carbs/fat/water values match native units, identities, source and timestamps; unknown fields absent | NOT RUN |
| Dedup | Repeat sync, crash after native write before ack, relaunch and retry; count/value unchanged for each identity/revision | NOT RUN |
| Edit/delete | Edit one confirmed meal; only matching owned records change. Delete exact owned IDs. Missing-ID deletion remains visible, other work progresses; no broad delete | NOT RUN |
| Imports | Synthetic weight/steps source UUIDs, modification times and offsets retained; latest version wins, user-deleted weight not resurrected; food/manual/Apple rows untouched | NOT RUN |
| Pagination/expiry | Multiple snapshot/change pages, update during initial read, expired token; cursor follows server ack; warning retained, no deletion by absence | NOT RUN |
| Lost response/cache | Server commits then connection drops; replay refreshes latest/previous/delta/trends including moved-date and deletion; pending page retained on failure | NOT RUN |
| Partial permission isolation | Pending denied weight page does not block granted steps; no denied weight upload; regrant resumes original page | NOT RUN |
| Lifecycle/E2E-19 | Background/foreground, sign-out/account switch during write/read/upload; prior owner cannot transfer or see another owner's pending work | NOT RUN |
| Recovery | App-data loss/reinstall and two installations; retained server/native IDs prevent duplicate/incorrect deletion; external user edits/deletes reconciled or clearly blocked | NOT RUN |
| Accessibility/E2E-20 | Hebrew RTL, English LTR, large text and TalkBack across consent, denied, retry, incomplete-history and repair messages | NOT RUN |
| Signed release/E2E-16 | Authorized production-like signing/manifest/Play permission declaration; actual permission and sample behavior repeated on physical device | NOT RUN |

For each scenario record before/after sample counts and IDs/revisions, action sequence, expected/actual results, screenshots/logs with synthetic data only, errors and cleanup. Do not substitute mocked calls, JS export, JVM tests, build success or the privacy activity screenshot for Health Connect behavior. A failure or missing result leaves the related criterion BLOCKED; preserve every inherited gate.
