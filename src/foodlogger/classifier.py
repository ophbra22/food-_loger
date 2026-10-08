"""Real TensorFlow inference, with explicit abstention and no fabricated fallback."""

import json
import os
import threading
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

from foodlogger.nutrition import Catalog

WEIGHTS_URL = (
    "https://github.com/JonathanCMitchell/mobilenet_v2_keras/releases/download/v1.1/"
    "mobilenet_v2_weights_tf_dim_ordering_tf_kernels_1.0_224.h5"
)
WEIGHTS_SHA256 = "3e195a2857356cfc092cbbb460beb2a5bce279015d7792598b8d3d9e451902e3"


class ModelUnavailable(RuntimeError):
    pass


def rank_predictions(scores: np.ndarray, catalog: Catalog, labels: list[str] | None = None) -> dict:
    scores = np.asarray(scores, dtype=float)
    expected = len(labels) if labels is not None else 1000
    if (
        scores.shape != (expected,)
        or not np.all(np.isfinite(scores))
        or np.any(scores < 0)
        or np.any(scores > 1)
        or not np.isclose(scores.sum(), 1, atol=0.01)
    ):
        raise ModelUnavailable("Model output must be a softmax vector matching its labels.")
    mapping = (
        dict(enumerate(labels))
        if labels is not None
        else {
            food["imagenet_index"]: food["id"]
            for food in catalog.foods.values()
            if food["imagenet_index"] is not None
        }
    )
    winner = int(np.argmax(scores))
    supported = mapping.get(winner) in catalog.foods
    candidates = []
    for index in np.argsort(-scores):
        food_id = mapping.get(int(index))
        if food_id not in catalog.foods or scores[index] < 0.01:
            continue
        food = catalog.get(food_id)
        candidates.append(
            {
                "food_id": food_id,
                "name": food["name"],
                "emoji": food["emoji"],
                "score": round(float(scores[index]), 4),
            }
        )
        if len(candidates) == 3:
            break
    return {
        "status": "recognized" if supported and scores[winner] >= 0.2 else "uncertain",
        "candidates": candidates,
        "unmapped_label": mapping.get(winner) if labels is not None and not supported else None,
    }


def download_weights() -> str:
    import tensorflow as tf

    return tf.keras.utils.get_file(
        "foodlogger_mobilenet_v2_1.0_224.h5",
        WEIGHTS_URL,
        cache_subdir="models",
        file_hash=WEIGHTS_SHA256,
        hash_algorithm="sha256",
    )


class Classifier:
    def __init__(self, catalog: Catalog):
        self.catalog = catalog
        self.model_path = os.getenv("FOODLOGGER_MODEL")
        self.name = "Custom food classifier" if self.model_path else "MobileNetV2 · ImageNet"
        self._model = None
        self._labels = None
        self._lock = threading.Lock()

    def _load(self):
        import tensorflow as tf

        if self.model_path:
            label_path = Path(
                os.getenv("FOODLOGGER_LABELS", str(Path(self.model_path).with_name("labels.json")))
            )
            labels = json.loads(label_path.read_text())
            if (
                not isinstance(labels, list)
                or not labels
                or not all(isinstance(label, str) and label for label in labels)
                or len(labels) != len(set(labels))
            ):
                raise ValueError("labels.json must contain unique ordered class names")
            model = tf.keras.models.load_model(self.model_path, compile=False, safe_mode=True)
            if model.input_shape != (None, 224, 224, 3) or model.output_shape != (
                None,
                len(labels),
            ):
                raise ValueError("Expected RGB 224x224 input and one softmax output per label")
            self._labels = labels
        else:
            weights = os.getenv("FOODLOGGER_WEIGHTS") or download_weights()
            model = tf.keras.applications.MobileNetV2(weights=weights, input_shape=(224, 224, 3))
        self._model = model

    def predict(self, image: Image.Image) -> dict:
        try:
            with self._lock:
                if self._model is None:
                    self._load()
                resized = ImageOps.fit(image, (224, 224), method=Image.Resampling.BILINEAR)
                pixels = np.asarray(resized, dtype=np.float32)[None, ...]
                if not self.model_path:
                    pixels = pixels / 127.5 - 1
                scores = np.asarray(self._model(pixels, training=False))[0]
                result = rank_predictions(scores, self.catalog, self._labels)
                return {**result, "model": self.name}
        except ModelUnavailable:
            raise
        except Exception as error:
            raise ModelUnavailable(
                "The classifier could not load or run. Install the ML extra and run "
                "'foodlogger download-model'; check custom model settings if configured. "
                "You can still select food manually."
            ) from error
