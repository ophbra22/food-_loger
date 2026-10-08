# Explain FoodLogger in an interview

## A 60-second explanation

“FoodLogger connects an image classifier to a complete Python application. The
user uploads a food photo; TensorFlow returns food suggestions. The user checks
the prediction and enters grams, and the app calculates estimated nutrition and
saves the meal in SQLite. FastAPI exposes the same behavior as a documented REST
API. I separated inference, image validation, nutrition and persistence so that
most tests can run without downloading a model. The repository also contains a
transfer-learning pipeline with separate validation and test data.”

Adapt this to your own contribution after studying and running the project.
The current implementation integrates pretrained weights; it does not justify
a claim of having trained or evaluated a Food-101 model.

## Questions worth preparing for

**Why MobileNetV2?** It is a small, available TensorFlow baseline that runs on CPU.
ImageNet food coverage is limited, so dedicated food training is a logical next
experiment. A larger model may improve recognition but increases startup time,
memory use and inference cost.

**Why not estimate calories directly from pixels?** Calories depend on weight,
recipe and hidden ingredients. A single uncalibrated image cannot reliably infer
those quantities. Separating recognition from measured-portion calculation makes
the assumptions explicit and lets users correct the model.

**Why preserve full-model scores?** If non-food scores are removed and the rest
renormalized, a very weak food prediction can look confident. The app checks the
global top class and preserves its original score. The threshold is still a
heuristic, and neural softmax scores are not calibrated probabilities.

**Why FastAPI and SQLite?** FastAPI provides validated request schemas and OpenAPI
documentation. SQLite is sufficient for a local single-user journal and removes
database setup. An app factory and injected predictor make API tests independent
of ML downloads. Each database operation uses a short connection/transaction.

**What do the tests protect?** Portion scaling and invalid numbers; persistence,
date filtering and deletion; malformed/oversized uploads; food confidence policy;
API responses and CSV; dataset split integrity; and optional real TensorFlow
train/export/reload behavior. Mock-free domain tests are supplemented by a fake
unavailable classifier to exercise a genuine error path.

**What is the difference between transfer learning and fine-tuning?** First,
freeze the pretrained backbone and train the new head. Then unfreeze a limited
set of deeper layers with a smaller learning rate. Keep BatchNorm frozen for
small datasets. Select checkpoints on validation data and evaluate test once.

**What changes for production?** Authentication, user ownership of meals,
deployment configuration, request rate/concurrency limits, observability and
model versioning. Replace illustrative nutrition with verified records. Evaluate
accuracy, calibration and out-of-distribution behavior on realistic user photos.
Public hosting is not part of this local demo.

## A useful experiment to make the project your own

Train three food classes using the documented Food-101 subset. Record the split,
seed and environment; compare the frozen-head stage against fine-tuning. Measure
test top-1 accuracy, per-class precision/recall, a confusion matrix and CPU
latency. Save representative errors and discuss why they occur. Do not repeatedly
tune against the test set; use validation for model and threshold choices.

No promised percentage belongs in your résumé before the experiment exists.

## Suggested résumé entry

**FoodLogger | Python, TensorFlow, FastAPI, SQLite**

- Built a food-image recognition and nutrition-journaling application with a
  responsive UI, REST APIs, persistent meal history and CSV export.
- Integrated a pretrained MobileNetV2 classifier with explicit user confirmation
  and measured-portion nutrient estimates.
- Implemented a reproducible transfer-learning pipeline and automated tests for
  API behavior, data validation, inference decisions and dataset separation.

For ML roles, lead with the training/evaluation work after running your own
experiment. For backend roles, lead with API design, validation and persistence.
