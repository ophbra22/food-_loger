# P02 photo evidence and held-out evaluation protocol

P02 keeps AI calls mocked by the user's explicit restriction. No model/provider was invoked, and no model, prompt, reference matching or segmentation change is justified by this run. The only image-pipeline change removes an identical prepared second image from the same request; a failing-then-passing mock contract establishes this duplicate-input defect, not improved recognition.

## What was measured locally

`evidence/p02/photo-fixtures.json` records SHA-256 validation and preparation time/size for the eight existing Nutrition5k fixtures. It exercises EXIF stripping, bounds and decode/resize infrastructure only. Its timings are not provider latency. `photo-reliability.log` exercises mocked responses, quota accounting/reserve, 429, malformed/truncated/oversized responses, ambiguous/no-food cases and replay. Mobile tests cover a three-item ambiguous mocked result, per-item confirmation, unknown values, shared adapters, cancellation and lost save response.

Existing `evaluations/meal_analysis/*report.json` are historical source artifacts, not new measurements. The eight-photo sample has already been used for development; none can now be honestly called held out. Its visible labels were annotated by an implementation agent without independent human adjudication. Published dish totals cannot prove individual-food portion accuracy or calibrated coverage.

## Preregistered proposal for a later explicitly authorized evaluation

Before any model/prompt tuning, obtain and license a new consented dataset with independent visible-item adjudication, weighed per-item portions, recipe/label nutrition, and explicit unknown ground truth. Assign stable meal IDs (all angles of a meal stay together), then freeze hashes and a stratified 60/20/20 development/calibration/held-out split. Include Israeli mixed plates/sauces, packaged foods, drinks, occlusion, lighting, no-food and single/three-plus item meals. The existing eight fixtures remain regression-only. Minimum useful pilot: 100 distinct new meals plus 20 no-food images; report the small-sample uncertainty and expand if confidence intervals are inconclusive. No such new dataset or adjudication has been obtained in P02.

Proposed acceptance must be reviewed before opening held-out labels: zero owner leakage/automatic saves/unknown-to-zero substitutions; successful-response visible precision and recall >=0.85; end-to-end recall >=0.80; no-food false-positive rate <=0.05; per-item median absolute percentage mass error <=25% for known nonzero weighed portions; meal kcal MAE <=100 on meals with complete ground truth; no >2 percentage-point regression in end-to-end recall or >10% increase in portion/kcal error against the frozen baseline on the identical split. These are **proposed targets, not achieved metrics**. Interval coverage must be measured with width by food class; current ranges are conservative heuristics, so do not label them calibrated confidence intervals or invent a coverage target after seeing results.

Record cold/warm provider latency p50/p95, all attempts/retries/errors/abstentions, token counts, model/project/tier/reset policy and observed allowance, plus actual billed cost or `unknown`. A cost/latency release threshold requires the separately verified project allowance and reviewed budget; there is no defensible quota or monetary threshold here. Report both conditional and end-to-end detection metrics, missing ground truth and failure denominators. Do not turn failed runs or absent weights into zero error.

## Gate

**BLOCKED for full recognition-quality acceptance.** Needed: explicit authorization to make live calls, independently adjudicated/held-out data, verified provider allowance/billing and accepted thresholds. Keep the existing provider behavior; do not proceed to P03 on a claim that mocks proved photo accuracy.
