import json
from io import BytesIO

import barcode
import httpx
import pytest
from barcode.writer import ImageWriter
from PIL import Image

from foodlogger.products import (
    InvalidBarcode,
    LookupUnavailable,
    OpenFoodFactsClient,
    ProductNotFound,
    decode_barcode,
    validate_barcode,
)

EAN13 = "5901234123457"
NUTRIENT_KEYS = {
    "calories",
    "protein",
    "carbs",
    "fat",
    "sugars",
    "saturated_fat",
    "fiber",
    "salt",
    "sodium",
}


def lookup_product(product=None, *, payload=None, status_code=200, headers=None):
    body = (
        payload
        if payload is not None
        else {
            "code": EAN13,
            "status": 1,
            "product": {"code": EAN13, **(product or {})},
        }
    )
    transport = httpx.MockTransport(
        lambda request: httpx.Response(status_code, json=body, headers=headers)
    )
    return OpenFoodFactsClient(transport=transport).lookup(EAN13)


@pytest.mark.parametrize("code", ["96385074", "036000291452", EAN13, "10012345000017"])
def test_accepts_valid_gtin_lengths(code):
    assert validate_barcode(code) == code


def test_trims_surrounding_barcode_whitespace():
    assert validate_barcode(f"  {EAN13}\n") == EAN13


@pytest.mark.parametrize(
    "code",
    [
        "",
        "5901234123458",
        "036000291453",
        "96385075",
        "10012345000018",
        "1234567",
        "123456789",
        "59012 34123457",
        "５９０１２３４１２３４５７",
        "https://evil.test/",
    ],
)
def test_rejects_invalid_gtin_and_check_digits(code):
    with pytest.raises(InvalidBarcode):
        validate_barcode(code)


@pytest.mark.parametrize("rotation", [0, 90, 180, 270])
def test_decodes_generated_ean13_at_all_rotations(rotation):
    output = BytesIO()
    barcode.get("ean13", EAN13, writer=ImageWriter()).write(output)
    output.seek(0)
    with Image.open(output) as picture:
        assert decode_barcode(picture.rotate(rotation, expand=True)) == EAN13


def test_blank_photo_reports_no_barcode():
    with pytest.raises(InvalidBarcode, match="barcode"):
        decode_barcode(Image.new("RGB", (400, 400), "white"))


def test_normalizes_product_nutrition_and_keeps_full_numeric_details():
    result = lookup_product(
        {
            "product_name": "Protein pudding",
            "brands": "Dairy",
            "quantity": "200 g",
            "serving_size": "200 g",
            "serving_quantity": 200,
            "nutriments": {
                "energy-kcal_100g": 76,
                "proteins_100g": 10,
                "carbohydrates_100g": 6.5,
                "fat_100g": 1.2,
                "sugars_100g": 4,
                "saturated-fat_100g": 0.8,
                "fiber_100g": 0,
                "salt_100g": 0.13,
                "calcium_100g": 0.12,
                "calcium_unit": "mg",
                "nutrition-score-fr_100g": -2,
            },
        }
    )
    assert result["barcode"] == EAN13
    assert result["name"] == "Protein pudding"
    assert result["brand"] == "Dairy"
    assert result["quantity"] == "200 g"
    assert result["basis_unit"] == "g"
    assert result["serving_quantity"] == 200
    assert result["nutrition"] == {
        "calories": 76,
        "protein": 10,
        "carbs": 6.5,
        "fat": 1.2,
        "sugars": 4,
        "saturated_fat": 0.8,
        "fiber": 0,
        "salt": 0.13,
        "sodium": pytest.approx(0.052),
    }
    assert result["raw_nutriments"]["calcium_100g"] == 0.12
    assert result["raw_nutriments"]["nutrition-score-fr_100g"] == -2
    assert result["nutriment_units"]["calcium_unit"] == "mg"
    assert result["source"] == "Open Food Facts"
    assert result["source_url"] == f"https://world.openfoodfacts.org/product/{EAN13}"
    assert result["missing_nutrients"] == []
    assert any("2.5" in note for note in result["notes"])


def test_absent_macros_are_none_and_not_invented_zeroes():
    result = lookup_product({"nutriments": {"proteins_100g": 10}})
    assert set(result["nutrition"]) == NUTRIENT_KEYS
    assert result["nutrition"]["protein"] == 10
    assert result["nutrition"]["calories"] is None
    assert result["nutrition"]["fat"] is None
    assert result["nutrition"]["carbs"] is None
    assert set(result["missing_nutrients"]) == NUTRIENT_KEYS - {"protein"}
    assert result["serving_quantity"] is None


@pytest.mark.parametrize("nutriments", [{}, None, []])
def test_missing_or_malformed_nutriments_keep_all_nutrients_missing(nutriments):
    result = lookup_product({"nutriments": nutriments})
    assert all(value is None for value in result["nutrition"].values())


def test_converts_kilojoules_when_kilocalories_are_missing():
    result = lookup_product({"nutriments": {"energy-kj_100g": 418.4}})
    assert result["nutrition"]["calories"] == pytest.approx(100)
    assert any("4.184" in note for note in result["notes"])


def test_energy_without_suffix_is_kilojoules_and_kcal_takes_precedence():
    assert lookup_product({"nutriments": {"energy_100g": 418.4}})["nutrition"][
        "calories"
    ] == pytest.approx(100)
    assert (
        lookup_product(
            {
                "nutriments": {
                    "energy-kcal_100g": 105,
                    "energy-kj_100g": 418.4,
                }
            }
        )["nutrition"]["calories"]
        == 105
    )


def test_derives_salt_from_sodium_in_grams():
    result = lookup_product({"nutriments": {"sodium_100g": 0.04}})
    assert result["nutrition"]["salt"] == pytest.approx(0.1)
    assert any("2.5" in note for note in result["notes"])


def test_preserves_both_reported_salt_and_sodium():
    result = lookup_product({"nutriments": {"salt_100g": 0.5, "sodium_100g": 0.19}})
    assert result["nutrition"]["salt"] == 0.5
    assert result["nutrition"]["sodium"] == 0.19


@pytest.mark.parametrize(
    "fields",
    [
        {"nutrition_data_per": "100ml", "serving_quantity": 250},
        {"product_quantity_unit": "ml", "serving_quantity": "250"},
        {"nutrition_data_per": "100g", "serving_size": "250 ml"},
    ],
)
def test_identifies_liquids_and_their_serving_quantity(fields):
    result = lookup_product(fields)
    assert result["basis_unit"] == "ml"
    assert result["serving_quantity"] == 250


def test_does_not_treat_a_serving_in_grams_as_milliliters():
    result = lookup_product(
        {
            "nutrition_data_per": "100ml",
            "serving_quantity": 200,
            "serving_size": "200 g",
        }
    )
    assert result["basis_unit"] == "ml"
    assert result["serving_quantity"] is None


def test_preserves_missing_per100_nutrition_even_if_serving_nutrients_exist():
    result = lookup_product(
        {
            "serving_quantity": 150,
            "nutriments": {"proteins_serving": 15},
        }
    )
    assert result["nutrition"]["protein"] is None
    assert result["raw_nutriments"]["proteins_serving"] == 15


def test_discards_nonfinite_and_out_of_bounds_nutrient_values():
    result = lookup_product(
        {
            "serving_quantity": "Infinity",
            "nutriments": {
                "energy-kcal_100g": "NaN",
                "proteins_100g": "Infinity",
                "carbohydrates_100g": -2,
                "fat_100g": 101,
                "fiber_100g": True,
                "sugars_100g": "4.5",
                "salt_100g": "1e999",
                "huge_100g": 10**40,
            },
        }
    )
    assert result["nutrition"]["sugars"] == 4.5
    assert all(result["nutrition"][key] is None for key in NUTRIENT_KEYS - {"sugars"})
    assert result["serving_quantity"] is None
    assert "energy-kcal_100g" not in result["raw_nutriments"]
    assert "huge_100g" not in result["raw_nutriments"]
    json.dumps(result, allow_nan=False)


@pytest.mark.parametrize(
    "payload",
    [
        {"status": 0, "code": EAN13},
        {"status": 0, "status_verbose": "product not found"},
    ],
)
def test_missing_product_has_explicit_not_found_error(payload):
    with pytest.raises(ProductNotFound):
        lookup_product(payload=payload)


def test_upstream_404_is_product_not_found():
    with pytest.raises(ProductNotFound):
        lookup_product(status_code=404)


@pytest.mark.parametrize("status_code", [301, 302, 403, 429, 500, 503])
def test_unavailable_or_redirecting_service_has_explicit_error(status_code):
    with pytest.raises(LookupUnavailable):
        lookup_product(status_code=status_code, headers={"Location": "https://evil.test/"})


@pytest.mark.parametrize(
    "payload",
    [
        [],
        {"status": 1},
        {"status": 1, "product": []},
        {"status": 1, "code": "036000291452", "product": {"code": EAN13}},
        {"status": 1, "code": EAN13, "product": {"code": "036000291452"}},
    ],
)
def test_malformed_or_mismatched_response_is_not_a_product(payload):
    with pytest.raises(LookupUnavailable):
        lookup_product(payload=payload)


def test_request_uses_fixed_https_host_user_agent_and_bounded_timeout():
    def respond(request):
        assert request.url.host == "world.openfoodfacts.org"
        assert request.url.scheme == "https"
        assert request.url.path == f"/api/v2/product/{EAN13}.json"
        assert "FoodLogger/" in request.headers["user-agent"]
        assert all(0 < timeout <= 10 for timeout in request.extensions["timeout"].values())
        return httpx.Response(200, json={"status": 1, "code": EAN13, "product": {}})

    client = httpx.Client(transport=httpx.MockTransport(respond), follow_redirects=True)
    try:
        assert OpenFoodFactsClient(client=client).lookup(EAN13)["barcode"] == EAN13
        assert not client.is_closed
    finally:
        client.close()


def test_invalid_barcode_never_makes_a_network_request():
    def respond(request):
        pytest.fail("Invalid GTIN must not be requested")

    with pytest.raises(InvalidBarcode):
        OpenFoodFactsClient(transport=httpx.MockTransport(respond)).lookup("../etc/passwd")


def test_network_timeout_is_lookup_unavailable():
    def respond(request):
        raise httpx.ReadTimeout("upstream timeout", request=request)

    with pytest.raises(LookupUnavailable):
        OpenFoodFactsClient(transport=httpx.MockTransport(respond)).lookup(EAN13)


@pytest.mark.parametrize("body", [b"not JSON", b" " * (2 * 1024 * 1024 + 1)])
def test_invalid_json_or_oversized_body_is_lookup_unavailable(body):
    transport = httpx.MockTransport(lambda request: httpx.Response(200, content=body))
    with pytest.raises(LookupUnavailable):
        OpenFoodFactsClient(transport=transport).lookup(EAN13)


@pytest.mark.parametrize(
    "requested,returned",
    [
        ("049000006346", "0049000006346"),
        ("05901234123457", "5901234123457"),
    ],
)
def test_equivalent_canonical_gtin_is_accepted(requested, returned):
    product = {"code": returned, "product_name": "Example", "nutriments": {}}
    client = OpenFoodFactsClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200, json={"status": 1, "code": returned, "product": product}
            )
        )
    )
    assert client.lookup(requested)["barcode"] == requested


def test_lookup_metadata_is_saveable_even_when_source_has_excess_or_invalid_keys():
    from foodlogger.schemas import CustomMealCreate

    nutrients = {
        "energy-kcal_100g": 100,
        "proteins_100g": 10,
        "carbohydrates_100g": 5,
        "fat_100g": 3,
    }
    nutrients.update({f"mineral{i}_100g": i for i in range(260)})
    nutrients.update({"שם_100g": 1, "x" * 81: 2, "calcium_unit": "mg"})
    client = OpenFoodFactsClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200, json={"status": 1, "product": {"code": EAN13, "nutriments": nutrients}}
            )
        )
    )
    product = client.lookup(EAN13)
    entry = CustomMealCreate(
        name=product["name"],
        nutrition=product["nutrition"],
        grams=100,
        day="2026-10-08",
        meal_type="snack",
        raw_nutriments={**product["raw_nutriments"], **product["nutriment_units"]},
    )
    assert entry.nutrition.protein == 10
    assert len(entry.raw_nutriments) <= 256
    assert any("omitted" in note for note in product["notes"])
