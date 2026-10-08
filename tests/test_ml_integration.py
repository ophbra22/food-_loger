"""Opt-in test of real TensorFlow plumbing; synthetic data is not an ML benchmark."""

import os

import numpy as np
import pytest
from PIL import Image

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(os.getenv("FOODLOGGER_RUN_ML_TESTS") != "1", reason="Opt-in ML smoke test"),
]


def test_train_fine_tune_export_and_predict(tmp_path, monkeypatch):
    from foodlogger.classifier import Classifier
    from foodlogger.nutrition import Catalog
    from foodlogger.training import train

    rng = np.random.default_rng(42)
    for split, count in [("train", 5), ("test", 2)]:
        for label in ["banana", "pizza"]:
            folder = tmp_path / "data" / split / label
            folder.mkdir(parents=True)
            for index in range(count):
                pixels = rng.integers(0, 256, size=(48, 48, 3), dtype=np.uint8)
                Image.fromarray(pixels).save(folder / f"{index}.png")
    output = tmp_path / "model"
    report = train(
        tmp_path / "data",
        output,
        epochs=1,
        fine_tune_epochs=1,
        batch_size=2,
        pretrained=False,
    )
    assert report["counts"] == {"train": 8, "validation": 2, "test": 4}
    assert report["labels"] == ["banana", "pizza"]
    assert 0 <= report["test_metrics"]["accuracy"] <= 1
    assert report["fine_tune_history"]["loss"]
    monkeypatch.setenv("FOODLOGGER_MODEL", str(output / "model.keras"))
    monkeypatch.delenv("FOODLOGGER_LABELS", raising=False)
    result = Classifier(Catalog()).predict(Image.new("RGB", (48, 48), "red"))
    assert result["model"] == "Custom food classifier"
    assert {entry["food_id"] for entry in result["candidates"]} == {"banana", "pizza"}
    assert sum(entry["score"] for entry in result["candidates"]) == pytest.approx(1, abs=0.001)
