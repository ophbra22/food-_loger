# Meal analysis evaluation — 2026-10-13

These are real calls/results, including unsuccessful attempts. No ground-truth
weights or reference ingredient lists are sent to vision. This is a small
convenience sample, not a representative accuracy benchmark.

## Measured comparison

Eight Nutrition5k photos include seven meals (20 visible components total) and an
empty plate. Published measured mass/nutrition are retained unmodified. Visible
presence labels were checked against images by the implementation agent, with no
independent human adjudication. Transparent English alias matching scores labels;
it does not establish exact species, preparation or recipe correctness.

| Run | Successful images | Correct / extra / missed components on successful images | End-to-end recall | Mean successful latency |
|---|---:|---|---:|---:|
| Original MobileNetV2 | 8/8 | 0 / 0 / 20 | 0% | 0.43 s |
| Local Qwen3-VL 4B experiment | 8/8 | 13 / 4 / 7 | 65% | 13.80 s |
| Gemini 3.6 Flash attempt | 2/8 | 3 / 1 / 1 | 15% | 8.90 s |
| Gemini 3.5 Flash Lite initial | 2/8 | 6 / 0 / 0 | 30% | 44.83 s |
| Gemini 3.5 Flash Lite recheck | 8/8 | 20 / 0 / 0 | 100% | 20.67 s |

**End-to-end recall counts unavailable images as missed reference components.**
The conditional precision/recall fields in JSON use only successful images and
must not be presented as whole-service accuracy. The initial Lite run failed six
images; the recheck passed all eight. Both are retained. Transient 503s occurred,
and Flash's daily quota stopped its run. An eight-image successful recheck cannot
guarantee future availability or 100% real-world recognition.

On the final Lite run, mean absolute error over seven food plates was **28 g**
for total meal mass, **62.41 kcal**, **3.00 g protein**, **6.37 g fat** and
**3.59 g carbohydrate**. These are total-per-plate errors; errors can cancel across
components. They are not individual-food portion error or calibrated intervals.
The empty plate's dataset 1 g placeholder is excluded from these metrics.
All seven plates had complete matched nutrient values in that run. Guessed
portions and generic USDA recipe differences remain meaningful error sources.

The local Qwen report predates fixes to reference ranking (such as oatmeal being
matched to an oatmeal cookie). Its stored nutrient errors describe that historical
pipeline, not the current matcher. Its image-recognition results are still useful
as a documented local experiment. Hardware was the development Mac; this is not
an old Windows-PC benchmark.

## Other real checks

- `challenge-report.json`: two licensed Mediterranean photos tested in Hebrew.
  The falafel platter returned falafel, hummus, pita, a white sauce and vegetables.
  The source describes the white sauce as mayonnaise; the model suggests tahini,
  so the sauce result must be treated as ambiguous/incorrect, not counted as a
  verified successful identification. A partly visible background dish was omitted.
  Shakshuka, zaatar pita and dark coffee were returned for the second image.
  Several recipes had no exact USDA reference and correctly retained missing
  nutrition. There are no measured weights/calories for these photos.
- `challenge-attempt-report.json`: preceding run with a 503 for falafel and a
  successful response for shakshuka. Neither run is a weighed accuracy metric.
- `live-api-smoke.json`: real Gemini photo → authenticated FastAPI request → USDA
  matches → first portion edited to 100 g → atomic journal save → identical retry
  → correct diary totals. Temporary local SQLite; no production or iPhone claim.
- `vision-report.json` and `gemini-3.8-attempt-report.json`: failed early API/schema
  attempts, retained for transparency rather than reported as recognition results.
- A 2.5 Flash probe returned 404/unavailable to new users despite model listing.
  Hosted Gemma 4 probes returned 500, including a minimal image-only prompt.
  Neither alternative was added as a production fallback or benchmarked for accuracy.

No paid API calls. Electricity, hardware and engineering time are not zero-cost
claims. The Google project was verified Free Tier with no billing added.

## Reproduce

From the repository root, with Python 3.11/3.12 and the project installed:

```sh
python scripts/fetch_meal_eval.py
python scripts/evaluate_meal_analysis.py --mode baseline
FOODLOGGER_VISION_MODEL=gemini-3.5-flash-lite python scripts/evaluate_meal_analysis.py --mode vision --interval-seconds 5 --output evaluations/meal_analysis/new-report.json
FOODLOGGER_VISION_MODEL=gemini-3.5-flash-lite python scripts/evaluate_meal_challenges.py
FOODLOGGER_VISION_MODEL=gemini-3.5-flash-lite python scripts/smoke_meal_analysis_live.py
```

The baseline needs the existing TensorFlow model/runtime. Vision needs only the
backend's normal dependencies and a verified free-project key in local ignored
`.env` or process environment. These opt-in scripts make real external requests;
unit tests use transport fixtures and must never be represented as model accuracy.
The evaluator spaces requests and stops on quota exhaustion rather than upgrading
billing. Reports retain source image SHA-256 values through the manifest.

The benchmark does not measure known plate-size/second-angle improvements,
long-term uptime, multi-user load, physical-phone UX, all cuisines or hidden oil.
Do not infer that an empty-plate test covers all possible non-food photographs.
The supplemental examples cover some Mediterranean/multiple-dish cases that the
core manifest explicitly lacks; neither dataset provides full coverage.

## Attribution and licenses

- Eight `dish_*.png` files: **Nutrition5k**, Quin Thames et al., Google Research,
  CVPR 2021, [source](https://github.com/google-research-datasets/Nutrition5k),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
  Download URLs, original official test split, metadata hashes and source labels
  are in `manifest.json`. Files are unchanged; inference resizes a memory copy.
- `falafel-platter.jpg`: **Falafel platter**, Shreya13jain,
  [source](https://commons.wikimedia.org/wiki/File:Falafel_platter.jpg),
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), unchanged.
- `shakshuka-pita.jpg`: **Shakshuka and Pita with Zatar**, Robert Judge,
  [source](https://commons.wikimedia.org/wiki/File:Shakshuka_and_Pita_with_Zatar.jpg),
  [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/), unchanged.
- Nutrition reference data: **USDA FoodData Central**, public domain/CC0,
  [downloads](https://fdc.nal.usda.gov/download-datasets/). The bundled extract
  includes official IDs, archive URLs and SHA-256 values. Rebuild with
  `python scripts/import_usda_reference.py <directory-containing-the-two-ZIPs>`.
