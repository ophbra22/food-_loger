"""Fetch and verify the small default checkpoint during a deployment build."""

import hashlib
import sys
import urllib.request
from pathlib import Path

from foodlogger.classifier import WEIGHTS_SHA256, WEIGHTS_URL


def main():
    destination = Path(sys.argv[1])
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(".download")
    try:
        with urllib.request.urlopen(WEIGHTS_URL, timeout=60) as source, temporary.open("wb") as out:
            digest = hashlib.sha256()
            size = 0
            while chunk := source.read(64 * 1024):
                size += len(chunk)
                if size > 30 * 1024 * 1024:
                    raise RuntimeError("Unexpected model checkpoint size")
                digest.update(chunk)
                out.write(chunk)
        if digest.hexdigest() != WEIGHTS_SHA256:
            raise RuntimeError("Model checkpoint SHA-256 mismatch")
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)
    print(f"Verified checkpoint: {destination}")


if __name__ == "__main__":
    main()
