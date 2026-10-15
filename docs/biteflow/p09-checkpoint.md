# P09 checkpoint — Notifications, streaks and preferences

**Status: local implementation delivered; full acceptance BLOCKED. P10 NOT STARTED.** User approval of P08 carried prior gates forward; it did not verify them. Branch `codex/biteflow-p09`, base `a16d75d2c38f2caddc82fcbb0dc1a97871e2be3f`. Worktree `/Users/braude/.codex/worktrees/biteflow-p01/food-_loger`; primary checkout preserved. Independent review fixes and final evidence are recorded below.

## Implemented

- Derived current/longest streak and total logged days from confirmed local meal dates; water/goals/future dates do not increment. Missing yesterday breaks at local midnight; DST and travel policy documented.
- Independently opt-in meal, water and evening slots, mute, quiet hours, IANA timezone and EN/HE preferences with optimistic version checks. Existing lunch suppresses lunch; water checks current goal/progress; uncertain state suppresses.
- Additive private owner/session device registry, rotation/revocation, permission/pending-entry checks and short freshness lease. Default-off one-shot dispatch with durable deduplication, authoritative recheck and mocked HTTP transport. No repeated local schedules.
- Bilingual reminder settings, streak counts and local time inputs, capability/error/permission messages and lifecycle refresh. Existing nutrition/save/draft contracts are unchanged.

Detailed architecture, data flow, limitations, official source links and rollback: [design](p09-design.md). Full inherited risks: [open gates](p09-open-gates.md).

## Files and schema

Backend: `src/foodlogger/habits.py`, `reminder_delivery.py`, `app.py`, `auth.py`, `security.py`, `data/habits.sql`; PostgreSQL `supabase/migrations/20261015132704_p09_habits.sql` adds three private tables, owner/session cascades, role grants and RLS. No production schema was changed.

Mobile: `src/native/notifications.ts`, `notifications-session.ts`, `components/NotificationLifecycle.tsx`, `Reminders.tsx`, `domain/habits.ts`, `i18n/habits.ts`, reminders route/navigation, API methods, tracking settlement accessor, auth cleanup, SDK-compatible expo-notifications dependency/lock and config plugin. Generated native directories remain ignored. Tests: `tests/test_habits.py`, `test_reminder_delivery.py`, `test_postgres.py`, five mobile suites under domain/native/components; additional review regressions in `tests/test_habits_review.py`.

## Acceptance evidence

| Criterion | Status | Evidence / limits |
|---|---|---|
| Versioned opt-in settings, mute and quiet hours | PASS locally | Defaults, malformed input, conflicts, quiet hours, UI blank opt-in tests |
| Two logged consecutive dates -> streak two; no water/goal increment | PASS locally | Confirmed-date/duplicate/future/water-only/goal-only tests |
| Logged lunch suppresses lunch reminder | PASS locally | Actual SQLite queries; category test; no AI |
| Conditional water prompts | PASS locally | Unknown goal suppresses; below target sends; reached target suppresses |
| Timezones, local midnight and DST | PASS deterministic; BLOCKED on devices | Repeated hour dedup, spring gap, historical dates, travel cooldown/mismatch |
| Unknown/stale state and duplicate workers suppress | PASS locally | DB failure, lease expiry, multi-device uncertainty, concurrency, durable-claim recheck |
| Denied permission harmless; rotation/logout/owner isolation | PASS mocked/local; BLOCKED on devices | Mobile mock session tests, API token tests, real PG FK/RLS tests |
| No production/live AI/push/deployment operations | PASS for this work | Local commands, network-blocked tests, default-off worker invocation |
| Migration, rollback and recovery | PASS local PG16; BLOCKED hosted PG17 | Role matrix and disposable backup/restore rehearsal |
| E2E-15/18/20 on supported devices | BLOCKED | Local logic/component coverage does not substitute for physical delivery, permission, RTL, accessibility and background behavior |
| Full P09 exit | BLOCKED | Required native/device/operational gates still open; flags stay off |

## Safety and rollback

No push, merge, deployment, production operation, live AI/provider request, or destructive production migration. Only disposable test schemas were reset. No hardcoded secret added. Credentials in fixtures are synthetic; server-only Expo token config reads runtime environment. Stop worker first, keep flags off, preserve opt-ins/device/attempt tables, optionally revoke writes using [rollback SQL](rollback-p09.sql), and retain compatible clients for cleanup. Already handed-off notifications cannot be recalled. Offline revocation may lag up to the 15-minute lease. P06 label-draft, P07 pending-measurement and P08 restriction/review caveats remain open.

## Actual candidate verification

Commands run from the isolated worktree through `python3 docs/biteflow/evidence/p09/run.py <name> <directory> <command...>` (sanitized environment; see [command manifest](evidence/p09/commands.jsonl)). These are candidate results; the final reviewed run is listed below when review finishes.

| Check | Actual command | Result |
|---|---|---|
| Backend + real local PostgreSQL | `.venv/bin/pytest -q -rs` with disposable test DSN | 525 passed, 9 skipped; 534 collected |
| Browser regressions | `.venv/bin/pytest -m browser -q -rs` | 6 passed, 528 deselected; resolves six opt-in skips |
| Mobile | `npm test -- --runInBand` | 310 passed, 62 suites; zero failed/skipped |
| TypeScript | `npm run typecheck` | PASS |
| Mobile lint | `npm run lint` | PASS, zero warnings/errors |
| Python lint / formatting | `.venv/bin/ruff check src tests scripts`; `.venv/bin/ruff format --check src tests scripts` | PASS; 97 files formatted |
| Backend packaging | `.venv/bin/python -m build --no-isolation --outdir .superpowers/sdd/roadmap/dist-candidate` | wheel + sdist built |
| Mobile JS export | `npx --no-install expo export --platform all --output-dir ../.superpowers/sdd/roadmap/export-candidate` | iOS / Android / web PASS |
| Native generation | `npx --no-install expo prebuild --no-install`; `pod install --no-repo-update` | PASS |
| iOS native | `xcodebuild -workspace ios/Biteflow.xcworkspace -scheme Biteflow -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ../.superpowers/sdd/roadmap/ios-build -disableAutomaticPackageResolution CODE_SIGNING_ALLOWED=NO build` | PASS unsigned Debug simulator |
| Android native | `./gradlew assembleDebug --offline` | FAIL environment: no Java runtime; compilation not reached |
| Rollback / restore | `.venv/bin/python docs/biteflow/evidence/p09/rehearse.py` | PASS owned PG16 only |
| Worker default | `.venv/bin/python -m foodlogger.reminder_delivery` | PASS inert: “Reminder delivery disabled.” |
| Expo dependency check | `npx --no-install expo install --check` | exit 0, explicitly warns offline validation is unreliable; not authoritative online compatibility proof |

Candidate unique backend passes: **531**, with **3 optional ML/LiteRT tests NOT RUN**. No Python static type checker is configured; do not describe Ruff as type checking. Live AI, actual push/network token registration, physical-device testing, hosted CI/staging and signed release verification: **NOT RUN**. Earlier failed RED/check runs remain in evidence, including initial test fixture/validator/lint errors that were corrected. P01–P08 regression coverage is the full existing backend/mobile/browser suite; previously unverified external functionality is not promoted to passed.


## Independent review and fixes

One independent reviewer found four Important issues (no Critical/Minor): online PostgreSQL logout race; offline account-switch token conflict; reminders at the tail of a nonexistent DST hour; final-query time omitted from the decision deadline. All four were reproduced and fixed in one pass. See [review report](evidence/p09/review.md), [decision ledger](evidence/p09/ledger.md), and retained RED/GREEN logs. Additional regressions cover concurrent account deletion, slot boundaries and earliest secondary-device expiry. No second review or live push was used.

SecureStore now retains only installation ownership proof and a monotonic generation across account logout; server stores a hash. Authenticated same-installation transfer rejects foreign proofs and stale registrations. This is a new P09-only contract, with earlier P01–P08 clients unaffected. Physical/reinstall proof handling remains unverified.

## Final reviewed results

- `.venv/bin/pytest -q -rs` with disposable PostgreSQL: **535 passed, 9 skipped, 0 failed** (544 collected). Includes **26 actual PostgreSQL tests**, not mocked database acceptance. Full backend P01–P08 regressions included.
- `npm test -- --runInBand`: **312 passed, 63 suites, 0 failed/skipped**. Includes existing P01–P08 mobile regressions.
- TypeScript, mobile lint, Ruff and Python format check: PASS; **98 Python files** formatted. Wheel/sdist and all-platform Expo export: PASS after fixes.
- Browser final rerun: **6 passed, 538 deselected, 0 failed**. These resolve six opt-in skips: **541 unique Python tests passed, 3 optional ML/LiteRT tests NOT RUN**. Final PostgreSQL rollback/backup/restore rehearsal also PASS.
- Unsigned native iOS simulator compilation: PASS, **245.62 seconds**. Final fixes change Python/TypeScript and additive schema, not native dependency/configuration; latest JS export is independently verified. Android native: environment FAIL, missing Java.
- Package installation reported **67 advisories (17 moderate, 50 high)** and peer warnings; no new dependency-security triage or forced upgrade was performed. This gate remains open. Offline Expo check is not authoritative online verification.

All production/hosted/provider/device gates remain open. Known P09 limitations: no immediate revocation while offline, no recall after handoff, short lease can suppress closed-app/secondary-device reminders, unregistered clients' local state is unknown, and delivery receipt operations/retention/privacy need release review. These block production or full native acceptance; none is silently marked complete. No new independent-review minor was deferred; inherited minor issues remain listed.

Stop point: **P09 checkpoint only. P10 requires explicit review and approval and has not started.**


## Local commits and review artifacts

- `27722f678c7b36f82b897514301139ddb357721f` — habits service/schema, dispatch and backend tests.
- `3a9ad2b9d5105dd927049d7181bd0dd1e9be62d4` — mobile notification lifecycle/settings/tests.
- `bf2adbcc3c0f4f9c18e08dea4298455d8b7a889d` — design, gates and rollback.
- `08a8c15bde04d175be119b0ce8a579dfb8a37b60` — all four independent-review fixes and regressions.
- A final documentation/evidence commit contains this checkpoint; its exact hash is supplied in the final response and `git log`.

[Full changed-file list](evidence/p09/changed-files.txt), [commands/results](evidence/p09/commands.jsonl), [review](evidence/p09/review.md), [ledger/rulings](evidence/p09/ledger.md), [file hashes](evidence/p09/manifest.json), [rollback](p09-design.md). Owned Metro and disposable PostgreSQL were stopped. Only this plan's generated scratch artifacts were removed; the branch/worktree is retained. Final tracked worktree state is checked after committing, with the pre-existing `.venv` symlink left in place. The primary checkout's pre-existing untracked files were not altered.
