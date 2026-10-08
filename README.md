# FoodLogger

**A little more insight into every bite.**

A local food-recognition and nutrition journal built with **Python, TensorFlow,
FastAPI and SQLite**. Upload a food photo, review the model's suggestions, enter
the portion weight, and keep a daily journal with estimated macros.

[מדריך התחלה בעברית](docs/START_HERE_HE.md) · [Model card](docs/MODEL_CARD.md) ·
[Third-party resources](docs/THIRD_PARTY.md)

![FoodLogger dashboard](docs/images/dashboard.png)

## Features

- **Real inference:** a cached MobileNetV2 checkpoint, 23 supported ImageNet food
  categories, top suggestions, and an explicit uncertain state.
- **Human confirmation:** manually correct the food and supply grams. A photo
  does not determine mass, ingredients or a recipe.
- **A complete journal:** add/delete meals, browse dates, view calorie and macro
  totals, and export a day's entries to CSV. Data persists in SQLite.
- **A clean backend:** typed validation, bounded image uploads, an OpenAPI API,
  dependency injection, and tests independent of model downloads.
- **A trainable pipeline:** stratified train/validation split, a separate test
  set, frozen-backbone transfer learning, fine-tuning, model checkpoints and
  reproducible model/label/metric exports.
- **A responsive UI:** no frontend build tool, external fonts, analytics or image
  API. Photos are decoded in memory and are not stored.

The pretrained classifier is an ImageNet baseline, **not a model trained on
Food-101 by this project**. The bundled nutrition values are illustrative,
rounded estimates; they are not a verified USDA data extract.

## Run locally

Use **Python 3.11 or 3.12**. Linux, Windows and Apple Silicon have TensorFlow 2.20
wheels; this project was exercised on Linux CPU. Intel macOS users can use the
Docker option or run the journal without the ML extra.

```bash
git clone https://github.com/ophbra22/food-_loger.git FoodLogger
cd FoodLogger
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[ml,dev]"
foodlogger download-model
foodlogger
```

On Windows, use `python` instead of `python3` and activate with
`.venv\Scripts\Activate.ps1` in PowerShell.

Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)**. Interactive API docs are at
[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

The weights are about 14 MB and are cached under `~/.keras/models/`, with SHA-256
verification. The first inference loads TensorFlow and takes longer. A GPU and
API keys are not required. After installation and weight download, inference
works offline. `pip install -e ".[dev]"` runs the journal without TensorFlow;
photo recognition then returns an explicit setup message instead of fake results.

The default journal is `runtime/journal.sqlite3`, relative to your launch
directory. Launch from the same directory, or set `FOODLOGGER_DB` to an absolute
path. The application is intended for local, single-user use and has no authentication.

## Usage

1. Select the date for your journal entry.
2. Upload a clear photo of one supported food (for example a banana or pizza).
3. Review the suggestions. Correct the food if needed, enter the actual weight,
   and add it to the journal.
4. View daily nutrition totals and switch dates to browse saved meals.
5. Export a day's entries as CSV or delete individual meals from the journal.

## Architecture

```text
Browser upload → size/format/pixel validation → RGB crop → TensorFlow
                                                         ↓
                                   original model scores + food candidates
                                                         ↓
                           user confirms food + measured weight in grams
                                                         ↓
                  per-100g catalog → nutrient estimate → SQLite snapshot
                                                         ↓
                                         daily summary / CSV export
```

```text
src/foodlogger/
  app.py           FastAPI factory and HTTP endpoints
  classifier.py    lazy model loading, inference, probability postprocessing
  images.py        upload and image validation
  nutrition.py     catalog lookup and portion scaling
  schemas.py       request validation
  storage.py       parameterized SQLite journal with nutrient snapshots
  training.py      training, fine-tuning, test evaluation and export
  cli.py           local server and model download commands
  data/foods.json  inspectable illustrative nutrition catalog
  static/          responsive CSS and browser behavior
  templates/       application HTML
scripts/           Food-101 split conversion
tests/             domain, API, inference policy and dataset tests
```

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Server health; does not preload or claim model readiness |
| `GET /api/foods` | Foods and nutrition provenance |
| `POST /api/predict` | Multipart `file`; JPEG/PNG/WebP, up to 8 MiB and 20 MP |
| `GET /api/nutrition?food_id=banana&grams=150` | Portion estimate |
| `POST /api/meals` | Save confirmed food, grams, date and meal type |
| `GET /api/meals?day=2026-10-08` | Meals and consistent totals for one date |
| `DELETE /api/meals/{id}` | Remove a journal entry |
| `GET /api/export?day=2026-10-08` | Download one day as CSV |

Example request:

```bash
curl -X POST http://127.0.0.1:8000/api/meals \
  -H 'Content-Type: application/json' \
  -d '{"food_id":"banana","grams":150,"day":"2026-10-08","meal_type":"breakfast"}'
```

## Train your own classifier

Prepare separate `train/<class>` and `test/<class>` directories with at least two
classes. Each class needs at least two training photos and one test photo.
Images must be JPG, PNG or BMP. Class names become the ordered output labels.

```text
datasets/my-foods/
  train/pizza/*.jpg
  train/ice_cream/*.jpg
  test/pizza/*.jpg
  test/ice_cream/*.jpg
```

For [Food-101](https://data.vision.ee.ethz.ch/cvl/datasets_extra/food-101/), obtain
and extract the dataset separately under its terms. This helper preserves the
official train/test partition and copies only the selected classes:

```bash
python scripts/prepare_food101.py \
  --source datasets/food-101 \
  --destination datasets/food101-small \
  --classes pizza ice_cream hot_dog

foodlogger-train --data datasets/food101-small --output models/food101-small \
  --epochs 5 --fine-tune-epochs 3 --batch-size 32 --seed 42
```

Validation uses a seeded 20% holdout from each training class. The test set is
not used for checkpoint selection. Fine-tuning unfreezes the last 30 backbone
layers while keeping BatchNorm frozen, at a lower learning rate. The best
validation-loss checkpoint across both stages is exported and evaluated once
on test data. Start with a small class subset; training is substantially faster
on a suitable GPU. Results depend on your dataset, seed and hardware.

Outputs: `model.keras`, `best.keras`, ordered `labels.json`, `split_manifest.json`
and `metrics.json` (sample counts, seed, TF version, loss, top-1 and top-k metrics).
For fewer than four classes, top-k may be trivial; inspect top-1 accuracy and
class balance. Training refuses a nonempty output directory to preserve runs.
`--weights none` is for smoke tests, not a useful pretrained baseline.

Use your exported model:

```bash
export FOODLOGGER_MODEL="$PWD/models/food101-small/model.keras"
foodlogger
```

In PowerShell: `$env:FOODLOGGER_MODEL = "$PWD/models/food101-small/model.keras"`.
The adjacent `labels.json` is loaded automatically. Custom models accept
`float32` RGB pixels in `[0,255]`, input `(None,224,224,3)`, with preprocessing
embedded and one softmax value per label. Only load models you trust.

Labels must match IDs in `data/foods.json` for automatic nutrition matching.
Unknown labels are shown as unmapped and require manual selection; nutrition
is never invented. To extend coverage, add a reviewed nutrition record with the
exact class ID and its provenance. An `imagenet_index` is only needed for the
default classifier. Duplicate paths across splits are rejected; near-duplicate
or copied image contents still need dataset curation.

## Verification

```bash
pytest
ruff check src tests scripts
ruff format --check src tests scripts
python -m build
```

Run the optional TensorFlow training/export/reload test:

```bash
FOODLOGGER_RUN_ML_TESTS=1 pytest -m integration
```

PowerShell: set `$env:FOODLOGGER_RUN_ML_TESTS = "1"` before `pytest -m integration`.
The integration fixture contains synthetic noise and proves pipeline operation,
**not food-recognition accuracy**. GitHub Actions runs ordinary checks on Python
3.11 and 3.12; a manual workflow also runs the ML smoke test.

Optional browser tests cover save/upload locking, invalid dates, persistence,
CSV export, deletion and mobile overflow:

```bash
python -m pip install -e ".[browser]"
playwright install chromium
FOODLOGGER_RUN_BROWSER_TESTS=1 pytest -m browser
```

Set `FOODLOGGER_CHROMIUM` to an existing Chromium executable if needed.

## Docker

```bash
docker compose up --build
```

Open the same localhost URL. Compose persists the SQLite journal and model cache
in named volumes, and exposes the port on loopback only. Weight download happens
at first inference. The Docker/Compose configuration has not been independently
validated across supported platforms.

## Configuration

| Variable | Default / meaning |
|---|---|
| `FOODLOGGER_DB` | `runtime/journal.sqlite3` |
| `FOODLOGGER_WEIGHTS` | Optional local MobileNetV2 ImageNet `.h5` checkpoint |
| `FOODLOGGER_MODEL` | Optional custom `.keras` model, takes priority over weights |
| `FOODLOGGER_LABELS` | Optional labels path; defaults next to custom model |
| `KERAS_HOME` | Keras cache directory; defaults to `~/.keras` |

If recognition is unavailable, run `foodlogger download-model`, verify the ML
extra was installed in the active virtual environment, and inspect server logs.
Manual logging continues to work. To change ports: `foodlogger --port 8001`.

## License

Code is MIT licensed; third-party models and datasets
retain their own terms. See [third-party notes](docs/THIRD_PARTY.md).
