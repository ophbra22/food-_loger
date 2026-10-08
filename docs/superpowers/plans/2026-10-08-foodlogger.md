# FoodLogger Implementation Plan

**Goal:** Deliver a runnable Python/TensorFlow food journal suitable for a portfolio.
**Architecture:** A FastAPI app composes a classifier, nutrition catalog and SQLite
repository. A browser client confirms predictions before saving a measured portion.
**Tech stack:** Python 3.11–3.12, TensorFlow 2.20, FastAPI, SQLite, vanilla JS, pytest.
**Spec:** `docs/superpowers/specs/2026-10-08-foodlogger-design.md`.

## Global constraints

- 8 MiB uploads, 20 million pixels, JPEG/PNG/WebP only.
- Portions 1–2000 grams; explicit ISO dates and finite numbers.
- No fabricated inference, accuracy claims, image-derived mass or seeded real meals.
- Single user, local host, image contents not persisted.

## Review focus

- Non-food inputs must not receive confident, renormalized food scores.
- Failed model loading must preserve the manual journal flow.
- Repeated browser actions and date changes must not show stale totals.
- Invalid image bytes must be rejected before TensorFlow runs.
- Custom label ordering and embedded preprocessing must survive train/export/load.

## Task 1: Domain and persistence

Files: `src/foodlogger/{nutrition,schemas,storage}.py`, `data/foods.json`,
`tests/test_domain.py`, `pyproject.toml`.
Interfaces: `Catalog.estimate(food_id, grams)`, `Journal.add(MealCreate, catalog)`,
`Journal.list(day)`, `Journal.delete(id)`, `Journal.summary(day)`.
- [x] Write failing tests for portion scaling, invalid input, date isolation,
  reload persistence and deletion.
- [x] Implement catalog, validation and SQLite repository.
- [x] Run `pytest tests/test_domain.py` and confirm pass.

## Task 2: Inference and API

Files: `src/foodlogger/{classifier,images,app}.py`, `tests/test_api.py`,
`tests/test_classifier.py`.
Interfaces: `Classifier.predict(image)` returns candidates/status/model; app
factory accepts a classifier dependency and database path.
- [x] Test actual probability postprocessing, unsupported/non-food classes,
  malformed images, API estimates, create/delete/export and unavailable model.
- [x] Implement cached, lazy TensorFlow inference and FastAPI endpoints.
- [x] Run all tests; fetch and smoke-test the real pretrained checkpoint.

## Task 3: Browser, training and delivery

Files: `templates/index.html`, `static/{app.js,style.css}`, `training.py`,
`tests/test_training.py`, README, Hebrew guide, model card, Dockerfile and CI.
- [x] Build upload/confirm/save journal flow, keyboard access, responsive layout,
  error/empty/loading states and CSV download.
- [x] Test dataset validation and train/export/reload a tiny fixture model.
- [x] Implement repeatable training and separate test evaluation CLI.
- [x] Document setup, dataset provenance, limitations, demonstration and CV text.
- [x] Verify full pytest, Ruff, package build and real browser flow; review code.
- [x] Package source ZIP excluding environments, runtime data and caches.

## Execution notes

The user's request authorizes building the project; make reversible implementation
choices and continue without additional approval gates. Default to the combined
Python/ML scope while the optional target-role question is pending.

Review complete: fixed save/upload concurrency and date validation/display cases.
The original GitHub repository contains one empty Python file; retain it and its history.
