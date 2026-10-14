from decimal import Decimal

import pytest

from foodlogger.database import Database
from foodlogger.food_providers import reference_version
from foodlogger.servings import Servings, normalize_unit


def test_selected_food_version_and_size_define_portion(tmp_path):
    servings = Servings(Database(tmp_path / "s.db"))
    rows = servings.list("fdc:174915", reference_version())
    small = next(r for r in rows if r["unit"] == "small")
    large = next(r for r in rows if r["unit"] == "large")
    assert (
        servings.convert(
            small["id"], "fdc:174915", reference_version(), Decimal("0.5")
        ).normalized_g
        == 14
    )
    assert (
        servings.convert(
            large["id"], "fdc:174915", reference_version(), Decimal("0.5")
        ).normalized_g
        == 30
    )
    for food, version in [("fdc:170189", reference_version()), ("fdc:174915", "stale")]:
        with pytest.raises(ValueError):
            servings.convert(small["id"], food, version, 1)
    assert servings.list("missing", reference_version()) == []
    assert small["evidence"] and small["confidence"] == "source_reported"


def test_food_specific_spoons_and_no_implicit_density(tmp_path):
    s = Servings(Database(tmp_path / "s.db"))
    tahini = next(r for r in s.list("fdc:170189", reference_version()) if r["unit"] == "tablespoon")
    rice = next(r for r in s.list("fdc:168878", reference_version()) if r["unit"] == "tablespoon")
    assert tahini["amount"] == 15 and rice["amount"] == 9.875
    assert rice["confidence"] == "derived"
    assert s.list("fdc:168878", "unverified") == []
    for quantity in [0, -1, 2001, float("nan"), float("inf")]:
        with pytest.raises(ValueError):
            s.convert(tahini["id"], "fdc:170189", reference_version(), quantity)


@pytest.mark.parametrize(
    "a,b",
    [
        ("כף", "tablespoon"),
        ("tbsp", "tablespoon"),
        ("כפית", "teaspoon"),
        ("cup", "cup"),
        ("כוס", "cup"),
        ("פרוסה", "slice"),
        ("יחידה", "piece"),
        ("קטן", "small"),
        ("בינוני", "medium"),
        ("גדול", "large"),
    ],
)
def test_bilingual_units(a, b):
    assert normalize_unit(a) == b


def test_api_flags_and_versioned_reference(tmp_path):
    from fastapi.testclient import TestClient
    from test_meal_analysis_pipeline import register

    from foodlogger.app import create_app
    from foodlogger.security import Settings

    for enabled in (False, True):
        with TestClient(
            create_app(
                tmp_path / f"{enabled}.db",
                settings=Settings(servings_enabled=enabled, food_sources_enabled=enabled),
            )
        ) as c:
            assert c.get("/api/servings?food_id=fdc:174915&version=x").status_code == 401
            h = register(c, "alice")
            r = c.get(
                "/api/servings",
                params={"food_id": "fdc:174915", "version": reference_version()},
                headers=h,
            )
            assert r.status_code == (200 if enabled else 503)
            if enabled:
                assert len(r.json()["conversions"]) == 2
                foods = c.get("/api/analysis/references?q=פיתה", headers=h).json()["foods"]
                assert foods[0]["source_version"] == reference_version()
                assert c.get("/api/food-sources?q=סביח", headers=h).json()["recipe_dependent"]
