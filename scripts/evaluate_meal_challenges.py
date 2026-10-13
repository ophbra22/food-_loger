"""Licensed qualitative challenge photos, not weighed nutrition ground truth."""

import hashlib
import json
import os
import time
from pathlib import Path

from foodlogger.analysis_schemas import AnalysisOptions
from foodlogger.meal_analysis import AnalysisService
from foodlogger.vision import VisionUnavailable

ROOT = Path("evaluations/meal_analysis")
CASES = [
    {
        "id": "falafel-platter",
        "file": "images/falafel-platter.jpg",
        "source": "https://commons.wikimedia.org/wiki/File:Falafel_platter.jpg",
        "download_url": "https://upload.wikimedia.org/wikipedia/commons/a/a6/Falafel_platter.jpg",
        "author": "Shreya13jain",
        "license": "CC-BY-SA-4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
        "coverage": [
            "Mediterranean",
            "overlapping foods",
            "sauces",
            "poor lighting",
            "ambiguous background bowl",
        ],
        "observations": (
            "Falafel, pita, hummus with olive, white sauce described as mayonnaise by author, "
            "pickled vegetables on lettuce; partly visible ambiguous bowl at upper left."
        ),
        "measured_nutrition": None,
    },
    {
        "id": "shakshuka-pita",
        "file": "images/shakshuka-pita.jpg",
        "source": "https://commons.wikimedia.org/wiki/File:Shakshuka_and_Pita_with_Zatar.jpg",
        "download_url": "https://upload.wikimedia.org/wikipedia/commons/d/d1/Shakshuka_and_Pita_with_Zatar.jpg",
        "author": "Robert Judge",
        "license": "CC-BY-2.0",
        "license_url": "https://creativecommons.org/licenses/by/2.0/",
        "coverage": [
            "Mediterranean",
            "mixed dish",
            "multiple dishes",
            "beverage",
            "bowl",
            "hidden ingredients",
        ],
        "observations": (
            "Shakshuka in a bowl (eggs partly hidden), zaatar pita on a separate plate, "
            "dark beverage resembling coffee. Author identifies shakshuka and pita; "
            "coffee is visual inference."
        ),
        "measured_nutrition": None,
    },
]


def main():
    for line in Path(".env").read_text().splitlines():
        name, _, value = line.partition("=")
        if name in {"GEMINI_API_KEY", "FOODLOGGER_GEMINI_FREE_TIER_CONFIRMED"}:
            os.environ.setdefault(name, value.strip())
    service = AnalysisService()
    cases = []
    for case in CASES:
        if cases:
            time.sleep(13)
        data = (ROOT / case["file"]).read_bytes()
        row = {
            **case,
            "sha256": hashlib.sha256(data).hexdigest(),
            "changes": "Original file, unchanged.",
            "annotation": (
                "Qualitative implementation-agent inspection; not independent ground truth."
            ),
        }
        started = time.monotonic()
        try:
            result = service.analyze(
                [data], AnalysisOptions(language="he"), "licensed-challenges", case["id"]
            )
            row.update(status="ok", result=result.model_dump())
        except VisionUnavailable as error:
            cause = error.__cause__
            row.update(
                status="failed",
                error=str(error),
                cause_type=type(cause).__name__,
                upstream_status=getattr(getattr(cause, "response", None), "status_code", None),
            )
        row["elapsed_ms"] = round((time.monotonic() - started) * 1000)
        print(case["id"], row["status"], row["elapsed_ms"], flush=True)
        cases.append(row)
    (ROOT / "challenge-report.json").write_text(
        json.dumps(cases, ensure_ascii=False, indent=2) + "\n"
    )


if __name__ == "__main__":
    main()
