# Model card

## Default inference

- Architecture: MobileNetV2, width multiplier 1.0, input 224×224, ImageNet 1,000-class head.
- Checkpoint: the published Keras weights from
  [JonathanCMitchell/mobilenet_v2_keras](https://github.com/JonathanCMitchell/mobilenet_v2_keras).
- SHA-256: `3e195a2857356cfc092cbbb460beb2a5bce279015d7792598b8d3d9e451902e3`.
- Preprocessing: EXIF orientation, RGB conversion, centered aspect-ratio crop,
  bilinear resize, float32 pixels scaled to `[-1,1]`.
- Output: original 1,000-class softmax scores. Up to three supported foods with
  scores at least 0.01 are displayed. Scores are **not renormalized** over foods.
- Decision policy: a supported global top-1 food with score ≥0.20 is a possible
  match. Otherwise the app abstains from preselection. Every result still needs
  user confirmation. This is a heuristic, not validated confidence calibration.

ImageNet has generic food classes. These do not guarantee a specific recipe,
preparation method, ingredients or nutritional profile. For example, `pizza`
maps to an illustrative cheese-pizza entry, which the user must review. The
`Granny_Smith` label maps to a generic apple entry. Chicken, rice, egg and salad
are available for manual logging but are not mapped by the default classifier.

## Intended use and limitations

This application classifies one main food per image. It does not perform object
detection, segmentation or portion measurement, and is not a medical tool or
food-safety system. Multiple foods, occlusion, unfamiliar dishes and non-food images can
produce incorrect high scores. Backgrounds and camera conditions affect results.

No project-specific test-set accuracy, fairness analysis or out-of-distribution
benchmark is claimed for the default model. A real pizza photo was used for an
operational smoke test; that single result is not an accuracy estimate. Do not
reuse published ImageNet accuracy as this application's food-recognition accuracy.

## Nutrition

`data/foods.json` contains 27 illustrative entries in kcal and grams per 100 g
edible portion. Values are rounded representative estimates inspired by generic
USDA FoodData Central foods, not a licensed/verified record-level extract. This
provenance and limitation are displayed by the app and API. Replace entries
with verified, attributed records for a serious nutrition application.

The app computes `nutrient_per_100g × entered_grams / 100`, rounding to one
decimal. Journal totals sum the saved, rounded values. Users supply mass between
1 and 2000 g. Nutrient snapshots ensure historical meals do not silently change
when the catalog is edited. Calories may differ from a 4/4/9 macro calculation
because source estimates, fiber and rounding vary.

## Custom training and reproducibility

The pipeline uses MobileNetV2 as a frozen feature extractor, augmentation,
global average pooling, dropout and a new softmax head. An optional second stage
fine-tunes the last 30 layers except BatchNorm. Augmentation runs during training
only; normalization lives inside the exported model.

A seeded per-class validation split is taken only from training data. The
separate test split is evaluated after validation-based checkpoint selection.
The official Food-101 split is preserved by the optional conversion helper.
Path overlaps are rejected. Content duplicates, label noise and imbalance still
require manual dataset inspection. Exact GPU/CPU numerical equivalence is not
guaranteed; seed and TensorFlow version are recorded.

The default confidence heuristic is also used for custom models and has not
been calibrated for their class count. Revisit it using validation data before
claiming reliable abstention. With two classes, softmax scores around 0.5 can
occur for meaningless inputs. Confirmation is always required.

No Food-101 weights or measured Food-101 results are bundled. A synthetic noise
dataset is used only to verify training, fine-tuning, export and reload behavior.
Its metrics have no food-recognition interpretation.

## Privacy and operational scope

Uploaded images are held in memory and released after inference. Oversized
requests are bounded before multipart parsing. Journal data lives in a local
SQLite file. No user accounts or multi-tenant isolation are implemented. Only
model weights are downloaded; image content is not sent to the model host.
