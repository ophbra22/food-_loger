"""Reproducible transfer learning with a held-out test set and export contract."""

import argparse
import json
import random
from pathlib import Path

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp"}


def split_dataset(root: Path, validation_fraction: float = 0.2, seed: int = 42) -> dict:
    if not 0 < validation_fraction < 1:
        raise ValueError("Validation fraction must be between 0 and 1.")
    root = Path(root)
    if not (root / "train").is_dir() or not (root / "test").is_dir():
        raise ValueError("Expected train/<class> and test/<class> folders.")
    labels = sorted(path.name for path in (root / "train").iterdir() if path.is_dir())
    test_labels = sorted(path.name for path in (root / "test").iterdir() if path.is_dir())
    if len(labels) < 2 or labels != test_labels:
        raise ValueError("Train and test must contain the same classes (at least two).")
    rng = random.Random(seed)
    manifest = {"labels": labels, "train": [], "validation": [], "test": []}
    for index, label in enumerate(labels):
        train = sorted(
            str(path.resolve())
            for path in (root / "train" / label).iterdir()
            if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES
        )
        test = sorted(
            str(path.resolve())
            for path in (root / "test" / label).iterdir()
            if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES
        )
        if len(train) < 2 or not test:
            raise ValueError(f"{label}: need at least two training images and one test image.")
        rng.shuffle(train)
        validation_count = max(1, min(len(train) - 1, round(len(train) * validation_fraction)))
        manifest["validation"].extend((path, index) for path in train[:validation_count])
        manifest["train"].extend((path, index) for path in train[validation_count:])
        manifest["test"].extend((path, index) for path in test)
    paths = [path for split in ("train", "validation", "test") for path, _ in manifest[split]]
    if len(paths) != len(set(paths)):
        raise ValueError("Dataset paths overlap; train, validation and test must be separate.")
    return manifest


def make_dataset(rows, batch_size: int, seed: int, training: bool):
    import tensorflow as tf

    paths, labels = zip(*rows, strict=True)
    dataset = tf.data.Dataset.from_tensor_slices((list(paths), list(labels)))
    if training:
        dataset = dataset.shuffle(len(rows), seed=seed, reshuffle_each_iteration=True)
    resize = tf.keras.layers.Resizing(224, 224, crop_to_aspect_ratio=True)

    def decode(path, label):
        image = tf.io.decode_image(tf.io.read_file(path), channels=3, expand_animations=False)
        image.set_shape([None, None, 3])
        return resize(image), label

    options = tf.data.Options()
    options.threading.private_threadpool_size = 2
    options.threading.max_intra_op_parallelism = 1
    options.experimental_deterministic = True
    return (
        dataset.map(decode, num_parallel_calls=1)
        .batch(batch_size)
        .with_options(options)
        .prefetch(1)
    )


def build_model(num_classes: int, pretrained: bool = True):
    import tensorflow as tf

    from foodlogger.classifier import download_weights

    full = tf.keras.applications.MobileNetV2(weights=download_weights() if pretrained else None)
    backbone = tf.keras.Model(
        full.input, full.get_layer("out_relu").output, name="feature_extractor"
    )
    backbone.trainable = False
    inputs = tf.keras.Input((224, 224, 3), name="rgb_0_255")
    x = tf.keras.layers.RandomFlip("horizontal")(inputs)
    x = tf.keras.layers.RandomRotation(0.05)(x)
    x = tf.keras.layers.RandomZoom(0.1)(x)
    x = tf.keras.layers.Rescaling(1 / 127.5, offset=-1)(x)
    x = backbone(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.2)(x)
    outputs = tf.keras.layers.Dense(num_classes, activation="softmax", name="food_scores")(x)
    return tf.keras.Model(inputs, outputs, name="foodlogger_mobilenet_v2"), backbone


def train(
    data: Path,
    output: Path,
    epochs: int = 5,
    fine_tune_epochs: int = 3,
    batch_size: int = 32,
    seed: int = 42,
    pretrained: bool = True,
) -> dict:
    if epochs < 1 or fine_tune_epochs < 0 or batch_size < 1:
        raise ValueError("Epochs and batch size must be positive; fine-tune epochs may be zero.")
    manifest = split_dataset(data, seed=seed)
    output = Path(output)
    if output.exists() and any(output.iterdir()):
        raise ValueError(
            "Output directory must be new or empty; existing experiments are preserved."
        )

    import tensorflow as tf

    tf.keras.utils.set_random_seed(seed)
    tf.config.experimental.enable_op_determinism()
    output.mkdir(parents=True, exist_ok=True)
    (output / "labels.json").write_text(json.dumps(manifest["labels"], indent=2) + "\n")
    (output / "split_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    datasets = {
        split: make_dataset(manifest[split], batch_size, seed, split == "train")
        for split in ("train", "validation", "test")
    }
    model, backbone = build_model(len(manifest["labels"]), pretrained)
    top_k = min(3, len(manifest["labels"]))

    def compile_model(rate):
        model.compile(
            optimizer=tf.keras.optimizers.Adam(rate),
            loss="sparse_categorical_crossentropy",
            metrics=[
                tf.keras.metrics.SparseCategoricalAccuracy(name="accuracy"),
                tf.keras.metrics.SparseTopKCategoricalAccuracy(k=top_k, name="top_k_accuracy"),
            ],
        )

    compile_model(1e-3)
    checkpoint = tf.keras.callbacks.ModelCheckpoint(
        output / "best.keras",
        monitor="val_loss",
        save_best_only=True,
    )
    history = model.fit(
        datasets["train"],
        validation_data=datasets["validation"],
        epochs=epochs,
        callbacks=[
            checkpoint,
            tf.keras.callbacks.EarlyStopping(patience=3, restore_best_weights=True),
        ],
        verbose=2,
    ).history
    fine_history = {}
    if fine_tune_epochs:
        backbone.trainable = True
        for layer in backbone.layers[:-30]:
            layer.trainable = False
        for layer in backbone.layers:
            if isinstance(layer, tf.keras.layers.BatchNormalization):
                layer.trainable = False
        compile_model(1e-5)
        fine_history = model.fit(
            datasets["train"],
            validation_data=datasets["validation"],
            epochs=fine_tune_epochs,
            callbacks=[
                checkpoint,
                tf.keras.callbacks.EarlyStopping(
                    patience=3,
                    restore_best_weights=True,
                ),
            ],
            verbose=2,
        ).history
    # Model selection uses validation only. The test split is touched once here.
    best = tf.keras.models.load_model(output / "best.keras", safe_mode=True)
    metrics = best.evaluate(datasets["test"], return_dict=True, verbose=0)
    best.save(output / "model.keras")
    report = {
        "seed": seed,
        "tensorflow_version": tf.__version__,
        "pretrained": pretrained,
        "labels": manifest["labels"],
        "top_k": top_k,
        "counts": {split: len(manifest[split]) for split in datasets},
        "test_metrics": {key: float(value) for key, value in metrics.items()},
        "head_history": history,
        "fine_tune_history": fine_history,
        "input_contract": "RGB float32 [0,255], shape (batch,224,224,3); preprocessing embedded",
    }
    (output / "metrics.json").write_text(json.dumps(report, indent=2) + "\n")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--fine-tune-epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--weights", choices=["imagenet", "none"], default="imagenet")
    args = parser.parse_args()
    report = train(
        args.data,
        args.output,
        args.epochs,
        args.fine_tune_epochs,
        args.batch_size,
        args.seed,
        args.weights == "imagenet",
    )
    print(
        json.dumps({"counts": report["counts"], "test_metrics": report["test_metrics"]}, indent=2)
    )


if __name__ == "__main__":
    main()
