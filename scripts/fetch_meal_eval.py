"""Download a small, deterministic held-out Nutrition5k sample (CC BY 4.0).

Real published ingredient masses/totals; no fabricated labels. Run from repo root.
The published CSV rows have 6 dish columns followed by 7 columns per ingredient
(the README's num_ingrs description does not match these actual files).
"""

import csv
import hashlib
import json
from pathlib import Path

import httpx

BASE = "https://storage.googleapis.com/nutrition5k_dataset/nutrition5k_dataset/"
IDS = [
    "dish_1558376306",
    "dish_1558546663",
    "dish_1558030435",
    "dish_1557862783",
    "dish_1558544663",
    "dish_1558376483",
    "dish_1557937758",
    "dish_1557861216",
]
ROOT = Path("evaluations/meal_analysis")


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    (ROOT / "images").mkdir(exist_ok=True)
    labels = json.loads((ROOT / "visible-labels.json").read_text())
    with httpx.Client(timeout=45) as client:
        metadata = client.get(BASE + "metadata/dish_metadata_cafe1.csv")
        metadata.raise_for_status()
        split = client.get(BASE + "dish_ids/splits/rgb_test_ids.txt")
        split.raise_for_status()
        test_ids = set(split.text.splitlines())
        rows = {r[0]: r for r in csv.reader(metadata.text.splitlines())}
        cases = []
        for dish_id in dict.fromkeys(IDS):
            assert dish_id in test_ids
            row = rows[dish_id]
            assert (len(row) - 6) % 7 == 0
            url = BASE + f"imagery/realsense_overhead/{dish_id}/rgb.png"
            photo = client.get(url)
            photo.raise_for_status()
            file = ROOT / "images" / (dish_id + ".png")
            file.write_bytes(photo.content)
            ingredients = [
                {
                    "id": row[i],
                    "name": row[i + 1],
                    "grams": float(row[i + 2]),
                    "calories": float(row[i + 3]),
                    "fat": float(row[i + 4]),
                    "carbs": float(row[i + 5]),
                    "protein": float(row[i + 6]),
                }
                for i in range(6, len(row), 7)
            ]
            no_food = all(x["name"] == "plate only" for x in ingredients)
            cases.append(
                {
                    "id": dish_id,
                    "file": str(file.relative_to(ROOT)),
                    "url": url,
                    "sha256": hashlib.sha256(photo.content).hexdigest(),
                    "license": "CC-BY-4.0",
                    "split": "official rgb_test_ids",
                    "reference_ingredients": ingredients,
                    "reference_total": {
                        "calories": float(row[1]),
                        "grams": float(row[2]),
                        "fat": float(row[3]),
                        "carbs": float(row[4]),
                        "protein": float(row[5]),
                    },
                    "expected_status": "no_food" if no_food else "food",
                    "visible_food_labels": None,
                    "annotation_note": (
                        "Published ingredients include hidden ingredients; "
                        "not object-detection ground truth."
                    ),
                }
            )
            annotation = labels.get(dish_id)
            if annotation and annotation["sha256"] == cases[-1]["sha256"]:
                cases[-1].update(annotation)
            print(dish_id, len(photo.content), [i["name"] for i in ingredients])
    manifest = {
        "dataset": "Nutrition5k",
        "attribution": "Quin Thames et al., Google Research, CVPR 2021",
        "source": "https://github.com/google-research-datasets/Nutrition5k",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "metadata_url": BASE + "metadata/dish_metadata_cafe1.csv",
        "metadata_sha256": hashlib.sha256(metadata.content).hexdigest(),
        "cases": cases,
        "coverage_gaps": [
            "Israeli/Mediterranean dishes",
            "multiple plates",
            "beverages",
            "known-size plate references",
            "second angles",
            "occluded foods",
        ],
        "metric_notes": "Ingredient annotations cannot be treated as visible object labels. "
        "Detection precision/recall require separately reviewed visible labels. "
        "Empty-plate dataset mass is a 1g placeholder, excluded from mass metrics.",
    }
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
