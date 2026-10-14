import json

from foodlogger.food_providers import FoodProviders, regional_query, validate_extract
from foodlogger.products import LookupUnavailable


def test_regional_aliases_do_not_fabricate_composition():
    names = {
        "פיתה": "pita bread",
        "חומוס": "hummus",
        "טחינה": "tahini",
        "פלאפל": "falafel",
        "שקשוקה": "shakshuka",
        "סביח": "sabich",
        "שניצל": "chicken breaded fried",
        "סלט ישראלי": "israeli salad",
        "בורקס": "bourekas",
        "מלאווח": "malawach",
        "ג׳חנון": "jachnun",
        "קוטג׳": "cottage cheese",
        "לבנה": "labneh",
        "שווארמה": "shawarma",
        "קבב": "kebab",
    }
    for source, expected in names.items():
        assert regional_query(source) == expected
    result = FoodProviders().search("סביח")
    assert result["recipe_dependent"] and result["foods"] == []
    pita = FoodProviders().search("פיתה")["foods"][0]
    assert pita["reference"]["id"].startswith("fdc:")
    assert pita["version"] and pita["license"] == "CC0"
    assert pita["display_source"] and pita["reference"]["source_url"]


def test_exact_barcode_precedes_generic_and_failed_source_is_visible():
    class Products:
        def lookup(self, barcode):
            return {"barcode": barcode, "name": "Exact branded pita", "source": "Open Food Facts"}

    providers = FoodProviders(products=Products())
    r = providers.search("pita", barcode="7290000000008")
    assert r["exact_product"]["name"] == "Exact branded pita"
    assert r["precedence"][0] == "exact_barcode"

    class Failed:
        def lookup(self, barcode):
            raise LookupUnavailable("not reachable")

    r = FoodProviders(products=Failed()).search("pita", barcode="7290000000008")
    assert r["foods"] and r["source_status"]["open_food_facts"] == "unavailable"


def test_import_validation_checks_identity_numbers_units_and_checksum():
    record = {
        "id": "fdc:1",
        "name": "Food",
        "data_type": "SR Legacy",
        "nutrition": {"calories": 100, "protein": None},
    }
    report = validate_extract({"basis": "per 100 g edible portion", "foods": [record]})
    assert report["valid"] and len(report["sha256"]) == 64
    assert report == validate_extract({"foods": [record], "basis": "per 100 g edible portion"})
    for records in [
        [record, record],
        [{**record, "nutrition": {"protein": float("nan")}}],
        [{**record, "nutrition": {"fat": 101}}],
    ]:
        assert not validate_extract({"basis": "per 100 g edible portion", "foods": records})[
            "valid"
        ]
    assert not validate_extract({"basis": "per serving", "foods": [record]})["valid"]


def test_usda_command_dry_run_does_not_write(tmp_path, monkeypatch, capsys):
    import importlib.util

    spec = importlib.util.spec_from_file_location("importer", "scripts/import_usda_reference.py")
    importer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(importer)
    monkeypatch.setattr(
        importer,
        "extract",
        lambda directory: {
            "basis": "per 100 g edible portion",
            "foods": [{"id": "fdc:1", "name": "x", "data_type": "SR Legacy", "nutrition": {}}],
        },
    )
    target = tmp_path / "not-created.json"
    importer.main([str(tmp_path), "--dry-run", "--output", str(target)])
    assert not target.exists()
    assert json.loads(capsys.readouterr().out)["valid"]
