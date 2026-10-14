# P06 source and serving evidence

Observed 2026-10-14. No production import or paid calls.

- The [Israeli Ministry of Health dataset](https://data.gov.il/he/datasets/ministry-health/nutrition-database) is real. CKAN `package_show?id=nutrition-database` returned metadata: `other-open`, metadata updated 2023-03-21; nutrition CSV updated 2022-10-26, measures CSV 2022-01-04. It describes per-100-g composition, recipes and food-specific measures. The nutrition CSV URL returned **403 Forbidden** in this environment. No Ministry nutrition or measure rows were imported, inferred or copied from an unverified mirror.
- [Data.gov.il terms](https://data.gov.il/he/terms-of-use), updated 2025-08-30, permit commercial/noncommercial reuse with attribution, subject to dataset-specific terms and exclusions including third-party rights; no implied government endorsement. Metadata alone does not establish the rights of every underlying third-party row. Recheck the actual release, schema, column units and terms when access is restored.
- Approved fallback: existing [USDA FoodData Central](https://fdc.nal.usda.gov/data-documentation.html) public-domain composition, existing Open Food Facts product lookup, and explicitly confirmed private user products. Hebrew aliases are linguistic search aids, never fabricated Israeli composition. Composite foods remain recipe dependent; absent results ask for manual/recipe input.
- [Open Food Facts licensing](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/): database ODbL, individual contents DbCL, images CC-BY-SA. Retain product links/attribution. No OFF images or bulk data are newly redistributed here. Publication of an adapted/combined database needs a separate share-alike review; private corrections are never published globally by this implementation.
- Exact barcode identity takes precedence over a generic search suggestion. A product source outage is visible and does not create nutrition. Source/version/id remain visible, including duplicate USDA SR/FNDDS candidates.

## Serving extract

`src/foodlogger/data/servings.json` contains facts extracted from the already-present, hash-verified USDA SR Legacy 2018 archive, matched to the packaged composition checksum. Each record retains original portion ID, source label, quantity, grams, archive SHA-256 and source URL. No new universal density table.

Selected pita `fdc:174915`: small 28 g, large 60 g. Selected tahini `fdc:170189`: tablespoon 15 g. Selected cooked rice `fdc:168878`: cup 158 g. The rice US tablespoon is explicitly **derived** as cup/16 and teaspoon as cup/48; these are US customary measures for that food, not a definition of every household spoon. Source measurements themselves are estimates for an individual's portion. Other foods/versions without rows require weighed g/ml. Missing ml↔g density never defaults to one.

## OCR selection and limits

[ML Kit camera text languages](https://developers.google.com/ml-kit/vision/text-recognition/v2/languages) do not list Hebrew among supported/experimental/mapped camera-recognition languages; digital-ink recognition is a different capability. Apple Vision's supported-language API must be queried on the actual OS; a desktop probe is not iPhone Hebrew quality evidence. Physical-device Hebrew OCR and a held-out real package dataset remain release gates. P06 uses the existing budgeted gateway as an optional, default-off extraction adapter; every provider test uses an in-process mock. Manual label transcription and correction remain available.
