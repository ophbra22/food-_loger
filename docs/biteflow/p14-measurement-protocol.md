# P14 local measurement protocol

**Status: local preparation only. No observed post-release dataset, collector, telemetry destination, approved cohort, real provider costs or actual retention results. Full P14 acceptance is BLOCKED.** The user's local P14 approval does not authorize a release or collection. [All gates](p14-open-gates.md) and [P13 recovery instructions](p13-release-plan.md) remain binding limits on future work.

## Offline use

From the repository with Python3.11/3.12 and existing dependencies:

```sh
PYTHONPATH=src .venv/bin/python scripts/report_release_metrics.py --output /tmp/biteflow-empty-NEW
PYTHONPATH=src .venv/bin/python scripts/report_release_metrics.py --input docs/biteflow/evidence/p14/synthetic-input.json --output /tmp/biteflow-synthetic-NEW
```

Each destination must be new, with an existing parent. No downloads, requests, `.env` loading, app integration, database access or activation occur. The installed package also supports `python -m foodlogger.measurement_report` with the same arguments. Outputs: `report.json`, script-free self-contained `dashboard.html`, and an evidence-gap `backlog.md`. The default dashboard has **no numbers**. The synthetic fixture is explicitly invented test data; its window is fictitious and its numbers must never be cited as BiteFlow usage, cost or quality.

Input is UTF-8 JSON <=256KiB. Duplicate keys, unknown keys/metrics, malformed envelopes, nonfinite numbers, invalid counts, raw content fields and contradictory per-metric counts are rejected with a generic error (exit2). Existing files/directories/symlinks are never reused. A new directory is private mode0700. Rendering finishes before writing; an I/O failure or interruption can leave incomplete output in that new directory. Require exit0 and all three files before review. Inspect leftovers and use another new destination; do not overwrite evidence. Outputs are local files, not a publication or telemetry store. Input shape checks are not an anonymization guarantee: small aggregates and linkage hashes still require privacy approval and protected storage/retention. Do not put identifiers/content in this contract's metadata or encode them as numbers.

## Envelope and evidence boundaries

Exactly these fields: `schema_version:1`, `evidence_kind`, `window`, `release_commit`, `source_sha256`, `metrics`. `window` is UTC `[start,end)` using second-precision `YYYY-MM-DDTHH:MM:SSZ`, with start before end. One bundle contains one release/cohort/window; **never pool incompatible versions, platforms, policy cohorts or baselines**. Those eligibility/segment definitions are recorded separately in an approved evidence record, not raw identifiers in this tool.

- `none`: empty metrics and null window/digests; default when no evidence exists.
- `synthetic`: explicit window, optional lowercase40hex release and64hex source digests. All metrics remain test inputs.
- `unverified_observation`: explicit window and both digests required. A digest is a supplied declaration, not proof of deployment, consent, coverage or accuracy. The tool cannot upgrade this to verified. `input_sha256` is computed over actual input bytes, separate from declared source hash.

Every output remains `acceptance: BLOCKED`. A human evidence review and separately approved release are required outside this tool. No approval/threshold-success switch exists. Unknown evidence types, including `production_verified`, fail. Values remain descriptive: even a complete declared dataset with zero failures does not establish production readiness.

## Aggregates and arithmetic

`metrics` contains any subset of the fixed22 catalogue. Every supplied aggregate must have `coverage:"complete"|"partial"`. Missing metrics are `not_measured`; partial coverage suppresses the derived value but preserves aggregate and samples. `complete` means the supplier asserts the entire predeclared eligible cohort/window was covered; it is not automatically validated. Zero-sample rates/means/histograms are `no_samples`, with null value. Explicit zero counts/cost or0/N rates with N>0 remain zero.

- Rate: `numerator`, `denominator` integers,0<=numerator<=denominator; value100*n/d percent. HTML retains the computed JSON float's round-trip precision rather than rounding near100% or a proposed threshold; counts remain authoritative. Retries and distinct operations are defined below, never mixed.
- Weekly mean: same fields,0<=numerator<=7*denominator; value n/d days per eligible complete user-week.
- Count: `count` integer, no implied denominator or population adoption percentage.
- USD: `total_usd` nonnegative decimal string, up to6fractional places; no exponent, inferred cost, currency conversion or quota arithmetic. Preserve original string/precision. Unknown billing stays missing, even when attempts exist.
- Histogram: noncumulative `buckets` with strictly increasing `upper_bound_ms` and integer `count`; buckets cover `[0,b1]`, `(b1,b2]`, etc; `overflow` counts values greater than the final bound. All attempted duration measurements in the declared eligible set, including overflow, form the denominator. Nearest-rank p50/p95 yields only a bucket **upper bound**, or a `greater_than_ms` lower bound if the quantile falls in overflow. No interpolation or exact percentile is claimed. Failed/censored operations need separate failure rates; do not quietly drop them and claim general latency.

Computational bounds (not privacy or statistical thresholds): integer count<=1,000,000,000, histogram summed observations<=that bound,1–64buckets, each bound<=86,400,000ms (24h); longer durations belong in overflow. USD total<=1,000,000,000. These guards bound work and malformed input; they do not approve sample sizes. No raw timestamps per event/user enter the report.

## Metric definitions — proposed, approval required before collection

Assign owner, exact feature/build/platform subset, consent, retention, session/abandonment timeout, delayed-event cutoff and deduplication policy **before** observation. There are no approved default timeouts/cohort sizes. The tool validates arithmetic, not the truth of classification, cross-metric population coherence, missed events or selection bias. Export provenance/coverage must explain these independently.

| Metric ID | Numerator/count or duration population | Denominator / exclusion rules |
|---|---|---|
| photo_to_save_rate | Unique photo-start operations that reach one confirmed persisted save within the predeclared observation horizon | All eligible unique photo-start operations; use matured cohorts so pending/censored operations remain explicit, not guessed failures or successes |
| photo_to_save_latency_ms | Start-to-confirmed-persistence durations for the above completed operations | Completed operations only; pair with completion/failure/censoring evidence, not all-start latency |
| ingredient_correction_rate | Photo drafts with at least one user ingredient correction | All photo drafts actually shown for review; distinguish corrections from automatic provider rewrites |
| portion_correction_rate | Photo drafts with at least one user portion correction | Same eligible review population; a draft can count in both correction metrics |
| text_correction_rate | Text-derived drafts corrected before confirmation | All eligible text-derived drafts shown, not individual keystrokes |
| ocr_correction_rate | Label/OCR drafts corrected before confirmation | All eligible OCR drafts shown; simulated parsed labels are not real image accuracy |
| confirmation_abandonment_rate | Review operations with no confirmed save by the predeclared matured cutoff | All eligible review operations whose horizon is complete; exclude/report censored operations separately |
| repeat_log_latency_ms | Repeat-action start to confirmed persistence for completed unique operations | Completed repeats; show repeat/save failures separately; do not compare to different warmed/network conditions |
| logged_days_per_user_week | Sum of distinct local days with at least one persisted meal,0–7per user-week | All consenting eligible users' complete7day weeks, including zero-log weeks; exclude/report partial weeks, align agreed local week/time zone and DST, deduplicate retries; not retention |
| recipe_uses | Confirmed saves originating from a saved recipe | Unique save operation; excludes opens/previews and retries |
| water_uses | Confirmed water-log creates | Unique acknowledged operation; excludes opens/retries; edits are not new uses |
| goal_uses | Confirmed goal-update operations | Unique acknowledged update, not settings opens; no goal values collected |
| provider_attempts | Actually dispatched provider requests, including each explicit retry | Operational attempt count; mocks belong only in synthetic data; never infer users/quotas |
| provider_429_rate | Dispatched requests returning429 | Same dispatched request population including retries; blocked-before-dispatch attempts excluded and documented |
| provider_cost_usd | Explicit reconciled USD amount for the same approved provider/window | No inferred tariff/free-tier/billing; unknown/unreconciled amount stays missing/partial |
| crash_free_session_rate | Fully observed eligible sessions without crash | All eligible sessions with reliable end/crash classification; missing/censored sessions make coveragepartial; predeclare session boundaries |
| save_failure_rate | Unique save operations ending in unexpected failure | All eligible matured unique save operations; retry behavior resolved per operation; uncertain lost/duplicate writes tracked separately and block regardless of rate |
| db_query_latency_ms | Server-side duration for eligible completed database queries | Query count, predeclared query classes; separate timeout/failure coverage and same workload/cache/engine for comparison |
| health_duplicate_rate | Unique sync-export operations verified to leave an unintended duplicate external record | All reconciled eligible export operations; pending/provider-unreadable records are not assumed clean |
| sync_reconciliation_rate | Eligible matured reconciliation operations with verified expected state | All eligible matured reconciliation operations; unresolved receipts/pending deletions retained, not assumed success |
| widget_refresh_attempts | App-originated requests to refresh widget data | Attempts only; cannot imply OS redraw, visible-pixel clearing or user engagement |
| migration_failure_rate | Failed migration attempts | All authorized attempted migrations, including retries; local synthetic rehearsals not production observations |

## Comparisons, feedback and decisions

Keep baseline and candidate bundles separate; attach immutable source/config, feature subset, platform, cohort policy, UTC windows, sampling/coverage, metric definition version, numerator/denominator and independent evidence review. Do not compare incompatible populations or count-based usage without exposure normalization. This version deliberately does not automate baseline comparisons or statistical significance: no approved comparable baseline exists. Human review must retain adverse/insufficient evidence and the original predeclared thresholds.

P13's **proposals**, still unapproved: >=100 save attempts and investigate/no rollout if unexpected failure>1%; >=200 observed sessions and>=99.5% crash-free; comparable p95 latency regression>20% investigate; zero P0/P1, cross-owner disclosure, lost/duplicate confirmed save or unsafe restore/erase. Zero privacy/integrity defects is required regardless of sample size. Histogram bounds that overlap a threshold are inconclusive; the current summary does not establish an exact p95 comparison. Do not retrospectively tune thresholds or treat null/partial/synthetic values as passing. No thresholds for conversion, corrections, adoption or retention have been approved; no product gains claimed.

Feedback intake remains unactivated. Under separate approval, an owner summarizes consented feedback into a redacted issue category and supporting evidence reference held in an approved store; no raw meal/photo/audio/health/identity text in this repository or dashboard. Preserve contrary reports, deduplicate by agreed process, record sampling limits and never invent counts/quotes. Each proposed ticket has evidence, narrow reproducible problem, acceptance/test/rollback requirements and owner approval before implementation. Current backlog is based on documented code/evidence gaps, not user adoption findings.

## Reproduction and rollback

Generated empty/synthetic artifacts are committed under `evidence/p14/` for review. Rerun with a fresh destination and compare JSON/HTML/backlog byte-for-byte; outputs have no runtime timestamps. Local preparation adds two Python modules and one script only; no schema, dependencies, app events, routes or native changes. To withdraw P14, stop using the command and preserve evidence; use the pre-P14 checkpoint `6c1825e` in an isolated checkout or revert only additive P14 code/docs commits after reviewing subsequent work. No database rollback or flag change is required. Do not blanket-revert P13 or downgrade to P12: retain source floor`4d97784`, archive cleanup/retry, session guards, classifier security fixes and all earlier receipts/validator/native caveats. See the P13 release plan for separately authorized operational recovery; none is performed here.
