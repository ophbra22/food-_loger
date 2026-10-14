# P05 checkpoint — 2026-10-14

**Phase:** P05 — Text & Voice Inputs (F06/F07). **Status: IMPLEMENTED LOCALLY; FULL ACCEPTANCE BLOCKED / UNVERIFIED.** Physical-device speech, privacy and accessibility verification and complete native journeys remain open. P05 is **not claimed complete or production-ready**. P06 has not started. No real AI calls, production operations, hosted database changes, push, merge or deployment occurred.

## 1. Features implemented

The approved requirements, repository roadmap and P00–P04 source/checkpoint history were reviewed before implementation. The user's approval of P04 authorized P05 continuation while carrying its open gates. Work reused the attached isolated worktree `/Users/braude/.codex/worktrees/biteflow-p01/food-_loger`, branch `codex/biteflow-p05`, base `3e96392`. The original project checkout's product files and dependency target were preserved.

- **P05-A text:** authenticated bounded Hebrew/English/code-switching input; deterministic number/fraction/unit parsing, scoped quantities and existing catalog references. Required `חצי פיתה עם חומוס וביצה קשה` becomes three food proposals; `200g chicken with rice and salad` assigns 200g only to chicken. Unknown household/volume amounts remain visibly unresolved, with original quantity/unit retained. Unsupported foods require a source/manual values. No fabricated conversions or nutrition.
- **Optional ambiguity assistance:** user opt-in plus server default-off flag and verified shared P01 gateway policy. One bounded request, no transport retry, strict partition schema and complete span validation, nutrition resolved from the existing catalog. Mocked 429/timeout/oversize/invalid schema/quota cases retain the deterministic result. No live provider policy/quota/cost claims.
- **P05-B speech:** pinned SDK57 bridge; just-in-time microphone permission; installed on-device locale requirement; denied/revoked/unavailable/error fallback; stop/cancel/background/unmount/account cleanup and bounded recording. Voice defaults off. iOS rejects unguarded binaries; a checksum-pinned native patch prevents unsupported-locale network fallback. No cloud STT, model download or persisted audio path.
- **P05-C editable voice:** microphone controls and HE/EN speech choice, editable private transcript, then the same F06 parser and P02 confirmation. The required Hebrew transcript is exercised through a mocked native boundary, corrected without rerecording and saved only after item/meal confirmation. Text remains usable after permission refusal or missing speech support.

All inputs reuse `MealDraft`, existing source/nutrition calculation, item editor, capabilities, canonical save, owner locks, receipts and journal/DayDial update. No P06 serving dataset/source import/barcode/OCR work was started.

## 2. Files and components

[Changed files](evidence/p05/changed-files.txt) gives the exact paths. Main groups:

| Area | Paths |
|---|---|
| Backend | `src/foodlogger/text_input.py`; endpoint/capabilities in `app.py`; default-off text AI setting in `security.py` |
| Mobile text | `src/domain/text-input.ts`, `components/TextEntry.tsx`, `app/(app)/add/text.tsx`, API adapter, draft origin/persistence validation, EN/HE strings and shared review warning mapping |
| Native adapter/config | `src/native/speech.ts`; `app.config.ts`; `plugins/with-on-device-speech.cjs`, `speech-guard.json`; exact dependency/lock, permission strings, `.env.example` |
| Mobile voice | `components/VoiceControls.tsx`, `app/(app)/add/voice.tsx`, conditional Add method and shared TextEntry slot |
| Tests | `tests/test_text_input.py`, `tests/fixtures/text-phrases.json`; text domain/entry, voice entry, speech session/bridge, plugin hash guard and resolved permission configuration checks |
| Review/recovery | This report, [operations/rollback](p05-operations.md), [speech feasibility](p05-speech-feasibility.md), [evidence](evidence/p05/README.md), roadmap and audit/matrix overlays |

## 3. Architecture and database

There is no schema change or migration. The existing positive canonical-portion contract is preserved: a text response can include unresolved proposals and a **nullable canonical draft**; it emits a canonical draft only when all normalized amounts are available. Mobile adapts proposals into the existing editable shared review without weakening save validation.

Text/transcript is private account draft data. Recognition supplies text only; the server supplies food proposals only; the existing writer commits intake only after confirmation. See [data flow, switches and rollback](p05-operations.md). Voice and ambiguity AI can be disabled independently, preserving text/manual entry and previously saved meals. Voice's switch is build-time and requires a reviewed rebuild/client rollback.

## 4. Actual commands and results

The [command manifest](evidence/p05/commands.jsonl) records exact argv, cwd, exit status and duration; full logs preserve failures and corrections. Ambient provider/production variables were stripped, Expo used a loopback API URL, and backend tests reject real HTTPX transport. Only a new owned disposable PostgreSQL database was reset.

| Executed command / tool | Actual result |
|---|---|
| `.venv/bin/pytest -q` with disposable PostgreSQL enabled | **395 passed, 9 skipped**, including existing 20 real PostgreSQL regression cases |
| `npm test -- --runInBand` | **212 passed, 41 suites** after independent review fixes |
| `FOODLOGGER_RUN_BROWSER_TESTS=1 .venv/bin/pytest -m browser -q` | **6 passed**, 398 deselected; existing Playwright regression, not mobile text/voice E2E |
| `npm run typecheck`; `npm run lint` | Passed; final lint has zero warnings |
| `.venv/bin/ruff check src tests scripts`; `.venv/bin/ruff format --check src tests scripts` | Passed; 75 Python files already formatted |
| `.venv/bin/python -m build --no-isolation --outdir <private-output>` | Wheel and sdist passed |
| `node --test plugins/__tests__/speech-guard.test.cjs` | **2 passed**: idempotence/version and unknown-source fail-closed checks |
| `node scripts/check-speech-config.cjs` | Both flag states passed against effective Expo config mods, including iOS microphone description and Android permission |
| `EXPO_PUBLIC_VOICE_ENABLED=1 npx --no-install expo prebuild --no-install`; `pod install` | Final generation and CocoaPods installation passed locally |
| XcodeBuildMCP `build_sim`, scheme Biteflow, iPhone 17 Pro/iOS 26.5, `CODE_SIGNING_ALLOWED=NO` | **SUCCEEDED**, 138.273 s, 634 warnings / 0 errors; current patched native module compiled, no installation/recording/device test |
| `npx --no-install expo export --platform ios --platform android --output-dir <private-output>` | Both Hermes JavaScript bundles passed |
| `./gradlew assembleDebug --offline` | **BLOCKED / exit 1:** no Java runtime available; no Android binary acceptance claimed |
| `npm audit --json`, baseline/current locks | **exit 1, 67 advisories each: 17 moderate, 50 high, 0 critical**; no newly named vulnerable packages, audit remains an open release risk |

Nine backend skips: six opt-in browser cases passed separately, two unavailable Lite-runtime checks, one opt-in ML integration case. Failed intermediate commands include intended TDD reds, route-type generation, a dynamic-import/Jest compatibility issue, effective native permission removal, a stop-event timer race, and an AppState test mock reset. None is silently relabeled a pass. The initial `expo install` installed the lock change but exited 1 because the dynamic config needed its plugin entry; subsequent generated-config/prebuild/build evidence supersedes only that configuration failure.

## 5. Regression evidence and review

Existing P01 account/receipt/date/100-concurrent mocked quota reservation, P02 partial/tiny/shared-confirmation, P03 goals/dial/version/cache and P04 library/recipe/copy/owner/transaction tests ran in the full suites. Deterministic text and repeat remain usable without AI. No journal row is created by parsing or speech. Native UI tests mock the microphone boundary; they are not live speech tests or complete E2E-02/03/20.

One fresh independent review of `3e96392..d941e5a` found **five Important issues, no Critical/Minor findings**. All were reproduced and fixed in one TDD pass (`18c84a2`):

1. Leading decimals and mixed Unicode fractions changed quantities → arithmetic normalization preserving `.5` and `1½`.
2. Input-token check raced a policy change → required payload bound checked under the reservation's policy lock, with dispatch policy-hash revalidation retained.
3. Unfinished descriptions resumed into blank review → real Home/Add/deep-review routing returns to text/voice entry; parsed edits stay in shared review.
4. Recurring gram quantities failed keyboard precision → validated metric portion survives persistence, totals, confirmation and source replacement, without rounding to four decimals.
5. Hebrew conjunction before digits merged foods → per-item numeric-prefix segmentation.

Related kg/l original-unit mislabeling and precision loss on source replacement were also reproduced and fixed. [Review/disposition](evidence/p05/review.md) links the RED→GREEN evidence and reviewer limits. The full suites and exports were rerun after fixes. No confirmed Important issue remains open from this review; no second review was performed. Native module/config sources were unchanged by the Python/JS review fixes, so the regenerated native compile evidence applies to those sources; final Hermes exports cover the final JS.

## 6. Outstanding gates and risks

| Gate | Status / required evidence |
|---|---|
| Real native HE/EN transcription and error/correction evidence | **BLOCKED:** actual supported iOS/Android devices, installed models and required utterances; no live recording performed |
| Audio privacy/cleanup on real devices | **BLOCKED:** traffic/artifact observation during stop/cancel/error/background/revocation; source guard and mocked tests are insufficient |
| Complete native E2E-02/03/20, RTL, large type, VoiceOver/TalkBack | **BLOCKED:** component tests and compilation only; real navigation/keyboard/restart/save/accessibility journeys not run |
| Android native build | **BLOCKED:** Java runtime missing; platform build/device checks still needed |
| Hosted CI / staging / hosted backup and role validation | **BLOCKED/unverified**, carried P01–P04; no authorized push/deploy/hosted operation performed |
| Real AI quotas, tier, policy, reset windows and paid-fallback verification | **BLOCKED/unverified**, carried P01; all requests mocked and no invented quota values |
| Exact 10% client macro warning boundary | **OPEN**, carried P03; P05 does not fix or close the known floating-point advisory boundary |
| Explicit basis-correction provenance | **OPEN**, carried P02; basis/manualOverride history still needs dedicated work |
| Photo evaluation protocol and held-out dataset | **BLOCKED**, carried P02; no benchmark or recognition-quality claims in P05 |
| P04 full native recipe/repeat/copy; prior P03 edit and photo native gates | **OPEN**, as recorded in prior checkpoints; running existing unit/component tests does not close complete journeys |
| Native dependency safeguard maintenance / dependency audit | **OPEN risk:** revalidate exact patch on upgrades; baseline/current audit each reports 67 advisories |

## 7. P05 acceptance

PASS means the **named local behavior** was actually tested, not release acceptance.

| Criterion | Result | Evidence |
|---|---|---|
| Required EN/HE food separation, quantity scope, fractions, code-switching | **PASS locally** | API fixture corpus and text proposal/domain tests |
| Missing/unsupported amounts/source visibly require review; no guessed household conversion | **PASS locally** | Blank normalized amount, original quantity/unit, source/manual questions and shared editor tests |
| No pre-confirmation intake write; same existing confirmation/save | **PASS locally** | API empty journal assertions; actual DraftProvider/text and voice component→shared editor confirmation tests |
| Optional AI only for ambiguity, budgeted one-attempt bounded schema, quota/error fallback | **PASS with mocked providers** | MockTransport text tests and P01 100-concurrent reservation regression; real policy gate remains BLOCKED |
| Native feasibility, default-off/on-device guard, just-in-time permission and lifecycle | **PASS for source/config/mocks and iOS compilation** | Bridge/session/patch tests, actual effective config and simulator build; device behavior remains BLOCKED |
| Required Hebrew transcript editable without rerecord; denial leaves typing; same parser | **PASS with mocked microphone** | Real voice/text UI integration tests; actual STT remains BLOCKED |
| Complete E2E-02/03/20 and device/privacy/transcription measurements | **BLOCKED** | Not executed on real supported devices; cannot infer from mocks or compile |
| E2E-14 allowance/concurrency and E2E-18 relevant failures/regressions | **PASS locally for P05 paths**, **BLOCKED for external/full journeys** | Mocked allowance/errors, cancellation/account tests and full suites; OCR/future phase/device/hosted portions unverified |
| Production readiness / overall P05 completion | **BLOCKED — NOT COMPLETE** | Required native, external and carried acceptance gates remain unverified |

## 8. Local commits and stop

| Commit | Logical unit |
|---|---|
| `74314a1` | P05-A deterministic text and bounded ambiguity fallback/shared review |
| `dd924ec` | P05-B pinned guarded native speech adapter/config/lifecycle |
| `d941e5a` | P05-C editable voice through shared text parser and confirmation |
| `18c84a2` | Review fixes: quantity grammar, atomic bound, resume routing and generated precision |

The following documentation commit archives this checkpoint/evidence; its hash is in local Git history. No PR was published. The branch/worktree is retained for review; generated native outputs and the isolated dependency copy are ignored. The original checkout’s dependency directory is unchanged; the earlier worktree node_modules symlink was replaced by a private copy to keep the pinned native patch isolated. The pre-existing `.venv` symlink is preserved.

Ordered decisions and deferred minors are archived in [progress.md](evidence/p05/progress.md) and reported to the user. **Stop at P05. P06 is unopened and requires explicit review/approval.**
