# P10 open gates

All prior gates remain open. User authorized local P10 only, explicitly carrying blocked P07–P09 acceptance. No P11 authorization.

## P10 gates

- HealthKit-enabled provisioning, signed release, physical iPhone E2E-16/19/20, actual permission/read/write/edit/delete/retry/disconnect/background behavior: BLOCKED pending actual evidence.
- Health-data privacy/retention/export, source provenance, account/server isolation and staged rollout must be reviewed before live enablement. Native flags stay off.

- Reconciliation/import volume limits, external sample changes/deletions, read-revocation ambiguity, native ledger loss/reinstall, multi-device Health synchronization and app-sample deletion repair remain live-enablement gates.

## Complete inherited P09 register (verbatim)

# P09 open gates — P08 gates carried forward

All entries below inherited from the approved P08 checkpoint remain open unless explicitly supported by new evidence. No P10 approval is inferred.

## New P09 gates

- **Blocking full P09 acceptance / production:** physical iOS/Android notification permission, foreground/background/killed delivery, rotation, denied/revoked permission, quiet hours, offline sign-out, timezone/DST and RTL/dynamic-type E2E-15/18/20 validation. Native unsigned compilation is not device delivery.
- **Blocking production:** reviewed scheduler deployment, actual APNs/FCM/Expo configuration and security, privacy consent for token transmission, delivery receipts/monitoring, runtime/scale and 15-minute lease policy. Flags remain off. Offline revocation may lag up to lease expiry and accepted pushes cannot be recalled.
- **Blocking production:** Android native build cannot run without a Java runtime. Prior Android/device gates remain.
- **Blocking progression:** P10 remains unopened until explicit checkpoint review/approval; full P09 exit remains BLOCKED while required device criteria are unverified.
- **Deferred improvement:** broader worker observability and expiry/retention policy need release review; derived streak query currently reads distinct owner dates.

## Inherited P08 register (verbatim)

# P08 carried gates — none silently closed

The user approved P07 with every gate and rollback caveat carried forward. P08 local test results do not close any external/native gate. P09 requires explicit approval after this checkpoint.

| Issue | Classification | Evidence needed / limit |
|---|---|---|
| Real provider quotas/model/project/tier/billing, daily/RPM/TPM/reset, shared traffic and paid fallback policy | Blocking production release of AI | Authorized provider-account evidence; every P07 test keeps AI mocked/off. No quota inferred. |
| Hosted CI, staging, PostgreSQL hosted version/roles/grants/migrations/backups/restore and client reconciliation | Blocking production release | Local PG16 tests and restoration are not hosted validation. No push/deploy/hosted DB action authorized. |
| Full physical iOS/Android journeys, camera/gallery, keyboard, RTL, dynamic type, VoiceOver/TalkBack, permissions, signing | Blocking production release; full P07 E2E acceptance unverified | E2E-10/11/12/19/20 have API/domain/component/role evidence, not complete device paths. Browser screenshots are synthetic component previews. |
| Android native compilation | Blocking production release | Fresh `./gradlew assembleDebug --offline` fails because Java runtime is missing. |
| P03 saved-meal edit UI and complete E2E-04 | Blocking production release of full journal scope | Canonical PATCH is tested; no new editing UI was smuggled into P07. |
| Full earlier photo, goal, repeat, recipe, copy, text, voice and label native journeys | Blocking production release | P01–P06 automated suites retained; full native acceptance still open. |
| Exact 10% macro-warning client floating-point boundary | Deferred non-blocking improvement (advisory; not nutrition mutation) | Dedicated exact-boundary fix/evidence still required. |
| Basis-correction original-basis/manualOverride provenance | Blocking production release of full nutrition provenance | Explicit before/after provenance still needs dedicated implementation/verification. |
| Photo protocol, adjudication, held-out permitted dataset, model IDs, component precision/recall, portion/calorie error, uncertainty calibration and stopping rules | Blocking production release of photo-quality claims | No new photo benchmark or accuracy claim in P07. |
| Hebrew/English on-device speech quality, models and privacy/artifact cleanup | Blocking production release of voice | Voice remains gated; mocked bridge tests/native compile do not prove speech quality or no-audio-leak behavior. |
| Native speech dependency patch maintenance | Deferred non-blocking improvement until next dependency upgrade | Revalidate the pinned patch before upgrading or enabling voice. |
| Dependency vulnerabilities | Blocking production release pending triage | P05 historical audit: 67 advisories (17 moderate/50 high). P07 did not run a fresh registry audit or close any advisory. |
| Actual Hebrew package-image OCR, held-out field/correction metrics, E2E-08/09 device routes | Blocking production release of OCR | P06 retailer transcription is not an image benchmark; OCR default-off. |
| Live Israeli barcode/lookup validation and broad regional catalog/measure coverage | Blocking production release of broad coverage claims | Current pinned source/parser fixtures pass; no live lookup or invented official catalog. Ministry CSV access was 403; approved lawful fallback remains. |
| English serving/confidence labels in Hebrew flow | Deferred non-blocking improvement | P06 localization minor retained. P07's own tracking/trend labels are bilingual. |
| Label cache physical expiry and private product/version/recipe/receipt retention/export policy signoff | Blocking production release | Read TTL is seven days, physical pruning on owner write/account erasure; no scheduler or legal signoff added. P07 measurements/receipts likewise require retention policy approval. |
| Pre-P01 deleted request identities and malformed legacy metadata | Blocking affected owners / legacy rollout | Lost deleted identities cannot be reconstructed; quarantine retains originals and prevents readiness until reviewed. |
| Large-day workflows/source limits | Deferred non-blocking improvement | Copy cap 20 groups; existing item bounds and 100 active private products remain disclosed. P07 measurement pages are 100 rows over at most 31 dates. |
| Lost AI in-memory results after restart | Deferred non-blocking improvement | Requires explicit new request, no automatic paid retry. |
| OFF combined/global catalog publication licensing | Blocking any future publication | No global catalog publication in P07; existing source attribution does not authorize all future combinations. |
| P06 label-draft rollback caveat | Blocking unsafe downgrade to P05 or earlier | Older draft validators reject label origin/long input. Keep compatible reader; preserve/complete/export/migrate pending label drafts before downgrade. |
| P07 pending measurement operations during rollback | Blocking unsafe client downgrade | Resolve pending requests or retain compatible P07 reader and receipts; never discard uncertain operations or drop tables. |

P08 adds blocking production gates: actual-device E2E-12/13/14/19; dietary/allergen review usability and cross-contact validation; operational privacy/retention/export approval for the new sensitive tables; hosted migration/restore and mobile rollout; live provider policy/quotas. Automated tests prove filtering of supplied user reviews, not factual completeness of labels or safety guarantees. Bounded 60-source pool and constrained AI sentence variants are disclosed non-blocking limits. P08 full acceptance remains BLOCKED pending external/native gates; explicit user approval is required to carry them into P09. No known gate is closed by this document.

P08 review minor (deferred non-blocking): the restrictions editor lacks AppState resume refresh. Another-device changes can remain visible until navigation focus/manual Refresh; version/erasure checks reject stale writes and the recommendation selection reread rejects changed restrictions. No known unfixed Important/Critical finding remains from the single review.

P09 review carry-forward: SecureStore identity loss/reinstall recovery and physical same-installation account-switch/token-generation validation remain production gates. Unregistered/legacy clients do not report their local unsynced state to the readiness registry; cross-client completeness is not proven. Registered-client checks do not imply knowledge of every offline client. No new minor finding was raised by the independent review.
