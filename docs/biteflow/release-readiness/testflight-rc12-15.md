# TestFlight candidate for RC12–RC15

Date: 2026-10-20. Base `e7a5bf49e35d866c05af4aefafcf951da95983ba`; local branch `codex/biteflow-testflight-rc12-15`.

**Status: local preparation; no new beta built or uploaded yet. Not release acceptance.**
The user authorized a separate staging environment in Render **My Workspace**, requested working AI for the beta, and then selected **free AI with synthetic/nonpersonal test data only**. The earlier no-production/no-push boundary remains: no repository push, production deployment, production SQL or live AI inference has been performed. All automated tests mock AI. No billing upgrade is authorized.

## Existing accounts and deployment actually inspected

| Component | Observed on October 20 | Limit of the evidence |
| --- | --- | --- |
| Existing TestFlight app | ASC app `6821706586`, team `283L7984CA`, bundle `io.github.ophbra22.foodlogger`; EAS project `244a63eb-e8cc-4c08-b1d8-2c18d84e7ff7` | Reuse these identifiers; no new app |
| Current beta | EAS build `75116353-a9e1-4a27-a1a3-38abd5ed8ecb`, app 1.0.0/build3; Apple reports VALID and IN_BETA_TESTING | This is the old October13 binary, not the current local source |
| Production Render service | `foodlogger`, `srv-db3raa3ncjis73bh20p0`, Singapore/free, main at `886b8b494c8388ea5d4d32ee743857ce72075888`; GET `/api/health` returned200 | Basic LiteRT health is not Gemini or new-phase acceptance |
| Production database | Supabase project `slnmporlcbqnnkyebdmv`, named `car_log`, Seoul pooler; dedicated `foodlogger_app` role | Existing shared project; do not modify it or copy its connection string to staging. No production SQL was run |
| AI | Local configured Gemini key was accepted by one GET models-metadata request; full-key SHA256 equality then confirmed its binding to AI Studio's Default Gemini Project `gen-lang-client-0101662511`, Free tier | No generation, food text or photo submitted. User approved nonpersonal test data only. Shared traffic, staging policy and bounded inference verification remain |
| Gemini displayed limits | Flash Lite:15RPM,250000 input TPM,500RPD;3.6/3.8 Flash:5RPM,250000TPM,20RPD | Displayed usage was historical peak over28days, not remaining allowance. Quotas are project-wide, not per key |
| Render capacity | Hobby, no card,16.62/750 free instance hours,42MB/5GB bandwidth,6/500 pipeline minutes,3/25 services; accrued/projected charge$0 | Snapshot, not a reservation. Hours are shared with existing services |
| EAS capacity | CLI25.2.0 read-only account query: Free subscription, BUILDS3/30, LOCAL_BUILDS0/10, no overage,totalCost0 | Snapshot; recheck eligibility at build time, do not authorize paid overage/upgrade |
| New staging database | Created separately: `biteflow-staging-db`, id`dpg-dbbhudvavr4c73duk09g-a`, PostgreSQL17/free/Frankfurt, database`biteflow_staging_db`; state **available** | Expires2026-11-19 07:58UTC. External connections blocked by empty instance allowlist. No schema migration or SQL executed |

No secret is included in this document. Do not record raw environment-variable responses, signed artifact URLs, credentials, health data or account recovery codes as evidence.

## Local changes

- `mobile/eas.json`: dedicated store-distributed `testflight` profile using the existing project/account, preview environment, Node24.19.0; iOS voice, Health, widgets and reminders enabled. Android Health Connect remains off for this iOS build. Production profile is preserved.
- Widget plugin declares the existing cleanup-capable extension to EAS before CNG. It preserves other extension declarations, App Group and protection entitlements, and derives extension versions from the app/build settings.
- Build guard requires an explicit separate HTTPS origin. The profile intentionally has **no default API URL** until the real staging endpoint is verified. A test export URL is not a deployed endpoint.
- Staging credentials use a separate Keychain key. Every resumed credential is bound to its server; legacy credentials require a valid saved origin as migration evidence. Unknown/mismatched origins require a fresh login while retaining credentials, drafts and receipts. Store builds ignore persisted overrides as destinations.
- Notification installation proofs retain the existing production identity and monotonic generations; staging uses a separate SecureStore key for each hashed API origin. No production proof is sent to a staging backend.
- `.easignore` excludes the virtualenv symlink, local execution scratch and local signing credentials. Actual EAS archive inspection found no secret/local-runtime payload files; excluded directory shells can still exist.
- `deploy/render.staging.yaml` is a schema-validated **candidate**, not an applied Blueprint.

No schema or API contract was changed. No migration was added.

## Separate staging setup and prerequisites

1. Publish **only** `codex/biteflow-testflight-rc12-15` after explicit push approval. Never merge into main as part of staging setup: main has production auto-deploy enabled. Record the exact reviewed source revision.
2. The fresh PostgreSQL17 instance above has been created in the confirmed Render workspace. Create the separate Docker web service only after its reviewed branch is available. If adopting the database into a Blueprint, match its actual immutable database name. Never sync this candidate into the existing production Blueprint.
3. The temporary free database expires after30days; Render free web instances sleep when idle. Export synthetic test evidence before expiry. These plans do not establish production durability or reliable background scheduling. Keep consumption below the shared workspace limits; do not purchase an upgrade automatically.
4. The new database currently denies all external traffic; even the read-only MCP query was rejected **before SQL execution**. Authorize narrowly scoped network sources for setup and the staging server, retaining default-deny for others. Use **new database credentials**. Apply the existing migrations in order to the positively identified empty staging database; create a dedicated non-owner `foodlogger_app` login with the existing least-privilege grants/RLS. Keep administrative credentials out of app configuration. Verify TLS, roles, permissions and two-account isolation before opening tester access. Do not run destructive PostgreSQL test fixtures against staging.
5. App configuration requires verified TLS. Render's internal connection uses a self-signed certificate, so the candidate requires a compatible verified external endpoint and appropriate network access controls; do not weaken TLS or point it at production to bypass setup.
6. Verify authenticated capability responses and synthetic create/confirm/edit/delete flows on the new service. Only then set the exact HTTPS URL in EAS preview and rebuild; local exported bundles use a test fixture URL and are not distributable.
7. Use the existing Apple/EAS signing account. Verify the main app and extension provisioning, App Group, Apple Sign-In, Health and push capabilities, and inspect the **signed IPA's** app/extension bundle versions and entitlements. Generated source configuration alone is insufficient.
8. Build the `testflight` profile, record exact buildID/source/version, submit that specific buildID with the existing submission profile. Check upload, Apple processing, eligibility and availability separately. Do not silently expand tester groups or enable external testing for new people.

## Real AI activation

The requested beta should eventually have live AI; the staging candidate keeps all AI flags off until activation prerequisites are met.

- Key/project binding, Free tier and displayed limits were verified as described above. Verify other project traffic before assigning conservative staging caps; this is not a reservation of shared quota.
- The user selected **free AI with test data only**. Do not send personal, sensitive or confidential data. Include this restriction in TestFlight notes/device handoff. Any later personal-data route requires an eligible paid configuration and an explicit budget; the current code's `gemini-free` policy must not be falsely relabelled as paid.
- Configure the existing transaction-backed AI budget policy only in staging, with actual verified allowances, a conservative per-attempt token bound, feature/user caps, photo reserve and a dated verification expiry. App caps cannot reserve quota against other clients sharing the Google project.
- Transfer credentials through the approved secret store, never through source, mobile env, screenshots or chat. Run a bounded synthetic live smoke test only after the preceding prerequisites. A models-list request does not prove inference works.
- Retain manual fallback and editable confirmation. Provider activation does not close the held-out photo evaluation, nutrition provenance, privacy or production policy gates.

References: [Gemini limits](https://ai.google.dev/gemini-api/docs/rate-limits), [Gemini terms](https://ai.google.dev/gemini-api/terms), [EAS app extensions](https://docs.expo.dev/build-reference/app-extensions/), [Render free limits](https://render.com/docs/free).

## Device handoff — results still NOT RUN

TestFlight covers **iOS**. The Android portions require a separate signed test APK and Android device; they cannot be accepted from this iOS beta.

| Gate | Required physical evidence |
| --- | --- |
| RC12 voice | Hebrew/English on-device model availability; permission deny/revoke; stop/cancel/background/kill; verify no network fallback or leftover recordings; editable “two eggs and half a pita” confirmation |
| RC13 iOS Health | Signing, minimum consent, synthetic record counts, repeated sync/no duplicates, crash before acknowledgment, edits/deletes, partial/revoked permissions, logout/account switch, reinstall/ledger loss and preservation of third-party records |
| RC14 widgets | Gallery/sizes/App Group/deep links, English/Hebrew/accessibility, meal/water/goal refresh; separately measure stored-file removal and visible pixels on logout/account change/delete/expiry/lock/reboot/kill/midnight/DST/restore |
| RC15 notifications | Test-device registration and APNs/Expo credentials; bounded staging-only delivery worker; consent, known/unknown meal suppression, quiet hours/DST, revoke/rotate/reinstall/offline logout/account switch,15-minute lease/receipt expiry and stop/drain |

The backend has a delivery-worker entry point, not an automatically deployed scheduler. The free web service alone will not make RC15 pass. Select an authorized staging-only scheduler or bounded operator-run delivery for the test cases; leave `FOODLOGGER_PUSH_DELIVERY_ENABLED=0` until a test device and delivery window are defined. Scheduler/retention acceptance remains separate from one successful push.

## Actual local checks

Commands ran in the isolated checkout; mobile commands ran in `mobile/`. Logs are in ignored `runtime/testflight-20261020/`; these contain no provider secrets.

| Command/check | Actual result |
| --- | --- |
| `npm test -- --runInBand --watch=false` | Final after review fixes: **533 passed,102 suites passed**,0failed/0skipped; before review525/100 |
| `npm run typecheck` | **PASS**, exit0 |
| `npm run lint` | **PASS**, exit0 |
| `.venv/bin/python -m pytest -m 'not postgres and not integration and not browser' -q` | **652 passed,38 deselected**,0failed; deselected is not passed/skipped |
| Widget and build-guard regressions | Observed RED→GREEN; final task verification20passed/4suites |
| Auth/credential regressions | Initial3staging bootstrap +1SecureStore case; review added7production migration cases and1real installation/registration sequence. Review RED:6failed/2passed; GREEN:8passed |
| Expo public/introspected config, capability flags off/on | **PASS locally**; EAS extension declaration retained even when widgets off |
| `expo prebuild --platform ios --no-install` with beta flags | **PASS** after correcting initial wrong-directory invocation; generated native files ignored |
| `expo export --platform ios` with beta flags | **PASS**; one3.7MB Hermes bundle; fixture URL only |
| `eas build:inspect -p ios -s archive -e testflight` | **PASS**; no virtualenv, secrets, runtime evidence or generated native source payload; expected CNG/native module source retained |
| `ajv validate --spec=draft2020 ...` against current Render schema | **PASS** for staging YAML |
| Signed compile/archive/IPA verification, upload and new Apple processing | **NOT RUN** |
| PostgreSQL/browser/ML integration, Android compilation/lint, physical tests, hosted CI | **NOT RUN in this task**; Docker engine unavailable locally. Prior evidence remains dated, not rerun |
| Live AI generation/benchmark | **NOT RUN** |

The existing Android strict lint errors, dependency/security findings, policy/privacy/data approvals, hosted CI/migration/restore, physical matrices and production-operational gates remain open as recorded in [the gate register](gate-register.md) and [RC06](RC06.md). This preparation neither closes those rows nor invents post-release metrics.

## Independent review and local fixes

One fresh-context reviewer inspected immutable `e7a5bf4..4a3a99a`. Two Important findings, no Critical/Minor findings. No second independent review of the fix commit is claimed.

1. **Notification ownership proof crossed environments.** The actual installation helper and registration session are now exercised through production→stagingA→stagingB→production→stagingA. Distinct proofs reach each backend; return visits preserve that environment's generation. The test failed with shared proofs before the origin-bound storage fix and passes afterward.
2. **Ignored overrides could replay preview credentials against production and erase drafts after401.** All resumed credentials now require origin evidence. Explicit bindings take precedence; legacy credentials use a valid saved origin only as migration evidence. Unknown, corrupt and different origins require a fresh login without erasing pending state. Regression tests failed before the fix and pass afterward. Existing cleanup/expiry fixtures now explicitly bind their sessions to the tested server; their original assertions remain.

Final mobile suite533/533, types/lint and the iOS export passed after these fixes. The reviewer's three excluded evidence areas—signed IPA/Apple/device execution; physical speech/Health/widget/notification behavior; live staging TLS/RLS/migrations and provider operations—remain mandatory gates, not review passes.

Decisions carried forward:

- Scope remains beta preparation, not acceptance of all RC07–19 work. Cost: release approval still needs those gates.
- Reuse the current Apple bundle/account. Cost: beta replaces the installed app; upgrade/return cleanup needs physical verification.
- Separate staging credentials, retain compatibility state and reject ambiguous legacy origins. Cost: a fresh login may be required even when the old account was valid.
- Keep externally unverified outcomes gated. Cost: local test success cannot establish safe signing, device privacy, live service isolation or AI quality.

## Rollback and recovery

- Before any distribution, source changes can be reverted in a new local commit. The separately provisioned staging database can remain for subsequent setup; no application data or production state has changed.
- Once a beta has written state, use a compatible forward-fix/feature-off build with source at or after rollback floor **e70f17a**. Do not distribute historical TestFlight build3 as a supposedly safe rollback.
- Retain RC03 provenance readers/schema3 drafts, RC04 exact pending PATCH/idempotency, RC05 cleanup recovery, P13 archive/security fixes, label drafts, Health receipts, notification leases and widget App Group cleanup. Do not erase compatibility state to make rollback look successful.
- Staging and production credentials remain distinct. Changing staging origin signs the user out instead of replaying credentials to a different backend. Production and test installations share the Apple bundle, so actual upgrade/return behavior requires device evidence.
- Disable new delivery work first, drain pending notification/Health operations according to existing procedures, preserve acknowledgments and receipts, and verify signed-out widget cleanup on device. Accepted remote pushes cannot be recalled.
- Do not drop the staging database as a rollback shortcut. Preserve test evidence and export before expiry. Never downgrade or migrate the active shared Supabase project for this beta.
