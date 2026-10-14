"""Rebuild the public-domain per-100g extract from official USDA ZIPs.

Usage: python scripts/import_usda_reference.py runtime/meal-analysis
Downloads are explicit and bounded; this is an offline maintenance command.
"""

import hashlib
import json
import argparse
import zipfile
from pathlib import Path

ARCHIVES = [
    "FoodData_Central_sr_legacy_food_json_2018-04.zip",
    "FoodData_Central_survey_food_json_2024-10-31.zip",
]
NUTRIENTS = {
    1008: ("calories", "kcal"),
    1003: ("protein", "g"),
    1004: ("fat", "g"),
    1005: ("carbs", "g"),
}


def extract(directory: Path):
    records, sources = [], []
    for name in ARCHIVES:
        path = directory / name
        sources.append(
            {
                "url": "https://fdc.nal.usda.gov/fdc-datasets/" + name,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            }
        )
        with zipfile.ZipFile(path) as archive:
            member = next(n for n in archive.namelist() if n.endswith(".json"))
            data = json.loads(archive.read(member))
        for food in next(iter(data.values())):
            values = {}
            for row in food.get("foodNutrients", []):
                nutrient = row["nutrient"]
                expected = NUTRIENTS.get(nutrient["id"])
                if expected and nutrient["unitName"].lower() == expected[1]:
                    value = row.get("amount")
                    if isinstance(value, (int, float)) and 0 <= value <= (
                        1000 if expected[0] == "calories" else 100
                    ):
                        values[expected[0]] = value
            records.append(
                {
                    "id": f"fdc:{food['fdcId']}",
                    "name": food["description"],
                    "data_type": food["dataType"],
                    "nutrition": values,
                }
            )
    records.sort(key=lambda r: r["id"])
    output = {
        "source": "USDA FoodData Central",
        "license": "Public domain (CC0)",
        "basis": "per 100 g edible portion",
        "archives": sources,
        "foods": records,
    }
    return output


def main(argv=None):
    from foodlogger.food_providers import validate_extract

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    if not args.dry_run and args.output is None:
        parser.error("Use --dry-run or an explicit --output path.")
    output = extract(args.directory)
    report = validate_extract(output)
    print(json.dumps(report))
    if not report["valid"]:
        raise SystemExit(1)
    if not args.dry_run:
        args.output.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
