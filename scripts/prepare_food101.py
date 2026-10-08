"""Convert an already downloaded Food-101 dataset using its official split files."""

import argparse
import shutil
from pathlib import Path


def prepare(source: Path, destination: Path, classes: list[str]):
    if destination.exists():
        raise ValueError("Use a new destination directory.")
    known = set((source / "meta/classes.txt").read_text().splitlines())
    if len(set(classes)) < 2 or not set(classes) <= known:
        raise ValueError("Choose at least two different classes from meta/classes.txt.")
    for split in ("train", "test"):
        for row in (source / f"meta/{split}.txt").read_text().splitlines():
            label = row.split("/")[0]
            if label not in classes:
                continue
            original = source / "images" / f"{row}.jpg"
            target = destination / split / label / original.name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(original, target)
    print(f"Prepared {len(classes)} classes at {destination}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--destination", type=Path, required=True)
    parser.add_argument("--classes", nargs="+", default=["pizza", "ice_cream", "hot_dog"])
    args = parser.parse_args()
    prepare(args.source, args.destination, args.classes)
