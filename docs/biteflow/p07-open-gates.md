# P07 carried gates — none silently closed

These retain the user's explicit P06 approval with open gates. Local regression success does not establish external/native acceptance. P08 still requires explicit approval after the P07 checkpoint.

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

All five confirmed P07 review defects have failing-then-passing regressions and are fixed. Full P07 native/hosted acceptance remains blocking P08 without an explicit user decision to carry those gates. The checkpoint lists their final disposition separately; none are closed merely by this risk table. Product-scope decision: user approval may carry external gates into the next local phase, but does not authorize production release.
