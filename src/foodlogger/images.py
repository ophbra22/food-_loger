import warnings
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_UPLOAD_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 20_000_000


class InvalidImage(ValueError):
    pass


def decode_image(data: bytes) -> Image.Image:
    if not data or len(data) > MAX_UPLOAD_BYTES:
        raise InvalidImage("Choose an image under 8 MiB.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as image:
                if image.format not in {"JPEG", "PNG", "WEBP"}:
                    raise InvalidImage("Use a JPEG, PNG or WebP image.")
                if image.width * image.height > MAX_PIXELS:
                    raise InvalidImage("Image dimensions exceed the 20 megapixel limit.")
                image.load()
                return ImageOps.exif_transpose(image).convert("RGB")
    except InvalidImage:
        raise
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as error:
        raise InvalidImage("This file could not be read as an image.") from error
