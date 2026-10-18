# P13 candidate, release notes and staging plan

**Local candidate only. No deployment, upload, merge, push, migration against real data or release approval.** P14 requires an explicitly approved release to have actually occurred. Full P13 is blocked by `p13-open-gates.md`. Final source/build hashes and command evidence are in `evidence/p13/manifest.json` and the checkpoint. Do not use the local debug-key Android APK as a store artifact. No P13 iOS candidate exists because its builds failed.

Local rollback follow-up: see [the checkpoint](p13-rollback-checkpoint.md). The original P13 package manifest is historical; its packages do not contain the new export stop controls. This procedure does not authorize any environment change.

## Candidate changes and user guidance

- Settings adds an explicit account-data export in English/Hebrew on iOS/Android. It includes a versioned server JSON archive plus saved drafts/pending tracking from the current device. Review the sensitive-data disclosure and choose a trusted destination. Server/device reads are independent; unsaved forms, other devices, authentication secrets and external Health library are excluded. Day CSV remains available. Oversized accounts fail without truncation; support-assisted complete export is an operational gate, not implemented cloud automation.
- Trends adds expandable daily values for accessible reading, with localized dates, selected units, effective goals and honest missing/partial labels. It respects visible chart layers. Full physical screen-reader/layout acceptance remains open.
- Recognition unavailable errors no longer expose internal exception text. Manual logging remains usable.
- No data schema change or migration in P13. No AI feature activation or new paid provider/telemetry integration.

## Artifact and activation boundaries

Build cleanly from recorded source and lockfiles, isolated Metro caches and reviewed environment. Validate packaged API origin and disabled flags. New local packages use loopback only. All unverified Health/Health Connect/widget/voice flags remain off; AI, label/text AI, wording and server feature gates stay at repository defaults until individually approved. Demo tests turn specific flags on only against synthetic local fixtures. No `.env` or signing secret belongs in an artifact manifest.

The supported rollback path is a compatible P13 build with new account exports stopped, retaining privacy cleanup and security fixes. **Do not deploy plain P12 or blanket-revert P13.** The local P12 recovery point is for inspection only: its file cleanup ignores P13 account JSON archives, and its classifier/CSV paths lack the P13 security fixes.

| Control | Normal compatible behavior | Rollback behavior |
|---|---|---|
| `FOODLOGGER_ACCOUNT_EXPORT_DISABLED` | unset / `0` / `false`: existing authenticated archive route | `1` / `true`: authenticated 503 before archive reads; unauthenticated requests still 401. Read at server startup; restart all instances under separate approval. Invalid values prevent startup. |
| `EXPO_PUBLIC_ACCOUNT_EXPORT_DISABLED` | unset / `0`: existing account-export card/helper | `1`: compiled mobile build hides the card and rejects archive construction before fetching. Requires a new bundle/build; not a remote switch. |
| Cleanup, CSV and security | Always retained | `clearPrivateFiles()` still removes account JSON/CSV/photo copies; session fences and fixed classifier errors remain active. |

Use `1` for both controls in the rollback profile. Client-only disablement does not stop older clients reaching an enabled server. Server-only disablement safely refuses new archive requests but older clients may still show an export action and its failure message. The switches do not recall already completed or in-flight exports. Drain work already admitted before declaring export stopped. Archive copies handed to another app cannot be recalled.

The mobile flag uses static dot notation and is compiled by Expo; see [Expo environment-variable documentation](https://docs.expo.dev/guides/environment-variables/). Never put credentials in a public build flag.

## Staging checklist — NOT RUN

1. Assign actual humans to the roles below; record approved feature subset, platform/minimum OS, languages, permissions and explicit inherited exceptions. P0/P1 defects or unresolved privacy incidents block release. Do not label broad source accuracy, complete Health history or full nutrition provenance as verified.
2. Obtain separate staging scope/access. Snapshot exact staging schema/version/roles/grants and backup metadata; compare to migration manifest, restore a copy, exercise old/current clients and reconcile writes/deletions after backup. P13 adds no migration, but all inherited migrations still require staging approval and proof.
3. Build immutable signed candidate with authorized credentials, known API origin and feature configuration; hash outputs and attach SBOM/dependency results, entitlements, privacy declarations and evidence. Resolve npm advisories/native lint/toolchain gates before production approval.
4. Run E2E01–20 on approved real-device matrix. Record pass/fail/not-run with device/OS/build, attempt counts and exact failure evidence; include HE/EN/RTL/dark/large text/assistive tech and camera/speech/push/Health/widget permissions/account isolation. Run offline/401/429/timeouts, install/update/reinstall, logout/erasure and restore.
5. Review current provider/dataset/store policy using actual account evidence where needed; no live AI until separately authorized. Confirm kill switches stop new work and preserve pending receipts/data. Verify support-assisted export and external retention/deletion limits.
6. Validate approved minimal monitoring in staging using synthetic events. No content, diet/weight/allergy values, images/audio or credentials in logs. Document sampling, denominators, access, deletion and retention. Obtain actual signoff before production authorization is requested.

## Proposed cohort and stop thresholds — not measured results

Subject to owner approval: start with an internal consenting staging cohort of 5 testers, at least 2 supported devices per platform, for 48 hours, before proposing any production cohort. AI stays mocked/off. Require all scoped E2E cases executed with 0 P0/P1 defects, 0 cross-owner disclosures, 0 lost/duplicate confirmed saves or unsafe erase/restore outcomes. Any privacy/data-integrity issue stops immediately regardless of sample size.

Require at least 100 attempted saves across the approved matrix with explicit failure count; no rollout if >1% unexpected failures or any unresolved uncertain duplicate/lost save. Compare p95 day/trends/save latency to a predeclared comparable staging baseline, same fixtures/cache/device/network; investigate >20% regression and do not compare local in-process timings to network results. Proposed crash threshold: >=99.5% crash-free sessions with at least 200 observed sessions; insufficient samples remain inconclusive. Owners may tighten these before the experiment, never retroactively redefine success. Native sync/widget/push behavior has separate correctness/latency evidence, not just HTTP rates. Production rollout sizes and time windows remain unapproved/unassigned.

## Role owners and approvals

| Role | Responsibility | Assigned human / status |
|---|---|---|
| Product/release owner | Feature subset, acceptance exceptions, cohort and final approval | UNASSIGNED — BLOCKED |
| Backend/data owner | Backup, grants, migration compatibility, post-backup reconciliation and restore authorization | UNASSIGNED — BLOCKED |
| iOS/Android owners | Signing, entitlements, physical matrix, store disclosures and compatible downgrade | UNASSIGNED — BLOCKED |
| Privacy/security owner | Retention, export/erasure support, dependency exposure, logs, provider/dataset policy | UNASSIGNED — BLOCKED |
| On-call rollback owner | Monitor thresholds, stop new writes/sync and coordinate verified recovery | UNASSIGNED — BLOCKED |

## Recovery / rollback instructions

Compatible source floor for these controls: `581664748d2eb53426ec906514b7ece0775a61fc`, plus any subsequent reviewed fixes named in the follow-up checkpoint/manifest. Keep `codex/biteflow-p13` and its commits. P12 `8ce7ad3889813276d63d4d4e016299605eafa507` may be inspected in an isolated checkout with synthetic data, but is **not a safe operational downgrade target**. No P13 database rollback SQL is needed: neither P13 nor this follow-up adds a schema migration.

For a separately approved rollback, the release owner must record every step and its evidence:

1. Record exact source, artifacts, API origin, platform capabilities and configuration. Stop new export ingress and drain already admitted requests/share operations; an existing OS share cannot be forcibly recalled. Do not enable AI or remove inherited capability gates.
2. Retain compatible server code including fixed classifier error responses/logging and bounded archive reads. Configure `FOODLOGGER_ACCOUNT_EXPORT_DISABLED=1` and restart **all** server instances under the approved change procedure. Verify authenticated archive 503 without a body containing account data, unauthenticated 401, and unaffected owner-scoped day CSV. A lingering old instance fails this step.
3. Build/package the compatible mobile source with `EXPO_PUBLIC_ACCOUNT_EXPORT_DISABLED=1`, preserved CSV/session guards, and the existing private-file/native/widget cleanup capabilities. Validate the exact signed artifact on the approved device matrix. Do not substitute an old APK, P12 binary or stale bundle. The local debug-signed test APK is evidence only, not a release artifact.
4. Preserve or resolve drafts, pending saves/measurement operations and native receipts with compatible readers **before** a logout-based cleanup; logout clears account-local drafts/caches. Never delete an account merely to clean temporary files. On the compatible app, finish/cancel shares and use the existing verified logout cleanup path. Confirm `biteflow-account-*.json` and owned CSV/photo temporary copies are gone while unrelated app assets and retained server records remain. Export disablement alone does not erase files, and this follow-up does not add startup cleanup. If cleanup throws or cannot be verified, record failure, retain the compatible cleanup code, resolve storage access and retry; do not mark erasure or downgrade safe. Physical file protection/OS retention still require real-device evidence.
5. Keep P13 logout/session revocation before asynchronous remote logout and `finally` deletion after CSV/share completion, failure or cancellation. Keep the generic classifier 503 and fixed log message. Never remove these protections merely because account exports are disabled. An alternative corrective build must pass the same regression cases and device cleanup checks before approval.
6. Run the scoped regression/owner-isolation/permission/recovery matrix, compare data and receipts with the pre-change snapshot, and obtain release-owner acceptance. Re-enable exports only through a separately reviewed configuration/build change after the incident and privacy gates are resolved. Setting either control back to normal does not repair lost data or validate a release.

Steps above are a procedure for future approval, not actions performed against staging or production. The local follow-up verifies stop-switch behavior and mocked lifecycle failure/retry; it does not prove a physical upgrade/downgrade or OS-level erasure.

For any separately approved deployed rollback: disable new AI/sync/reminder/writer activations as applicable; stop scheduling before changing a worker; preserve schema and all request identities/tombstones/native mappings. Restore a compatible previous app/server artifact, not an arbitrary historical phase. Confirm API origin and cleanup capability/entitlements in the exact packaged binary.

Carry all prior caveats: P06 label drafts require compatible validators; P07 pending measurement retries must resolve or stay readable; P09 token generations/lease expiry and already accepted external pushes cannot be recalled; P10/P11 Health export/import deletion receipts must survive retries/downgrades and external Health records are separate; P12 widget cleanup bridges/App Groups and previous-publication markers must survive rollback, and cached OS pixels have no instant-clear guarantee. No destructive schema down migration.

Restoring data is a separately approved incident procedure. Save current source before any restore, enumerate all post-backup mutations and erasure requests, replay/reconcile with IDs/revisions/idempotency receipts, compare per-owner counts/checksums and verify other owners unchanged. The local rehearsal proves one explicit synthetic write replayed twice plus a subsequent account erasure; it does not supply production CDC, backup encryption, RTO/RPO, disaster recovery or legal signoff. Do not overwrite newer data or resurrect deleted accounts using an older backup.
