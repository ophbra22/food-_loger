from io import BytesIO

import numpy as np
import pytest
from PIL import Image

from foodlogger.classifier import ModelUnavailable, rank_predictions
from foodlogger.images import InvalidImage, decode_image
from foodlogger.nutrition import Catalog


def test_food_score_is_not_renormalized():
    scores = np.zeros(1000)
    scores[954], scores[950], scores[1] = 0.6, 0.1, 0.3
    result = rank_predictions(scores, Catalog())
    assert result["status"] == "recognized"
    assert result["candidates"][0]["food_id"] == "banana"
    assert result["candidates"][0]["score"] == 0.6


def test_nonfood_winner_does_not_become_a_food_prediction():
    scores = np.zeros(1000)
    scores[1], scores[954] = 0.8, 0.2
    result = rank_predictions(scores, Catalog())
    assert result["status"] == "uncertain"
    assert result["candidates"][0]["score"] == 0.2


def test_weak_food_winner_is_uncertain():
    scores = np.ones(1000) * 0.9 / 999
    scores[954] = 0.1
    assert rank_predictions(scores, Catalog())["status"] == "uncertain"


def test_custom_label_order_and_unmapped_food():
    result = rank_predictions(np.array([0.1, 0.9]), Catalog(), labels=["banana", "pizza"])
    assert result["candidates"][0]["food_id"] == "pizza"
    result = rank_predictions(np.array([0.9, 0.1]), Catalog(), labels=["sushi", "pizza"])
    assert result["status"] == "uncertain"
    assert result["unmapped_label"] == "sushi"


@pytest.mark.parametrize("scores", [[float("nan"), 0.5], [2, -1], [0.2, 0.2]])
def test_invalid_model_output_fails_explicitly(scores):
    with pytest.raises(ModelUnavailable):
        rank_predictions(np.array(scores), Catalog(), labels=["banana", "pizza"])


def test_rgba_upload_is_decoded_as_rgb():
    data = BytesIO()
    Image.new("RGBA", (50, 30), "red").save(data, format="PNG")
    image = decode_image(data.getvalue())
    assert image.mode == "RGB"
    assert image.size == (50, 30)


@pytest.mark.parametrize("data", [b"", b"this is not a photo", b"<svg></svg>"])
def test_invalid_images_are_rejected(data):
    with pytest.raises(InvalidImage):
        decode_image(data)


def test_image_size_and_unsupported_format_limits():
    with pytest.raises(InvalidImage):
        decode_image(b"x" * (8 * 1024 * 1024 + 1))
    data = BytesIO()
    Image.new("RGB", (10, 10)).save(data, format="GIF")
    with pytest.raises(InvalidImage):
        decode_image(data.getvalue())
    data = BytesIO()
    Image.new("RGB", (5000, 4100)).save(data, format="PNG")
    with pytest.raises(InvalidImage):
        decode_image(data.getvalue())
