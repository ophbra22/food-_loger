# FoodLogger design

Build a Python portfolio project from the supplied description: food recognition
and estimated nutrition using TensorFlow. The original source is unavailable;
this is a new implementation. Default audience: Python and ML engineering roles.

## Product

A local, single-user web application. Upload a JPEG, PNG or WebP image, inspect
up to three food suggestions, confirm or correct the food, enter its weight,
then save it to a dated meal journal. Show calories and protein/carbohydrate/fat
totals, browse dates, delete entries and export CSV. Start with an empty journal.
Use a polished English UI for portfolio sharing and a Hebrew getting-started
guide for the owner. No accounts, cloud deployment or external nutrition keys.

## Architecture

Python 3.11–3.12, FastAPI, Pydantic, SQLite, Pillow, NumPy and TensorFlow 2.20.
Static HTML/CSS/JavaScript is served by FastAPI. All inference stays on the host.
Keep image validation, model inference, nutrition and persistence separate.
Do not store uploaded images. Use a separate `/workspace/foodlogger` project.

The default classifier is the published MobileNetV2 ImageNet checkpoint with a
documented subset of food labels. Display its original softmax scores without
renormalizing over foods. A low score or a non-food winner requests manual
selection. Model scores are not calibrated probabilities or measured accuracy.
No automatic fallback to invented predictions. Unavailable weights return an
actionable 503 while manual journaling continues to work.

Include a transfer-learning training CLI for folder datasets, compatible with
Food-101. Export a `.keras` model and ordered labels. Hold out validation data
from train only, keep test separate, report measured metrics and seed. Custom
models accept RGB 224x224 pixels in [0,255] and include their preprocessing.
No claim that a Food-101 model has been trained during this build.

Nutrition is grams / 100 multiplied by a bundled, explicitly illustrative
per-100g catalog. Food identity, recipe and portion size affect accuracy.
The user must confirm food and enter mass; no mass estimation from an image.

## Boundaries and verification

Images: maximum 8 MiB and 20 million pixels; decode and check true format.
Portions: finite numbers between 1 and 2000 grams. Strict ISO journal dates.
Database: parameterized SQL; meals retain nutrient snapshots.
No public hosting by default. Bind to loopback for a personal demo.

Test calculations, persistence, date isolation, API validation, malformed and
oversized uploads, non-food/uncertain predictions and model-unavailable handling.
Smoke-test real pretrained inference, the training pipeline on tiny synthetic
data (plumbing only), and desktop/mobile browser flows. Ship Docker and CI
configuration, clear model limitations, setup instructions and honest CV bullets.
