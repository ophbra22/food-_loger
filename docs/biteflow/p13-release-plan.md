# P13 candidate, release notes and staging plan

**Local candidate only. No deployment, upload, merge, push, migration against real data or release approval.** P14 requires an explicitly approved release to have actually occurred. Full P13 is blocked by `p13-open-gates.md`. Final source/build hashes and command evidence are in `evidence/p13/manifest.json` and the checkpoint. Do not use the local debug-key Android APK or simulator app as a store artifact.

## Candidate changes and user guidance

- Settings adds an explicit account-data export in English/Hebrew on iOS/Android. It includes a versioned server JSON archive plus saved drafts/pending tracking from the current device. Review the sensitive-data disclosure and choose a trusted destination. Server/device reads are independent; unsaved forms, other devices, authentication secrets and external Health library are excluded. Day CSV remains available. Oversized accounts fail without truncation; support-assisted complete export is an operational gate, not implemented cloud automation.
- Trends adds expandable daily values for accessible reading, with localized dates, selected units, effective goals and honest missing/partial labels. It respects visible chart layers. Full physical screen-reader/layout acceptance remains open.
- Recognition unavailable errors no longer expose internal exception text. Manual logging remains usable.
- No data schema change or migration in P13. No AI feature activation or new paid provider/telemetry integration.

## Artifact and activation boundaries

Build cleanly from recorded source and lockfiles, isolated Metro caches and reviewed environment. Validate packaged API origin and disabled flags. New local packages use loopback only. All unverified Health/Health Connect/widget/voice flags remain off; AI, label/text AI, wording and server feature gates stay at repository defaults until individually approved. Demo tests turn specific flags on only against synthetic local fixtures. No `.env` or signing secret belongs in an artifact manifest.

The archive route is authenticated by the existing owner/session boundary and has no new independent feature flag. Roll back it and its Settings UI together by reverting the P13 commits onto a compatible P12 source; retain existing data contracts. Archive files already handed to another app cannot be recalled. Never infer that in-app deletion removes recipient backups.

## Staging checklist — NOT RUN

1. Assign actual humans to the roles below; record approved feature subset, platform/minimum OS, languages, permissions and explicit inherited exceptions. P0/P1 defects or unresolved privacy incidents block release. Do not label broad source accuracy, complete Health history or full nutrition provenance as verified.
2. Obtain separate staging scope/access. Snapshot exact staging schema/version/roles/grants and backup metadata; compare to migration manifest, restore a copy, exercise old/current clients and reconcile writes/deletions after backup. P13 adds no migration, but all inherited migrations still require staging approval and proof.
3. Build immutable signed candidate with authorized credentials, known API origin and feature configuration; hash outputs and attach SBOM/dependency results, entitlements, privacy declarations and evidence. Resolve npm advisories/native lint/toolchain gates before production approval.
4. Run E2E01–20 on approved real-device matrix. Record pass/fail/not-run with device/OS/build, attempt counts and exact failure evidence; include HE/EN/RTL/dark/large text/assistive tech and camera/speech/push/Health/widget permissions/account isolation. Run offline/401/429/timeouts, install/update/reinstall, logout/erasure and restore.
5. Review current provider/dataset/store policy using actual account evidence where needed; no live AI until separately authorized. Confirm kill switches stop new work and preserve pending receipts/data. Verify support-assisted export and external retention/deletion limits.
6. Validate approved minimal monitoring in staging using synthetic events. No content, diet/weight/allergy values, images/audio or credentials in logs. Document sampling, denominators, access, deletion and retention. Obtain actual signoff before production authorization is requested.

## Proposed cohort and stop thresholds — not measured results

Subject to owner approval: start with an internal consenting staging cohort of5 testers, at least2 supported devices per platform, for48hours, before proposing any production cohort. AI stays mocked/off. Require all scoped E2E cases executed with0 P0/P1 defects,0 cross-owner disclosures,0 lost/duplicate confirmed saves or unsafe erase/restore outcomes. Any privacy/data-integrity issue stops immediately regardless of sample size.

Require at least100 attempted saves across the approved matrix with explicit failure count; no rollout if >1% unexpected failures or any unresolved uncertain duplicate/lost save. Compare p95 day/trends/save latency to a predeclared comparable staging baseline, same fixtures/cache/device/network; investigate >20% regression and do not compare local in-process timings to network results. Proposed crash threshold: >=99.5% crash-free sessions with at least200 observed sessions; insufficient samples remain inconclusive. Owners may tighten these before the experiment, never retroactively redefine success. Native sync/widget/push behavior has separate correctness/latency evidence, not just HTTP rates. Production rollout sizes and time windows remain unapproved/unassigned.

## Role owners and approvals

| Role | Responsibility | Assigned human / status |
|---|---|---|
| Product/release owner | Feature subset, acceptance exceptions, cohort and final approval | UNASSIGNED — BLOCKED |
| Backend/data owner | Backup, grants, migration compatibility, post-backup reconciliation and restore authorization | UNASSIGNED — BLOCKED |
| iOS/Android owners | Signing, entitlements, physical matrix, store disclosures and compatible downgrade | UNASSIGNED — BLOCKED |
| Privacy/security owner | Retention, export/erasure support, dependency exposure, logs, provider/dataset policy | UNASSIGNED — BLOCKED |
| On-call rollback owner | Monitor thresholds, stop new writes/sync and coordinate verified recovery | UNASSIGNED — BLOCKED |

## Recovery / rollback instructions

Local recovery point: `8ce7ad3889813276d63d4d4e016299605eafa507` (P12). Keep `codex/biteflow-p13` and its commits for review. To abandon P13 locally, use a new worktree at that P12 SHA, or revert only the P13 commits in reverse order on a new `codex/` branch; do not hard-reset a user's checkout or delete `.venv`. Rebuild both mobile and backend from compatible source; verify tests/flags/caches. No P13 database rollback SQL is needed because no migration was added.

For any separately approved deployed rollback: disable new AI/sync/reminder/writer activations as applicable; stop scheduling before changing a worker; preserve schema and all request identities/tombstones/native mappings. Restore a compatible previous app/server artifact, not an arbitrary historical phase. Confirm API origin and cleanup capability/entitlements in the exact packaged binary.

Carry all prior caveats: P06 label drafts require compatible validators; P07 pending measurement retries must resolve or stay readable; P09 token generations/lease expiry and already accepted external pushes cannot be recalled; P10/P11 Health export/import deletion receipts must survive retries/downgrades and external Health records are separate; P12 widget cleanup bridges/App Groups and previous-publication markers must survive rollback, and cached OS pixels have no instant-clear guarantee. No destructive schema down migration.

Restoring data is a separately approved incident procedure. Save current source before any restore, enumerate all post-backup mutations and erasure requests, replay/reconcile with IDs/revisions/idempotency receipts, compare per-owner counts/checksums and verify other owners unchanged. The local rehearsal proves one explicit synthetic write replayed twice plus a subsequent account erasure; it does not supply production CDC, backup encryption, RTO/RPO, disaster recovery or legal signoff. Do not overwrite newer data or resurrect deleted accounts using an older backup.
