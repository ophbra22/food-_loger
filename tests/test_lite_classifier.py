"""Lite adapter contracts; opt in to the actual runtime with FOODLOGGER_RUN_LITE_TESTS=1.

The real comparison additionally needs FOODLOGGER_WEIGHTS (the verified original .h5)
and FOODLOGGER_TEST_IMAGE (a real pizza photo), plus the ml and lite extras. The
ordinary tests use an interpreter stand-in at the external native-runtime boundary.
"""

import hashlib
import json
import os
import runpy
import subprocess
import sys
import types
from pathlib import Path

import numpy as np
import pytest
from PIL import Image, ImageOps

from foodlogger.classifier import WEIGHTS_SHA256, WEIGHTS_URL, ModelUnavailable
from foodlogger.nutrition import Catalog


@pytest.fixture
def lite_files(tmp_path):
    model = tmp_path / "model.tflite"
    model.write_bytes(b"test interpreter boundary")
    manifest = {
        "schema_version": 1,
        "architecture": "MobileNetV2",
        "weights": "ImageNet",
        "quantization": "float16",
        "sha256": hashlib.sha256(model.read_bytes()).hexdigest(),
        "size_bytes": model.stat().st_size,
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
    model.with_suffix(".json").write_text(json.dumps(manifest))
    return model


@pytest.fixture
def interpreter(monkeypatch):
    class Interpreter:
        input_shape = [1, 224, 224, 3]
        output_shape = [1, 1000]
        dtype = np.float32
        instances = []
        output = np.zeros((1, 1000), dtype=np.float32)
        output[0, 963] = 0.75  # pizza
        output[0, 1] = 0.25

        def __init__(self, *, model_path, num_threads):
            self.model_path = model_path
            self.num_threads = num_threads
            self.allocations = 0
            self.calls = 0
            self.instances.append(self)

        def allocate_tensors(self):
            self.allocations += 1

        def get_input_details(self):
            return [{"index": 0, "shape": self.input_shape, "dtype": self.dtype}]

        def get_output_details(self):
            return [{"index": 1, "shape": self.output_shape, "dtype": self.dtype}]

        def set_tensor(self, index, value):
            assert index == 0
            self.pixels = value.copy()

        def invoke(self):
            self.calls += 1

        def get_tensor(self, index):
            assert index == 1
            return self.output.copy()

    module = types.ModuleType("ai_edge_litert.interpreter")
    module.Interpreter = Interpreter
    monkeypatch.setitem(sys.modules, "ai_edge_litert.interpreter", module)
    return Interpreter


def test_lite_preprocesses_and_ranks_using_original_contract(lite_files, interpreter):
    from foodlogger.lite_classifier import LiteClassifier

    classifier = LiteClassifier(Catalog(), model_path=lite_files)
    pixels = np.random.default_rng(12).integers(0, 256, (150, 300, 3), dtype=np.uint8)
    photo = Image.fromarray(pixels)
    result = classifier.predict(photo)
    assert result == {
        "status": "recognized",
        "candidates": [{"food_id": "pizza", "name": "Cheese pizza", "emoji": "🍕", "score": 0.75}],
        "unmapped_label": None,
        "model": classifier.name,
    }
    expected = (
        np.asarray(
            ImageOps.fit(photo, (224, 224), method=Image.Resampling.BILINEAR), dtype=np.float32
        )[None, ...]
        / 127.5
        - 1
    )
    np.testing.assert_array_equal(interpreter.instances[0].pixels, expected)
    classifier.predict(photo)
    assert len(interpreter.instances) == 1
    assert interpreter.instances[0].allocations == 1
    assert interpreter.instances[0].num_threads == 1
    assert interpreter.instances[0].calls == 2


@pytest.mark.parametrize("damage", ["weights", "manifest", "missing", "preprocessing", "source"])
def test_lite_rejects_unverified_asset_before_native_loading(lite_files, interpreter, damage):
    from foodlogger.lite_classifier import LiteClassifier

    if damage == "weights":
        lite_files.write_bytes(b"x" * lite_files.stat().st_size)
    elif damage == "manifest":
        lite_files.with_suffix(".json").write_text("{")
    elif damage == "missing":
        lite_files.unlink()
    else:
        path = lite_files.with_suffix(".json")
        manifest = json.loads(path.read_text())
        manifest[damage] = {}
        path.write_text(json.dumps(manifest))
    with pytest.raises(ModelUnavailable):
        LiteClassifier(Catalog(), lite_files).predict(Image.new("RGB", (32, 32)))
    assert not interpreter.instances


@pytest.mark.parametrize(
    "field,value",
    [
        ("input_shape", [2, 224, 224, 3]),
        ("input_shape", [1, 224, 224, 1]),
        ("output_shape", [1, 1001]),
        ("dtype", np.uint8),
    ],
)
def test_lite_rejects_incompatible_tensors(lite_files, interpreter, field, value):
    from foodlogger.lite_classifier import LiteClassifier

    setattr(interpreter, field, value)
    with pytest.raises(ModelUnavailable):
        LiteClassifier(Catalog(), lite_files).predict(Image.new("RGB", (32, 32)))
    assert interpreter.instances[0].calls == 0


@pytest.mark.parametrize("score", [float("nan"), -1.0, 3.0])
def test_lite_rejects_invalid_softmax_output(lite_files, interpreter, score):
    from foodlogger.lite_classifier import LiteClassifier

    interpreter.output[0, 963] = score
    with pytest.raises(ModelUnavailable, match="softmax"):
        LiteClassifier(Catalog(), lite_files).predict(Image.new("RGB", (32, 32)))


def test_lite_import_does_not_import_tensorflow():
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import sys; import foodlogger.lite_classifier; "
            "assert not any(m == 'tensorflow' or m.startswith('tensorflow.') for m in sys.modules)",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr


def test_exporter_rejects_checkpoint_before_loading_tensorflow(tmp_path):
    weights = tmp_path / "untrusted.h5"
    weights.write_bytes(b"not the published weights")
    exporter = runpy.run_path(str(Path(__file__).parents[1] / "scripts" / "export_lite.py"))
    with pytest.raises(ValueError, match="SHA-256"):
        exporter["export"](weights, tmp_path / "model.tflite")
    assert not (tmp_path / "model.tflite").exists()


@pytest.mark.integration
@pytest.mark.skipif(
    os.getenv("FOODLOGGER_RUN_LITE_TESTS") != "1", reason="Opt-in LiteRT smoke test"
)
def test_real_lite_in_fresh_process_without_tensorflow():
    pytest.importorskip("ai_edge_litert")
    code = """
import json, resource, sys
from PIL import Image
from foodlogger.lite_classifier import LiteClassifier
from foodlogger.nutrition import Catalog
model = LiteClassifier(Catalog())
result = model.predict(Image.new('RGB', (256, 256), 'red'))
assert result['status'] in ('recognized', 'uncertain')
assert not any(m == 'tensorflow' or m.startswith('tensorflow.') for m in sys.modules)
print(json.dumps({'peak_rss_kib': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}))
"""
    result = subprocess.run(
        [sys.executable, "-c", code], capture_output=True, text=True, check=False
    )
    assert result.returncode == 0, result.stderr
    print(result.stdout.strip())


@pytest.mark.integration
@pytest.mark.skipif(
    os.getenv("FOODLOGGER_RUN_LITE_TESTS") != "1", reason="Opt-in LiteRT smoke test"
)
def test_real_lite_matches_original_on_pizza(tmp_path):
    pytest.importorskip("ai_edge_litert")
    tf = pytest.importorskip("tensorflow")
    weights = os.environ.get("FOODLOGGER_WEIGHTS")
    photo_path = os.environ.get("FOODLOGGER_TEST_IMAGE")
    if not weights or not photo_path:
        pytest.skip(
            "Set FOODLOGGER_WEIGHTS and FOODLOGGER_TEST_IMAGE for the real photo comparison"
        )
    assert hashlib.sha256(Path(weights).read_bytes()).hexdigest() == WEIGHTS_SHA256
    with Image.open(photo_path) as original:
        photo = original.convert("RGB")
    # The TensorFlow and standalone LiteRT native wrappers cannot coexist in one
    # process. Exercise the actual serving backend in its own process.
    code = """
import json, sys
import numpy as np
from PIL import Image
from foodlogger.lite_classifier import LiteClassifier
from foodlogger.nutrition import Catalog
with Image.open(sys.argv[1]) as original:
    photo = original.convert('RGB')
classifier = LiteClassifier(Catalog())
result = classifier.predict(photo)
np.save(sys.argv[2], classifier._interpreter.get_tensor(classifier._output_index)[0])
assert not any(m == 'tensorflow' or m.startswith('tensorflow.') for m in sys.modules)
print(json.dumps(result))
"""
    scores_path = tmp_path / "lite-scores.npy"
    child = subprocess.run(
        [sys.executable, "-c", code, photo_path, str(scores_path)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert child.returncode == 0, child.stderr
    result = json.loads(child.stdout)
    model = tf.keras.applications.MobileNetV2(weights=weights, input_shape=(224, 224, 3))
    pixels = (
        np.asarray(
            ImageOps.fit(photo, (224, 224), method=Image.Resampling.BILINEAR), dtype=np.float32
        )[None, ...]
        / 127.5
        - 1
    )
    expected = np.asarray(model(pixels, training=False))[0]
    actual = np.load(scores_path)
    assert np.argmax(actual) == np.argmax(expected) == 963
    # Float16 changes this photo's pizza probability by 0.00835; a float32 export
    # differed by only 0.0000025. Bound compression drift to one percentage point.
    # This fixture checks conversion parity; it is not a dataset accuracy benchmark.
    np.testing.assert_allclose(actual, expected, rtol=0, atol=0.01)
    assert result["candidates"][0]["food_id"] == "pizza"
    print(f"maximum score difference: {np.max(np.abs(actual - expected)):.8f}")
