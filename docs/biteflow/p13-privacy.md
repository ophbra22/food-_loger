# P13 privacy review — local evidence, release signoff pending

Scope: source based on 8ce7ad3 plus P13 commits. No real user data, remote telemetry or provider calls. The new `GET /api/account/export` is authenticated and owner-scoped, uses one read transaction, returns no-store JSON, and limits complete responses to 50,000 rows / 10 MiB. Oversize requests fail explicitly (413), never silently truncate. Three attempts per five minutes per account. Existing day CSV remains compatible.

## Persisted data inventory

`src/foodlogger/privacy.py` explicitly lists exported columns. `tests/test_privacy.py` enumerates every SQLite table against that inventory and tests every owner table with two synthetic accounts. PostgreSQL adds shared `schema_version` only. New data tables/columns require privacy review, not automatic export.

| Data | Archive / deletion / retention |
|---|---|
| users, sessions, apple_identities, apple_challenges | Own account ID/username and Apple-link metadata exported; password/recovery hashes, sessions, nonce/challenge, Apple refresh secrets excluded. Session revocation and account cascade remain. Apple revocation uses existing provider flow, mocked in tests. |
| meals, meal_groups, meal_group_items, save_receipts, foundation_issues | All own journal records, tombstones and receipt state exported; request hashes/digests excluded. Explicit meal deletion plus owner/FK cascades. Quarantined metadata retained, not rewritten. |
| user_nutrition_goal_revisions | All own historical revisions; cascade on account deletion. |
| library_favorites, recipe_headers, recipe_versions, recipe_items, library_requests | Own favorites, recipe history/items and operation results, no digests. Cascade including tombstones. |
| private_products, private_product_versions, private_product_requests, label_cache | Own versions and cached payloads including expiry metadata. Fingerprints/digests excluded. Cache read TTL remains seven days; physical pruning remains owner-write/erasure, no new scheduler. |
| tracking_entries, tracking_receipts | Own weight/water, source, version, deleted state and request identity; request hash excluded. Cascade. |
| recommendation_preferences, recommendation_source_reviews | Sensitive diet/allergy declarations and source-review state exported and cascaded. Do not treat labels as medically verified. |
| reminder_preferences, reminder_devices, reminder_attempts | Preferences, platform/readiness/generation/time and attempt records exported; push token, session/installation hashes excluded. Cascades remain; accepted external notifications cannot be recalled. |
| health_scopes, health_exports, health_imports, health_connect_imports | Own scope, mapping/revisions/import payload and tombstones exported, cascaded on account erasure. OS-created external Health records are not erased by SQL cascades. Existing native disconnect/repair/reinstall caveats remain. |
| ai_attempts | Own feature/provider/model/time/tokens/cost/state exported. User FK becomes NULL on deletion so project-wide quota accounting cannot reset through deletion. Request/payload/policy digests are not exported. Retention/anonymization of remaining hashes requires operational privacy signoff; no claim of irreversible anonymization. |
| ai_projects, foundation_migrations, foundation_jobs, PostgreSQL schema_version | Shared operational metadata, not account content. No account deletion or archive of other users. |

## Device data and external copies

The mobile archive adds only current-account saved meal/recipe drafts, pending tracking operation and widget preference. Raw stored text preserves older/corrupt draft data without interpreting it as a migration. Server/device reads are separate; other devices, transient unsaved forms and concurrent edits are not a global atomic snapshot. Derived day/goal/library/tracking caches duplicate server records and are omitted. Native sync cursors/receipts and authentication/notification-installation secrets are not portable data exports. Their cleanup/reconciliation remains governed by existing account storage and native contracts.

Temporary archive/day CSV files should be removed after sharing/cancellation/failure and by existing private-file cleanup. Shared copies in a recipient app or backup cannot be recalled by account deletion. No photo/audio binaries are added to exports. Image-picker/manipulator temporary copies follow existing cleanup; physical OS cache, backup, file-protection and external-provider retention remain device/policy gates.

## Telemetry and retention

No new remote telemetry service is enabled. Existing AI accounting persists bounded operational fields; no nutrition/allergy/weight/photo/audio content should enter operational logs or metrics. This checkpoint collects only aggregate timings/counts on synthetic local fixtures. Production crash-free session and save-failure denominators are NOT measured. A reviewed minimal event schema, retention/deletion schedule, operational owner and approved destination are required before remote monitoring/rollout. No numeric retention promise or provider quota is inferred.

Restore tests use owned copies and preserve source counts/checksums. A backup is sensitive data: approved access/encryption/retention and deletion reconciliation must be defined before real backup operations. Do not restore deleted accounts or discard post-backup writes; use the release plan's reconciliation gate.

## P13 evidence and policy review (2026-10-18)

The SQLite export inventory and all29 owner-data categories were exercised with two synthetic accounts; PostgreSQL repeated export/erasure under the restricted application role. Restore-copy evidence compares every table, preserving new writes and deletion intent on a copy. It is a rehearsal of explicit captured operations, not an automated production recovery mechanism. New exports do not close retention/legal policy gates or OS/external-copy erasure gates.

Log review found only two operational logging sites in `src/foodlogger`: the existing DB failure stage/fixed reason and the classifier exception. The classifier previously emitted chained raw errors and returned their text. P13 replaces this with a fixed warning/503 detail; a sentinel regression failed before the fix and passes after. Image rejection remains validated local input feedback. No new raw content or user ID telemetry was added. A pattern scan of1,641 tracked text files found0 matches for selected provider/cloud/private-key patterns; it is not a comprehensive credential/history audit. Existing mock keys, local synthetic credentials and historical evidence are not production credentials. P13 fixture-session values in initial failing test logs are redacted before archive.

Dependency results:77 installed Python packages audited with0 known advisories, editable `foodlogger` excluded (78 entries total). This is the developer environment, not a locked production image. npm reports67 affected package entries (50 high,17 moderate,0 critical), across five upstream advisory families. Exact dependency paths and advisory JSON are retained. `braces`, `node-forge`, `sprintf-js` latest available versions still fall in affected ranges; `decode-uri-component` and `uuid` have newer releases, but npm proposes incompatible Expo/router changes in this tree. These paths include Expo CLI/router infrastructure and glob/test/build chains; no claim that runtime exposure is impossible. No unsafe automatic dependency rewrite was applied. Reviewed fixes and clean runtime/build dependency scans remain release blockers.

Public primary sources were rechecked; no provider account or store console was accessed:

- [Gemini terms](https://ai.google.dev/gemini-api/terms): unpaid-service rules restrict submission of sensitive/personal material; paid/unpaid handling differs. Age, region and medical-use limitations require product/legal review. Public terms do not prove the project's tier, quotas, billing or permitted nutrition-image processing. **Live AI remains off.**
- [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/): health, fitness, photos/audio, identifiers and other user content must be evaluated against actual collection and sharing. No submitted disclosure or approved privacy policy is claimed.
- [Android Health Connect data types](https://developer.android.com/health-and-fitness/health-connect/data-types): publishing requires declarations for used data types. Physical permissions and Play approval remain unverified. The attempted direct Google Play Data Safety page failed to load; complete current Data Safety review remains open.
- [Open Food Facts API documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/): current API guidance reviewed; original terms page was not extractable. Specific aggregation/publication licensing and attribution approval remain open; no combined catalog published.
- [USDA data documentation](https://fdc.nal.usda.gov/data-documentation/) distinguishes analytical, compiled and manufacturer label sources. [API guide](https://fdc.nal.usda.gov/api-guide/) reviewed. Provider data does not make an estimated/corrected meal independently verified; retain provenance and source confidence.

## Proposed minimal monitoring contract (not activated)

Only after separate policy approval: collect event kind, app/server build, feature/flag version, fixed outcome/error class and bucketed duration. Calculate saves from attempted/completed counts with explicit denominator/window; crashes from documented session counts. No meals, food text, diet/allergies, measurements, images/audio, export content, user/account/device IDs, tokens or provider prompts in operational events. Native OS/network tools may collect metadata independently and require inventory/signoff. Assign retention/deletion and aggregation thresholds before activation; no arbitrary retention promise is implemented here.
