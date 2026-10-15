# SDD ledger — plan: docs/biteflow/roadmap.md

P09 only; base a16d75d2c38f2caddc82fcbb0dc1a97871e2be3f. User approved P08 with gates; no P10, live AI, production, push or deployment.

Ruling: Use roadmap A/B work units with logical commits rather than numbered-task helper extraction; existing approved plan uses phase letters. Cost if wrong: less automated task tracking; recorded evidence and commits remain auditable.

Ruling: Server-side dispatch checks authoritative state at decision time; no recurring local alerts. Push is off by default and external delivery is mocked in this phase. Device/backend delivery verification remains blocked. Cost if wrong: missed reminders until deployment/device approval, rather than misleading prompts.

Tasks: P09-A service/schema/streak/eligibility; P09-B delivery/native/settings; verification/review/checkpoint. Implement inline. Final reviewer only after complete candidate.

Ruling: Require all registered active-session devices to have a ready check within 15 minutes; skip late/DST-gap slots, use at-most-once receipts and 20-hour category cooldown. Preserve historical local dates, require explicit timezone adoption. Cost if wrong: missed reminders, especially with stale secondary devices/closed apps; offline revocation and in-flight delivery remain release gates.

P09-A RED: missing service, then initial integration mismatches recorded. GREEN: 23 targeted tests; expanded authoritative/ownership/DST cases added. Multi-device regression failed then passed after suppressing all when any registered device is uncertain. P09-B RED: missing session module/UI component; GREEN: mocked session and bilingual screen tests. No live providers called.

Candidate checks: baseline backend 471 pass/33 skip; baseline mobile 293 pass. PostgreSQL candidate 524 pass/9 skip; mobile candidate 300 pass (subsequent tests expanded). Exact final counts to be recorded after review. Android native attempt fails missing Java; no attempt to deploy/build remotely.

P09-A/B implementation and design committed; final reviewer receives full immutable range a16d75d..HEAD. Independent final review is the only delegated work.

Final review: one fresh gpt-6-astra/high reviewer, immutable range a16d75d..bf2adbc. Four Important, no Critical/Minor. All four enter one fix pass. No second reviewer.

Ruling: SecureStore installation proof plus monotonic lifecycle generation permits authenticated same-installation account transfer, with sorted owner locks and stale-generation rejection. The undeployed P09-only schema is updated additively relative to P08. Cost if wrong: lost/corrupt secure identity blocks reminders until recovery; device/reinstall security requires physical validation.

Final: Ruling: Physical iOS/Android permission, delivery, background/killed, rotation, RTL/accessibility remain BLOCKED; no device evidence available — cost if wrong: unobserved native defects.
Final: Ruling: Expo/APNs/FCM credentials, provider consent, signing and production remain unverified and unauthorized; flags stay off — cost if wrong: release cannot deliver notifications.
Final: Ruling: Provider/OS delivery timing and recall after acceptance are unverified; accepted tickets are not deliveries — cost if wrong: missed or late alerts.
Final: Ruling: Offline permission/sign-out/unsynced changes can lag during the 15-minute lease; preserve as release gate — cost if wrong: a prompt may arrive after an offline change.
Final: Ruling: Closed apps and stale secondary registrations suppress reminders under the documented conservative policy — cost if wrong: users miss reminders.
Final: Ruling: Unregistered clients do not contribute local pending state to readiness; flag the broader multi-client limitation for production — cost if wrong: unsynced activity on another client can make a prompt incorrect.
Final: Ruling: Scheduler scale, monitoring, receipt polling, retention/privacy/export and hosted restore remain release gates — cost if wrong: operational/privacy failures remain undiscovered.
Final: Ruling: Lifetime distinct-date streak performance remains deferred without large-history benchmarks — cost if wrong: slow streak reads.
Final: Ruling: Historical dates, current streak through yesterday, five-minute slots and 20-hour cooldown retain the documented product semantics — cost if wrong: users expect different streak/reminder behavior.
Final: Ruling: Inherited P03–P08 UI/provenance/OCR/speech/quota/advisory/rollback risks remain open — cost if wrong: prior unresolved defects carry into release.
Final: Ruling: Parent-owned mobile/build verification is used, not claimed as independently rerun by reviewer; Android fails missing Java — cost if wrong: platform regressions remain undetected until device/build validation.

Final: fixed online logout race — test_p09_online_logout_waits_for_dispatch_owner_lock RED→GREEN on PostgreSQL; concurrent account-erasure idempotence RED→GREEN.
Final: fixed offline account-switch token conflict — same-installation proof/generation regression RED→GREEN; foreign proof and late old generation rejected; SecureStore creation/failure tests RED→GREEN.
Final: fixed spring-DST gap tail — parameterized 02:56–02:59 regression RED→GREEN.
Final: fixed final-query deadline — controlled six-second query regression RED→GREEN; slot-boundary test green; oldest secondary-device lease boundary RED→GREEN.
Final: minor (deferred): None raised by final reviewer. Existing inherited minors remain in p09-open-gates.md.

Final fix pass verification: backend with real disposable PostgreSQL 535 passed/9 skipped; mobile 312 passed/63 suites; types/lint/ruff/format pass; wheel/sdist and all-platform JS export pass. Native iOS unsigned simulator build pass 245.62s; Android environment fails no Java. Browser and final recovery results follow in commands.jsonl. No phase acceptance is promoted beyond supporting evidence.

Final outcomes: browser 6 passed; unique Python passes 541, optional ML/LiteRT not run 3; PostgreSQL recovery PASS; all four Important fixes committed as 08a8c15. User already specified keep local/no push/merge/deploy, so finishing preserves branch without a redundant menu.
