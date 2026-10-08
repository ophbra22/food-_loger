# Delivery verification

Verified on 2026-10-08 with Python 3.12.14, TensorFlow CPU 2.20.0 and Chromium on
Linux. No project-specific food accuracy benchmark was performed.

## Checks exercised

- 37 core tests: nutrition scaling and finite bounds, SQLite persistence,
  date filtering/deletion, strict date validation, API/CSV behavior, image
  limits/decoding, unrenormalized model scores, abstention, unavailable-model
  errors and deterministic dataset separation.
- 3 real Chromium tests: save locks uploads and edits until it completes;
  clearing the date removes stale totals/export; manual add/reload/export/delete
  works with no horizontal overflow at 390 px width.
- 1 TensorFlow integration test: synthetic two-class data through one head
  epoch, one fine-tuning epoch, validation checkpoint selection, test evaluation,
  Keras export, label reload and inference. This tests plumbing, not accuracy.
- Real pretrained MobileNetV2 inference on a food photograph: top candidate was
  pizza with original model score 0.539. The image was also uploaded through the
  browser; prediction, confirmation, portion calculation, save and delete passed.
- A solid-color image produced an uncertain result. No general claim of reliable
  non-food rejection follows from this smoke check.
- Desktop and mobile screenshots inspected; no browser JavaScript errors in the
  real upload flow.
- Ruff lint/format and Python source/wheel builds passed.
- Independent code review identified a save/upload race and two date-handling
  issues; regression tests reproduced them before fixes and passed afterwards.

Ordinary `pytest` skips the four optional browser/ML tests. Set both
`FOODLOGGER_RUN_BROWSER_TESTS=1` and `FOODLOGGER_RUN_ML_TESTS=1` to run all 41 tests
with their dependencies installed.

## Practical limits

- Full Food-101 training, model calibration, dataset fairness and accuracy
  benchmarking were not run. No trained Food-101 model is included.
- Docker/Compose configuration was not built or started in this environment.
- macOS, Windows and a physical mobile device were not tested; mobile layout was
  checked in Chromium at a narrow viewport.
- The ML smoke run emits upstream Keras/NumPy deprecation warnings; they did not
  prevent training, saving, loading or prediction. These are not suppressed.
- The GitHub Actions workflow is supplied; local checks do not establish its
  status on a remote runner.
