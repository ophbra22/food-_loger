"""GTIN decoding and bounded Open Food Facts nutrition lookups."""

import json
import math
import re
from contextlib import ExitStack, nullcontext

import httpx
import zxingcpp
from PIL import Image, ImageOps

from foodlogger.schemas import RAW_NUTRIMENT_KEY, RAW_NUTRIMENT_MAX_FIELDS

NUTRIENT_FIELDS = {
    "calories": "energy-kcal_100g",
    "protein": "proteins_100g",
    "carbs": "carbohydrates_100g",
    "fat": "fat_100g",
    "sugars": "sugars_100g",
    "saturated_fat": "saturated-fat_100g",
    "fiber": "fiber_100g",
    "salt": "salt_100g",
    "sodium": "sodium_100g",
}
MAX_RESPONSE_BYTES = 2 * 1024 * 1024
_TIMEOUT = httpx.Timeout(8.0, connect=4.0)
_FIELDS = (
    "code,product_name,product_name_en,generic_name,brands,quantity,serving_size,"
    "serving_quantity,serving_quantity_unit,product_quantity_unit,nutrition_data_per,nutriments"
)
_SERVING = re.compile(r"(?<![\w.])(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|dl|l)\b", re.I)
_UNIT_SCALES = {
    "g": ("g", 1),
    "kg": ("g", 1000),
    "ml": ("ml", 1),
    "cl": ("ml", 10),
    "dl": ("ml", 100),
    "l": ("ml", 1000),
}


class InvalidBarcode(ValueError):
    """A GTIN or barcode photograph is invalid or ambiguous."""


class ProductNotFound(LookupError):
    """The product is absent from Open Food Facts."""


class LookupUnavailable(RuntimeError):
    """The upstream service is unavailable or returned an invalid response."""


def validate_barcode(value: str) -> str:
    """Return a trimmed GTIN-8/12/13/14 with a valid GS1 check digit."""
    if not isinstance(value, str):
        raise InvalidBarcode("The barcode must be a string of digits.")
    code = value.strip()
    if len(code) not in (8, 12, 13, 14) or not code.isascii() or not code.isdigit():
        raise InvalidBarcode("The barcode must contain 8, 12, 13, or 14 digits.")
    total = sum(
        int(digit) * (3 if index % 2 == 0 else 1) for index, digit in enumerate(reversed(code[:-1]))
    )
    if (10 - total % 10) % 10 != int(code[-1]):
        raise InvalidBarcode("The barcode check digit is invalid.")
    return code


def decode_barcode(image: Image.Image) -> str:
    """Decode one unambiguous GTIN, including rotated or EXIF-oriented images."""
    # HTTP uploads are already oriented RGB. Reuse those pixels instead of
    # allocating two more full-size copies of a phone photograph.
    with ExitStack() as copies:
        pixels = image
        if image.getexif().get(274, 1) in range(2, 9):
            pixels = copies.enter_context(ImageOps.exif_transpose(image))
        if pixels.mode != "RGB":
            pixels = copies.enter_context(pixels.convert("RGB"))
        results = zxingcpp.read_barcodes(pixels, try_rotate=True, try_invert=True)
    matches = set()
    for result in results:
        try:
            matches.add(validate_barcode(result.text))
        except InvalidBarcode:
            continue
    if not matches:
        raise InvalidBarcode("No readable product barcode found. Try a clear, close-up photograph.")
    if len(matches) > 1:
        raise InvalidBarcode(
            "More than one product barcode found. Photograph one barcode at a time."
        )
    return matches.pop()


def _number(value, *, minimum=0.0, maximum=100.0):
    """Return finite, bounded numeric data without interpreting booleans as amounts."""
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        return None
    try:
        numeric = float(value)
    except (ValueError, OverflowError):
        return None
    return numeric if math.isfinite(numeric) and minimum <= numeric <= maximum else None


def _text(value, maximum=300):
    return value.strip()[:maximum] if isinstance(value, str) and value.strip() else None


def _basis_and_serving(product):
    """Infer g/ml using explicit volume metadata; OFF uses `_100g` for both bases."""
    per = (_text(product.get("nutrition_data_per")) or "").lower().replace(" ", "")
    unit = (_text(product.get("product_quantity_unit")) or "").lower()
    serving_text = _text(product.get("serving_size")) or ""
    serving_match = _SERVING.search(serving_text)
    parsed_quantity, parsed_basis = None, None
    if serving_match:
        parsed_basis, scale = _UNIT_SCALES[serving_match.group(2).lower()]
        number = _number(serving_match.group(1).replace(",", "."), maximum=100_000)
        if number is not None:
            parsed_quantity = _number(number * scale, minimum=0.001, maximum=100_000)
    quantity_unit = (_text(product.get("serving_quantity_unit")) or "").lower()
    explicit_basis, explicit_scale = _UNIT_SCALES.get(quantity_unit, (None, 1))
    # OFF's generic "100g" entry can also represent 100 ml. Explicit volume
    # units on the product or serving identify those liquid entries.
    basis = (
        "ml"
        if (
            per in ("100ml", "100milliliters")
            or unit in ("ml", "cl", "dl", "l")
            or (not unit and parsed_basis == "ml")
            or (not unit and explicit_basis == "ml")
        )
        else "g"
    )
    serving = _number(product.get("serving_quantity"), minimum=0.001, maximum=100_000)
    serving_basis = explicit_basis or parsed_basis
    if serving_basis is not None and serving_basis != basis:
        return basis, None
    if serving is not None:
        # OFF serving_quantity is already normalized to g/ml unless its own
        # explicit unit states otherwise; serving_size is only a display label.
        serving = _number(serving * explicit_scale, minimum=0.001, maximum=100_000)
    else:
        serving = parsed_quantity
    return basis, serving


def _normalize(product, barcode):
    upstream = product.get("nutriments")
    nutriments = upstream if isinstance(upstream, dict) else {}
    nutrition = {
        key: _number(nutriments.get(field), maximum=1000 if key == "calories" else 100)
        for key, field in NUTRIENT_FIELDS.items()
    }
    notes = []
    if nutrition["calories"] is None:
        energy = _number(nutriments.get("energy-kj_100g"), maximum=4184)
        if energy is None:
            # Open Food Facts normalizes the generic energy_100g field to kJ.
            energy = _number(nutriments.get("energy_100g"), maximum=4184)
        if energy is not None:
            nutrition["calories"] = energy / 4.184
            notes.append("Calories converted from kilojoules using kcal = kJ / 4.184.")
    # OFF normalizes salt and sodium _100g values to grams, regardless of the
    # original label's display unit. The label-equivalent factor is salt = sodium * 2.5.
    if nutrition["salt"] is None and nutrition["sodium"] is not None:
        nutrition["salt"] = _number(nutrition["sodium"] * 2.5)
        if nutrition["salt"] is not None:
            notes.append("Salt calculated from sodium in grams using salt = sodium × 2.5.")
    elif nutrition["sodium"] is None and nutrition["salt"] is not None:
        nutrition["sodium"] = nutrition["salt"] / 2.5
        notes.append("Sodium calculated from salt in grams using sodium = salt / 2.5.")
    raw_nutriments, nutriment_units = {}, {}
    raw_size, omitted = 2, False
    for key, value in nutriments.items():
        unit = _text(value, 40) if key.endswith("_unit") else None
        numeric = _number(value, minimum=-1_000_000, maximum=1_000_000)
        if unit is None and numeric is None:
            continue
        candidate = unit if unit is not None else numeric
        size = len(json.dumps({key: candidate}, ensure_ascii=False).encode("utf-8"))
        if (
            not RAW_NUTRIMENT_KEY.fullmatch(key)
            or len(raw_nutriments) + len(nutriment_units) >= RAW_NUTRIMENT_MAX_FIELDS
            or raw_size + size > 32768
        ):
            omitted = True
            continue
        raw_size += size
        if unit is not None:
            nutriment_units[key] = unit
        else:
            raw_nutriments[key] = numeric
    if omitted:
        notes.append(
            "Some additional source metadata was omitted because it exceeded supported "
            "names or size limits. The main nutrition fields remain available for review."
        )
    basis, serving = _basis_and_serving(product)
    return {
        "barcode": barcode,
        "name": (
            _text(product.get("product_name"))
            or _text(product.get("product_name_en"))
            or _text(product.get("generic_name"))
            or f"Product {barcode}"
        ),
        "brand": _text(product.get("brands")),
        "quantity": _text(product.get("quantity"), 200),
        "basis_unit": basis,
        "serving_quantity": serving,
        "nutrition": nutrition,
        "raw_nutriments": raw_nutriments,
        "nutriment_units": nutriment_units,
        "source": "Open Food Facts",
        "source_url": f"https://world.openfoodfacts.org/product/{barcode}",
        "missing_nutrients": [key for key, value in nutrition.items() if value is None],
        "notes": notes,
    }


class OpenFoodFactsClient:
    """Synchronous bounded lookups; injected clients retain their ownership."""

    def __init__(
        self, *, client: httpx.Client | None = None, transport: httpx.BaseTransport | None = None
    ):
        if client is not None and transport is not None:
            raise ValueError("Supply either a client or a transport, not both.")
        self._client = client
        self._transport = transport

    def lookup(self, barcode: str) -> dict:
        """Fetch a validated GTIN with per-100-g/ml nutrients and source attribution.

        Missing or invalid nutrient quantities remain None. Network, JSON, size,
        and product-identity errors raise LookupUnavailable; absent products
        raise ProductNotFound. Redirects are never followed.
        """
        code = validate_barcode(barcode)
        context = (
            nullcontext(self._client)
            if self._client is not None
            else httpx.Client(
                transport=self._transport,
                timeout=_TIMEOUT,
                follow_redirects=False,
            )
        )
        try:
            with context as client:
                with client.stream(
                    "GET",
                    f"https://world.openfoodfacts.org/api/v2/product/{code}.json",
                    params={"fields": _FIELDS},
                    headers={
                        "User-Agent": "FoodLogger/2.0 (https://github.com/ophbra22/food-_loger)",
                        "Accept": "application/json",
                    },
                    timeout=_TIMEOUT,
                    follow_redirects=False,
                ) as response:
                    if response.status_code == 404:
                        raise ProductNotFound("This barcode is not listed in Open Food Facts.")
                    if response.status_code != 200:
                        raise LookupUnavailable("Open Food Facts is temporarily unavailable.")
                    size = response.headers.get("Content-Length")
                    if size and size.isdigit() and int(size) > MAX_RESPONSE_BYTES:
                        raise LookupUnavailable("Open Food Facts returned an oversized response.")
                    body = bytearray()
                    for chunk in response.iter_bytes(chunk_size=64 * 1024):
                        if len(body) + len(chunk) > MAX_RESPONSE_BYTES:
                            raise LookupUnavailable(
                                "Open Food Facts returned an oversized response."
                            )
                        body.extend(chunk)
                    payload = json.loads(body)
        except (httpx.HTTPError, ValueError, RecursionError) as error:
            raise LookupUnavailable(
                "Open Food Facts could not be reached or returned invalid data."
            ) from error
        if not isinstance(payload, dict):
            raise LookupUnavailable("Open Food Facts returned invalid product data.")
        if payload.get("status") == 0:
            raise ProductNotFound("This barcode is not listed in Open Food Facts.")
        product = payload.get("product")
        if payload.get("status") != 1 or not isinstance(product, dict):
            raise LookupUnavailable("Open Food Facts returned invalid product data.")
        codes = [item for item in (payload.get("code"), product.get("code")) if item is not None]
        try:
            same_product = bool(codes) and all(
                validate_barcode(str(item)).zfill(14) == code.zfill(14) for item in codes
            )
        except InvalidBarcode:
            same_product = False
        if not same_product:
            raise LookupUnavailable("Open Food Facts returned a different product barcode.")
        return _normalize(product, code)
