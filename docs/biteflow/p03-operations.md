# P03 operations and rollback — local review only

No remote commands in this document have been executed. P03 uses the existing custom opaque-session API and private `foodlogger` schema; it does not introduce Supabase Auth or client-side database access.

## Additive schema and capability

- Migration: `supabase/migrations/20261014030916_p03_goal_revisions.sql`, created by `supabase migration new p03_goal_revisions`.
- Table: `user_nutrition_goal_revisions`, owner FK with `ON DELETE CASCADE`, unique `(user_id,version)` and `(user_id,id)`, owner/date index. Existing meals, snapshots, groups, receipts and core schema version remain unchanged.
- SQLite creates this additive table at existing AuthStore initialization, including standalone auth databases. Existing partial/tiny nutrition compatibility still follows P02's explicit migration procedure.
- PostgreSQL never runs DDL at application startup. Missing goal table yields `goals:false` in capabilities and 503 for goal endpoints. Existing meal routes remain usable.
- `FOODLOGGER_GOALS_ENABLED` accepts 0/1/false/true and defaults to **off**. It gates GET/PUT goals, daily-summary and new mobile progress. No environment file or deployment setting was changed.
- The private application role has SELECT/INSERT/DELETE, not UPDATE, on revisions; RLS is enabled and server-role-only. PUBLIC/anon/authenticated/service_role grants are explicitly revoked. Authorization still depends on each API/service query using the authenticated owner; the role itself serves multiple owners.

## Contracts

`GET /api/goals` returns `{version,revisions}` for only the current owner. History is append-only, ordered by owner revision version. `PUT /api/goals` sends all goal fields, `expected_version`, an ISO `effective_local_date`, IANA `timezone_id` and `allow_past` (false by default). Past means before today's date in the supplied zone; explicit acknowledgement is required. The device defaults to today and discloses historical changes. An owner lock and version check serialize updates; stale versions get 409. Same-date changes append another revision. The selected goal is the greatest effective date not after the journal date, then the latest version for that effective date. Creating a tomorrow revision cannot change yesterday.

Each target may be null. An all-null target revision clears goals from that date until another dated revision applies. Numeric technical bounds (not recommendations): calories 1–10000 kcal; protein/fat 0.1–500 g; carbs 0.1–1500 g; water 1–15000 ml; optional weight 1–500 kg. Calorie minimum band is 50–100%, maximum 100–150%; defaults 90%/110%. Inputs must be finite JSON numbers, not booleans/strings. Approximate macro energy (4/4/9) differing by more than 10% produces an advisory warning and never replaces entered targets.

`GET /api/daily-summary?date=YYYY-MM-DD` reads existing meal rows and goal history in one owner-locked transaction. It returns the existing day/meals/summary shape plus goals, progress and `logging_status`. There is no separate intake store. Nullable totals/known subtotals and partial flags remain P02-compatible. Every logged day is `logged_incomplete`; an empty day is `unlogged`. Neither says full intake is known. Empty journal totals remain arithmetic zero for compatibility, while adherence status and the UI explicitly say no food logged. Hydration consumed/remaining/progress remain null and untracked until P07.

Mobile stores journal days and goal history under separate account-scoped cache keys. One shared GoalsStore supplies both settings and Today; the active effective revision is selected for each day. Meal mutations recompute progress from confirmed journal rows. Goal saves publish a temporary revision, persist only acknowledged history, and restore the prior document with a visible notice on failure. A failed/uncertain request requires refresh before another write, because the server may have committed it. Refreshing the form locks its date/inputs/actions until the selected-date response settles. Old responses cannot undo a newer version or repopulate a closed/erased session.

## Activation gates and future procedure

Before any separately authorized activation: verify the actual environment, take and test its backup, inspect current schema/role grants, apply the reviewed additive migration under owner credentials, verify capability still off and legacy endpoints, run account privacy and current/history flows against staging, and collect real native E2E evidence. Enable the goals flag only after those gates. The local PostgreSQL 16 rehearsal is not evidence of hosted PostgreSQL/Supabase migration or hosted CI.

The repository CI already runs the PostgreSQL fixture; that fixture now loads P03 migrations and checks grants/RLS/concurrency/account erasure. Existing mobile, browser, formatting and build jobs exercise the new code. No CI workflow or production service was invoked.

## Rollback

1. Disable `FOODLOGGER_GOALS_ENABLED`; server capability becomes false and current clients fall back to their existing day route/clock/consumed totals on refresh. Goal forms become unavailable. Cached targets may remain visible as stale while offline; they cannot be saved until a successful enabled refresh.
2. Keep the additive table/revisions. P02 code ignores it; removing the data is unnecessary and destroys user history. Keep P02-compatible readers for nullable/tiny meal rows.
3. An in-flight save may already have committed when the flag changes; inspect retained revisions under owner scope rather than deleting them blindly. A retry with the old expected version is rejected.
4. For actual disaster recovery, restore the environment's verified backup using the approved maintenance procedure, then reconcile lost post-backup revisions and stale devices. A version rollback may require clearing device goal caches/re-sign-in; blindly presenting a pre-restore cache as authoritative is unsafe.

Local evidence: restricted-role PostgreSQL tests and disposable schema dump/restore preserved two exact goal revisions and their 2300/2500 effective-date selection. No production database or existing personal SQLite file was opened for migration.

## Carried risks

- Full native app E2E and assistive technology acceptance remain open. Synthetic component previews cannot certify authentication/navigation/photo-confirmation/saved-meal editing.
- The saved-meal detail route currently offers deletion, with no saved-meal edit screen. Lunch edits were verified through the canonical PATCH API and confirmed-row store replacement. The complete E2E-04 UI journey therefore remains open; this is not a claim that UI editing was delivered in P03.
- P02 photo quality/live quota/cost gate, held-out adjudication/protocol and staging gates remain unchanged.
- Goal history currently travels as a full owner document. Very long histories may need pagination/compaction with preserved revision semantics in a future scoped change.
- The client advisory macro warning has a deferred binary floating-point edge exactly at 10%; the backend warning and actual target/progress arithmetic remain correct.
