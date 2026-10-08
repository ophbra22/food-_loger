"""Small CPU-only ImageNet runtime; TensorFlow is needed only to export the asset."""

import hashlib
import json
import threading
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

from foodlogger.classifier import WEIGHTS_SHA256, WEIGHTS_URL, ModelUnavailable, rank_predictions
from foodlogger.nutrition import Catalog

DEFAULT_MODEL = Path(__file__).parent / "data" / "mobilenet_v2_float16.tflite"
MAX_MODEL_BYTES = 16 * 1024 * 1024
MODEL_CONTRACT = {
    "schema_version": 1,
    "architecture": "MobileNetV2",
    "weights": "ImageNet",
    "quantization": "float16",
    "source": {"url": WEIGHTS_URL, "sha256": WEIGHTS_SHA256},
    "input": {"shape": [1, 224, 224, 3], "dtype": "float32"},
    "output": {"shape": [1, 1000], "dtype": "float32", "activation": "softmax"},
    "preprocessing": {
        "color": "RGB",
        "resize": "Pillow.ImageOps.fit",
        "resampling": "bilinear",
        "normalization": "pixels / 127.5 - 1.0",
    },
}


class LiteClassifier:
    """Load one verified, bundled MobileNetV2 interpreter lazily and reuse it.

    An explicit model_path must point to an export from scripts/export_lite.py,
    accompanied by its .json manifest. Custom label sets use the TensorFlow backend.
    The lock protects both interpreter initialization and its mutable tensor buffers.
    """

    def __init__(self, catalog: Catalog, model_path: str | Path | None = None):
        self.catalog = catalog
        self.model_path = Path(model_path) if model_path is not None else DEFAULT_MODEL
        self.name = "MobileNetV2 · ImageNet (LiteRT)"
        self._interpreter = None
        self._input_index = None
        self._output_index = None
        self._lock = threading.Lock()

    def _load(self):
        manifest = json.loads(self.model_path.with_suffix(".json").read_text())
        if not isinstance(manifest, dict) or any(
            manifest.get(key) != expected for key, expected in MODEL_CONTRACT.items()
        ):
            raise ModelUnavailable("The LiteRT model manifest does not match the supported model.")
        size = self.model_path.stat().st_size
        if not 0 < size <= MAX_MODEL_BYTES or manifest.get("size_bytes") != size:
            raise ModelUnavailable("The LiteRT model size does not match its manifest.")
        with self.model_path.open("rb") as model_file:
            digest = hashlib.file_digest(model_file, "sha256").hexdigest()
        if manifest.get("sha256") != digest:
            raise ModelUnavailable("The LiteRT model SHA-256 does not match its manifest.")

        from ai_edge_litert.interpreter import Interpreter

        interpreter = Interpreter(model_path=str(self.model_path), num_threads=1)
        inputs = interpreter.get_input_details()
        outputs = interpreter.get_output_details()
        if (
            len(inputs) != 1
            or len(outputs) != 1
            or tuple(inputs[0]["shape"]) != (1, 224, 224, 3)
            or tuple(outputs[0]["shape"]) != (1, 1000)
            or inputs[0]["dtype"] != np.float32
            or outputs[0]["dtype"] != np.float32
        ):
            raise ModelUnavailable("Expected float32 RGB 224x224 input and 1000 ImageNet scores.")
        interpreter.allocate_tensors()
        self._input_index = inputs[0]["index"]
        self._output_index = outputs[0]["index"]
        self._interpreter = interpreter

    def predict(self, image: Image.Image) -> dict:
        try:
            with self._lock:
                if self._interpreter is None:
                    self._load()
                resized = ImageOps.fit(image, (224, 224), method=Image.Resampling.BILINEAR)
                pixels = np.asarray(resized, dtype=np.float32)[None, ...] / 127.5 - 1
                self._interpreter.set_tensor(self._input_index, pixels)
                self._interpreter.invoke()
                scores = self._interpreter.get_tensor(self._output_index)[0]
                return {**rank_predictions(scores, self.catalog), "model": self.name}
        except ModelUnavailable:
            raise
        except Exception as error:
            raise ModelUnavailable(
                "The lightweight classifier could not load or run. Install the lite extra "
                "and check the bundled model and manifest. You can still select food manually."
            ) from error
