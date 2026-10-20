# TestFlight candidate for RC12–RC15

Date: 2026-10-20. Base `e7a5bf49e35d866c05af4aefafcf951da95983ba`; local branch `codex/biteflow-testflight-rc12-15`.

**Status: TestFlight1.0.0(6) is VALID and IN_BETA_TESTING for the existing Personal internal group (1existing tester). Isolated staging and bounded free-AI text/photo smokes passed. RC12–15 device tests and production release acceptance remain open.**
The user authorized a separate staging environment in Render **My Workspace**, requested working AI for the beta, and then selected **free AI with synthetic/nonpersonal test data only**. The user subsequently approved pushes only to `codex/biteflow-testflight-rc12-15` and the narrow staging network rules, and approved the necessary Apple capabilities. Those approved staging operations have been performed; no production deployment/SQL or merge occurred. All automated tests mock AI. Two separately bounded local synthetic Gemini requests succeeded. Two hosted application attempts failed before provider dispatch because of a same-second quota-ledger guard; their uncertain reservations remain charged. The bounded dispatch-latency fix passed local and hosted tests. A fresh hosted synthetic text call and one public food-photo fixture both succeeded without automatic saving; the earlier reservations remain charged. No billing upgrade is authorized or performed.

## Existing accounts and deployment actually inspected

| Component | Observed on October 20 | Limit of the evidence |
| --- | --- | --- |
| Existing TestFlight app | ASC app `6821706586`, team `283L7984CA`, bundle `io.github.ophbra22.foodlogger`; EAS project `244a63eb-e8cc-4c08-b1d8-2c18d84e7ff7` | Reuse these identifiers; no new app |
| Previous beta | EAS build `75116353-a9e1-4a27-a1a3-38abd5ed8ecb`, app 1.0.0/build3; Apple reports VALID and IN_BETA_TESTING | This is the old October13 binary, not the current local source |
| Production Render service | `foodlogger`, `srv-db3raa3ncjis73bh20p0`, Singapore/free, main at `886b8b494c8388ea5d4d32ee743857ce72075888`; GET `/api/health` returned200 | Basic LiteRT health is not Gemini or new-phase acceptance |
| Production database | Supabase project `slnmporlcbqnnkyebdmv`, named `car_log`, Seoul pooler; dedicated `foodlogger_app` role | Existing shared project; do not modify it or copy its connection string to staging. No production SQL was run |
| AI | Local configured Gemini key was accepted by one GET models-metadata request; full-key SHA256 equality confirmed its binding to AI Studio's Default Gemini Project `gen-lang-client-0101662511`, Free tier. One synthetic text inference then returned HTTP200 and a valid two-food response | No personal data submitted; initial local text check had no photo. A second local diagnostic with synthetic input also passed (59input/43output tokens). These prove local provider calls, not hosted application behavior, photo accuracy or reserved shared quota |
| Gemini displayed limits | Flash Lite:15RPM,250000 input TPM,500RPD;3.6/3.8 Flash:5RPM,250000TPM,20RPD | Displayed usage was historical peak over28days, not remaining allowance. Quotas are project-wide, not per key |
| Render capacity | Hobby, no card,16.62/750 free instance hours,42MB/5GB bandwidth,6/500 pipeline minutes,3/25 services; accrued/projected charge$0 | Snapshot, not a reservation. Hours are shared with existing services |
| EAS capacity | CLI25.2.0 read-only account query: Free subscription, BUILDS3/30, LOCAL_BUILDS0/10, no overage,totalCost0 | Snapshot; recheck eligibility at build time, do not authorize paid overage/upgrade |
| New staging database | Created separately: `biteflow-staging-db`, id`dpg-dbbhudvavr4c73duk09g-a`, PostgreSQL17/free/Frankfurt, database`biteflow_staging_db`; state **available** | Expires2026-11-19 07:58UTC. Approved sources only: local5.29.8.48/32 and Render Frankfurt74.220.51.0/24,74.220.59.0/24. All16 existing migrations applied atomically to this previously empty database;36tables with RLS, dedicated non-owner login and TLS1.3 verified. No new migration |

No secret is included in this document. Do not record raw environment-variable responses, signed artifact URLs, credentials, health data or account recovery codes as evidence.

## Local changes

- `mobile/eas.json`: dedicated store-distributed `testflight` profile using the existing project/account, preview environment, Node24.19.0; iOS voice, Health, widgets and reminders enabled. Android Health Connect remains off for this iOS build. Production profile is preserved.
- Widget plugin declares the existing cleanup-capable extension to EAS before CNG. It preserves other extension declarations, App Group and protection entitlements, and derives extension versions from the app/build settings.
- Build guard requires an explicit separate HTTPS origin. The profile intentionally has **no default API URL** until the real staging endpoint is verified. A test export URL is not a deployed endpoint.
- Staging credentials use a separate Keychain key. Every resumed credential is bound to its server; legacy credentials require a valid saved origin as migration evidence. Unknown/mismatched origins require a fresh login while retaining credentials, drafts and receipts. Store builds ignore persisted overrides as destinations.
- Notification installation proofs retain the existing production identity and monotonic generations; staging uses a separate SecureStore key for each hashed API origin. No production proof is sent to a staging backend.
- `.easignore` excludes the virtualenv symlink, local execution scratch and local signing credentials. Actual EAS archive inspection found no secret/local-runtime payload files; excluded directory shells can still exist.
- `deploy/render.staging.yaml` is a schema-validated **candidate**, not an applied Blueprint.

No schema or API contract was changed. No migration was added. The existing16 migrations were applied only to the new isolated staging database.

## Separate staging setup — executed and remaining

- Only the approved test branch was pushed. `main` and production auto-deploy were not changed.
- `biteflow-staging-api`, service `srv-dbbiamm1egvs7384stu0`, is live at https://biteflow-staging-api.onrender.com, Frankfurt/free/Dockerfile.free, auto-deploy **off**, DB-backed health path `/api/health`. Initial deploy `dep-dbbian61egvs7384svq0` failed because DB ingress did not yet allow Render; after approved CIDRs, `dep-dbbibk7avr4c73dvqkag` became live. AI environment update deployed `dep-dbbidl3ncjis738rve8g`. Diagnostic source `2e78f1e` deployed as `dep-dbbinajncjis738ss890`. Fixed source `e3100ba` deployed as `dep-dbbisl67bikc738nhdng`, live09:04:23UTC. Environment updates can trigger deployment even with git auto-deploy off.
- The fresh PostgreSQL17 database was positively identified empty before migration. All16 existing migrations committed in one transaction;36tables have RLS. `foodlogger_app` has no superuser/CREATEDB/CREATEROLE/BYPASSRLS/INHERIT and only the existing application grants. Server-side ownership checks were tested. This is not a claim of end-user JWT isolation inside PostgreSQL. The app uses verified external TLS1.3; no certificate validation was bypassed.
- Two synthetic accounts were created. Final hosted smoke: **16/16 checks passed** for health, authentication guard, capabilities, manual meal, water write/idempotent replay/content conflict, cross-account isolation, Health reconciliation before/after deletion, and habit preference version conflict. No AI calls in that suite. First harness expected201 for replay but the correct API returns200; harness corrected. A subsequent run met a502 during a redeploy; preserved as a failed attempt. Final pass occurred after deployment was live. Synthetic records remain; they are not personal data.
- EAS preview URL is exactly the new staging HTTPS origin; production build profile remains unchanged.
- The free database expires **2026-11-19 07:58UTC**; free web instances sleep when idle. Export test evidence before expiry. These tiers do not establish production durability, restore or background scheduling. No paid upgrade.
- User approved Apple capabilities at action time: App Groups plus Complete Protection for main app/widget, HealthKit and Push Notifications for main app; existing Sign in with Apple retained. Group `group.io.github.ophbra22.foodlogger.widgets` (`LGL73BN3Y3`) is assigned to exactly the two BiteFlow components. Main bundle portal ID`LL4ZBR7LZW`; widget`U4WYKAQU7G`.
- EAS25.2.0 initially failed Apple's capability patch HTTP400; required capabilities were saved through the authenticated portal. Build counter4 was consumed without a build. Next attempt incremented to5 and regenerated main profile (`4369Z8T9MZ`) but stopped on the widget's first-time credentials. No cloud binary/upload existed for4or5.
- Widget App Store profile `CVLZYV4F35`, UUID`aaba8814-5f4d-4306-8d5a-577799c06b17`, was created with existing distribution certificate`8T3RSF224V`, valid until2027-04-25. Both downloaded profiles were decoded and their exact identifiers, shared group, full protection, main Health/production-APNs/AppleSignIn entitlements verified. Uploaded through supported EAS credentials sync using an **ignored, credentials-only temporary config**, never the app build config. Existing main credentials reused; no certificates revoked or replaced. Existing team APNs key`Q6DXUT37Q9` assigned to BiteFlow; no push sent.
- EAS build`e5bd526c-e5b3-4605-bd41-e91b15b13ca3`, source`e3100ba`, app1.0.0/build6 **FINISHED**. Exact downloaded19,109,790-byte IPA SHA256`4ed739ffd44a4914344991f2d45d9f5ea5cdb2c15af1e488cdc66914846c6e55`. Main and widget both1.0.0/build6, exact bundle IDs/App Group, non-debug store signatures, and `codesign --verify --deep --strict` exit0. Embedded bundle contains the staging origin. Main has Health/production-APNs/AppleSignIn; widget has Complete Protection. Both provisioning profiles authorize Complete Protection, but the main signed entitlement does **not** set an app-wide default. The shared-file writer explicitly uses `.completeFileProtection`; do not infer app-wide protection from portal/profile settings. The first inspection assertion incorrectly required that default on both targets; corrected to the existing architecture without modifying implementation. Device lock/cleanup verification remains open.
- Exact build6 submission`77bb9923-ff31-4ff2-8bab-0412ddf74008` **FINISHED**09:12:34UTC. Apple processing **VALID**, internal`IN_BETA_TESTING`, external`READY_FOR_BETA_SUBMISSION`. Assigned only to existing **Personal** internal group (1existing tester); UI confirmed the assignment and saved bilingual test notes. No new invitation/audience, no external beta review submitted, no public release. Installation and RC12–15 physical behavior remain **NOT RUN**.

## Real AI activation

Hosted text and photo integration now succeeded on the actual staging service after the fix. The final operator policy enables synthetic-data beta testing only:60total/day,40/user/day,1request/minute,200000input tokens/minute and per-attempt reservation;20daily slots reserved for photos; feature maxima photo40,text30,voice30,OCR10,insight0,recommendation0. These are stricter application caps, not provider guarantees. Verification expires **2026-10-27 08:30:58UTC**; it must be reverified/renewed for later testing. All four previous hosted reservations remain charged. Personal Health context/AI recommendation wording remain disabled.

- Key/project binding, Free tier and displayed limits were verified as described above. Verify other project traffic before assigning conservative staging caps; this is not a reservation of shared quota.
- The user selected **free AI with test data only**. Do not send personal, sensitive or confidential data. Include this restriction in TestFlight notes/device handoff. Any later personal-data route requires an eligible paid configuration and an explicit budget; the current code's `gemini-free` policy must not be falsely relabelled as paid.
- Configure the existing transaction-backed AI budget policy only in staging, with actual verified allowances, a conservative per-attempt token bound, feature/user caps, photo reserve and a dated verification expiry. App caps cannot reserve quota against other clients sharing the Google project.
- Transfer credentials through the approved secret store, never through source, mobile env, screenshots or chat. After the preceding prerequisites, a local live smoke used the actual `GeminiText` adapter and `AIGateway`, a fresh disposable local database and an enforced **one-request** operator cap (not a claimed Google quota). Input was the invented string “two eggs and half a pita”; result HTTP200,2food spans,60input/63output tokens reported. The cap was consumed, with no retries or photo submission. Initial missing-PYTHONPATH failure occurred before any call and was corrected. The cost ledger has no provider-reported monetary cost; zero known ledger cost is not invoice evidence. A second bounded local diagnostic used “sunny side up breakfast eggs” and returned HTTP200/59input/43output tokens. Hosted attempts with that synthetic input returned application HTTP200 but `ai_status=unavailable`, no saved meal and two uncertain charged reservations. Safe logs reported `VisionUnavailable`; the second ledger row retained owner/model/tokens/policy but dispatch was two seconds after reservation. `mark_dispatched` required exact second equality, preventing provider calls over the hosted database latency.
- Fixed hosted text smoke: HTTP200, `ai_status=used`,1unconfirmed food,59input/25output tokens, no auto-save. One public falafel-photo smoke: HTTP200,5foods, all require confirmation,1606input/955output tokens,14.898s, no auto-save. Provider warnings retained estimated portions/hidden ingredients/missing nutrition. Fixture is Shreya13jain’s public Wikimedia image, CC-BY-SA4.0, already present in the repository; this is integration evidence, **not** held-out accuracy or measured nutrition. The photo policy allowed exactly1new provider attempt.
- Retain manual fallback and editable confirmation. Provider activation does not close the held-out photo evaluation, nutrition provenance, privacy or production policy gates.

References: [Gemini limits](https://ai.google.dev/gemini-api/docs/rate-limits), [Gemini terms](https://ai.google.dev/gemini-api/terms), [EAS app extensions](https://docs.expo.dev/build-reference/app-extensions/), [Render free limits](https://render.com/docs/free).

## Device handoff — results still NOT RUN

Start with the [Hebrew device guide](testflight-device-guide-he.md). Install **1.0.0(6)** from the existing TestFlight app; create a fresh staging username/password account. Sign in with Apple is not configured on this staging backend. The same bundle replaces the installed beta, so upgrade/return cleanup still needs physical evidence.

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
| `npm test -- --runInBand --watch=false` | Final after review fixes: **533 passed,102 suites passed**,0failed/0skipped; repeated under the profile's Node24.19.0 with the same result. Before review525/100 |
| `npm run typecheck` | **PASS**, exit0 |
| `npm run lint` | **PASS**, exit0 |
| `.venv/bin/python -m pytest -m 'not postgres and not integration and not browser' -q` | **652 passed,38 deselected**,0failed; deselected is not passed/skipped |
| Widget and build-guard regressions | Observed RED→GREEN; final task verification20passed/4suites |
| Auth/credential regressions | Initial3staging bootstrap +1SecureStore case; review added7production migration cases and1real installation/registration sequence. Review RED:6failed/2passed; GREEN:8passed |
| Expo public/introspected config, capability flags off/on | **PASS locally**; EAS extension declaration retained even when widgets off |
| `expo prebuild --platform ios --no-install` with beta flags | **PASS** after correcting initial wrong-directory invocation; generated native files ignored |
| `expo export --platform ios` with beta flags | **PASS**; one3.7MB Hermes bundle; fixture URL only |
| `eas build:inspect -p ios -s archive -e testflight` | **PASS**, repeated after review fixes; no virtualenv, secrets, runtime evidence or generated native source payload; AuthProvider/notification/plugin/profile archive bytes match reviewed files |
| `ajv validate --spec=draft2020 ...` against current Render schema | **PASS** for staging YAML |
| Apple capabilities and downloaded provisioning profiles | **PASS** for recorded identifiers/entitlements; not signed IPA verification |
| Signed build/IPA | Build6 **PASS**, exact artifact/version/entitlements and both deep/strict signatures checked. First download attempt403; normal browser User-Agent download200. EAS upload **FINISHED**09:12:34UTC; Apple build6 **VALID**, **IN_BETA_TESTING**; existing Personal group assigned and notes saved. External distribution not submitted |
| Hosted CI at`ce623e0` | **PASS**: Python3.11 and3.12 each652passed/38skipped; PostgreSQL/LiteRT free-runtime681passed/9deselected; browser6passed/684deselected; mobile533passed/102suites, typecheck/lint/dependency checks/iOS+Android exports; Docker512MiB/cert-bundle checks and wheel/sdist passed |
| Hosted CI at`e3100ba` | **PASS**: Python3.11 and3.12 each660passed/39skipped; PostgreSQL/LiteRT free-runtime690passed/9deselected; browser6passed/693deselected; mobile533passed/102suites. Typecheck, lint, dependency alignment, iOS+Android exports, Docker512MiB/cert-bundle checks, wheel/sdist all passed. Counts overlap across jobs; not summed as unique tests |
| ML smoke | **SKIPPED** by workflow condition; no accuracy claim |
| Android native compilation/lint and physical tests | **NOT RUN in this task**; prior dated gates remain |
| Hosted non-AI smoke | Final16/16passed; two earlier unsuccessful harness/deploy attempts preserved |
| Safe AI failure diagnostics at`2e78f1e` |3new mocked tests RED→GREEN; complete local backend655passed (exit0), Ruff PASS; independent review: no findings |
| Dispatch latency fix at`e3100ba` | Targeted46passed; complete local backend660passed/39deselected in24.93s; Ruff PASS. New PostgreSQL concurrency/rate-window test passed in hosted free-runtime |
| Separately authorized live text smoke | **1 bounded request PASS**, HTTP200,2valid food spans,60input/63output tokens; no automated test calls live AI |
| Live hosted text AI | First2attempts **FAILED**, retained as charged; after fix **PASS** on1fresh request with synthetic input,59input/25output tokens, no auto-save |
| Hosted photo integration smoke | **PASS**,1public fixture/1provider attempt,5unconfirmed foods, no auto-save. Accuracy benchmark/held-out evaluation **NOT RUN** |

The existing Android strict lint errors, dependency/security findings, policy/privacy/data approvals, production CI/migration/restore, physical matrices and production-operational gates remain open as recorded in [the gate register](gate-register.md) and [RC06](RC06.md). This preparation neither closes those rows nor invents post-release metrics.

## Independent review and local fixes

One fresh-context reviewer inspected immutable `e7a5bf4..4a3a99a`. Two Important findings, no Critical/Minor findings. No second independent review of the fix commit is claimed.

1. **Notification ownership proof crossed environments.** The actual installation helper and registration session are now exercised through production→stagingA→stagingB→production→stagingA. Distinct proofs reach each backend; return visits preserve that environment's generation. The test failed with shared proofs before the origin-bound storage fix and passes afterward.
2. **Ignored overrides could replay preview credentials against production and erase drafts after401.** All resumed credentials now require origin evidence. Explicit bindings take precedence; legacy credentials use a valid saved origin only as migration evidence. Unknown, corrupt and different origins require a fresh login without erasing pending state. Regression tests failed before the fix and pass afterward. Existing cleanup/expiry fixtures now explicitly bind their sessions to the tested server; their original assertions remain.

Final mobile suite533/533, types/lint and the iOS export passed after these fixes. The original review excluded signed IPA/device behavior and live infrastructure/provider operations. Staging TLS/roles/migrations and non-AI API checks now have the separate evidence above. Signed binary inspection and hosted text/photo integration now have separate evidence above. Physical behavior remains unverified.

A separate fresh-context diagnostic review of`2e78f1e` found no issues;3new mocked regression cases observed RED→GREEN. A subsequent independent review of immutable`2e78f1e..e3100ba` found no issues. Dispatch now allows only0≤age<60seconds on the same provider day, retains policy/owner/model/token checks under the policy lock, and atomically refreshes `started_at` with the state transition. The reservation already occupies quota; refreshing extends its rolling rate window. New tests cover latency, expiry, backward clock, midnight, duplicate and PostgreSQL concurrent dispatch. Runtime clock/provider receipt timing and physical outcomes were not certified by code review.

Implementation/evidence commits on the approved test branch:

- `e61dcd6` — iOS beta profile, widget signing/versioning and archive exclusions.
- `cbae4a0` — staging auth origin and credential isolation.
- `4a3a99a` — initial staging candidate and device handoff.
- `bbe9907` — both independent review fixes and regressions.
- `6781b6b` — revised readiness/rollback evidence and actual database identity.
- `bc57599` — authorized local synthetic Gemini request and packaging/runtime evidence.
- `ce623e0` — bounded report fixture IDs, fixing Linux subprocess environment-size failure in CI.
- `2e78f1e` — safe text-AI failure diagnostics and3mocked regressions.
- `e3100ba` — tolerate bounded DB latency before dispatch while retaining locked policy/day/rate-window protection;5local regressions and1PostgreSQL test.

Final documentation commit is identified in Git history (`docs: record TestFlight build6 availability and staging evidence`); it changes no source used by build6 or the running staging deployment.

The pre-existing `.venv` symlink remains untracked. Credentials and runtime evidence are ignored; never stage them. The inherited gate-register file is unchanged from the base. A binary patch of the complete preparation range passed `git apply --reverse --check`; this is mechanical source rollback evidence, not device or database recovery evidence.

Decisions carried forward:

- Scope remains beta preparation, not acceptance of all RC07–19 work. Cost: release approval still needs those gates.
- Reuse the current Apple bundle/account. Cost: beta replaces the installed app; upgrade/return cleanup needs physical verification.
- Separate staging credentials, retain compatibility state and reject ambiguous legacy origins. Cost: a fresh login may be required even when the old account was valid.
- Keep externally unverified outcomes gated. Cost: local test success cannot establish safe signing, device privacy, live service isolation or AI quality.

## Rollback and recovery

- Before any distribution, source changes can be reverted in a new local commit. The separate staging database now contains synthetic test data and AI accounting. Keep it and its ledger intact; production state has not changed. Source rollback does not undo Apple/EAS/Render state.
- Once a beta has written state, use a compatible forward-fix/feature-off build with source at or after rollback floor **e70f17a**. Do not distribute historical TestFlight build3 as a supposedly safe rollback.
- Retain RC03 provenance readers/schema3 drafts, RC04 exact pending PATCH/idempotency, RC05 cleanup recovery, P13 archive/security fixes, label drafts, Health receipts, notification leases and widget App Group cleanup. Do not erase compatibility state to make rollback look successful.
- Staging and production credentials remain distinct. Changing staging origin signs the user out instead of replaying credentials to a different backend. Production and test installations share the Apple bundle, so actual upgrade/return behavior requires device evidence.
- AI rollback: no schema or row format changed. A source rollback can read these refreshed timestamps but restores the old strict same-second failure. Prefer feature-off/operator-policy-disable or a compatible forward fix; preserve consumed/uncertain ledger rows without refunds. Never revoke the existing shared signing certificate or APNs key as a rollback shortcut.
- Disable new delivery work first, drain pending notification/Health operations according to existing procedures, preserve acknowledgments and receipts, and verify signed-out widget cleanup on device. Accepted remote pushes cannot be recalled.
- Do not drop the staging database as a rollback shortcut. Preserve test evidence and export before expiry. Never downgrade or migrate the active shared Supabase project for this beta.
