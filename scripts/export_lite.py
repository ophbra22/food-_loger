"""Export the verified default checkpoint; never needed on the web server.

Install this project with its ml extra (TensorFlow 2.20.0), then run:
  python -m pip install keras==3.15.1
  python scripts/fetch_weights.py /tmp/mobilenet.h5
  python scripts/export_lite.py --weights /tmp/mobilenet.h5

The output is a builtin-ops-only float16-weight model with float32 input/output,
plus a checksum/provenance manifest. Use the lite extra for serving this artifact.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path

from foodlogger.classifier import WEIGHTS_SHA256
from foodlogger.lite_classifier import DEFAULT_MODEL, MAX_MODEL_BYTES, MODEL_CONTRACT


def export(weights: Path, output: Path) -> dict:
    with weights.open("rb") as checkpoint:
        digest = hashlib.file_digest(checkpoint, "sha256").hexdigest()
    if digest != WEIGHTS_SHA256:
        raise ValueError(
            "Source checkpoint SHA-256 does not match the published MobileNetV2 weights"
        )

    # Keep conversion predictable and avoid grabbing all cores on build machines.
    os.environ.setdefault("CUDA_VISIBLE_DEVICES", "-1")
    os.environ.setdefault("TF_NUM_INTRAOP_THREADS", "1")
    os.environ.setdefault("TF_NUM_INTEROP_THREADS", "1")
    import tensorflow as tf
    from tensorflow.python.framework.convert_to_constants import convert_variables_to_constants_v2

    if tf.__version__ != "2.20.0":
        raise ValueError("Reproducible export requires tensorflow==2.20.0 (the ml extra)")
    tf.keras.backend.clear_session()
    tf.keras.utils.set_random_seed(0)
    model = tf.keras.applications.MobileNetV2(weights=str(weights), input_shape=(224, 224, 3))

    @tf.function(input_signature=[tf.TensorSpec([1, 224, 224, 3], tf.float32, name="pixels")])
    def infer(pixels):
        return model(pixels, training=False)

    # Keras 3 variables must be frozen: exporting the trackable object directly can
    # retain uninitialized resource handles instead of embedding checkpoint values.
    frozen = convert_variables_to_constants_v2(infer.get_concrete_function())
    converter = tf.lite.TFLiteConverter.from_concrete_functions([frozen])
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.float16]
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS]
    converted = converter.convert()
    if not 0 < len(converted) <= MAX_MODEL_BYTES:
        raise ValueError("Converted model exceeds the lightweight runtime size limit")
    manifest = {
        **MODEL_CONTRACT,
        "sha256": hashlib.sha256(converted).hexdigest(),
        "size_bytes": len(converted),
        "export": {
            "tensorflow": tf.__version__,
            "keras": tf.keras.__version__,
            "script": "scripts/export_lite.py",
            "operators": "TFLITE_BUILTINS",
            "runtime": "ai-edge-litert==1.4.0",
        },
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(converted)
    output.with_suffix(".json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--weights", required=True, type=Path, help="Verified MobileNetV2 .h5 file")
    parser.add_argument("--output", type=Path, default=DEFAULT_MODEL)
    arguments = parser.parse_args()
    manifest = export(arguments.weights, arguments.output)
    print(f"Exported {arguments.output} ({manifest['size_bytes']} bytes; {manifest['sha256']})")


if __name__ == "__main__":
    main()
