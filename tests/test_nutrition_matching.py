"""Real catalog regressions; no model requests or claims about photo accuracy."""

import pytest

from foodlogger.nutrition_reference import ReferenceCatalog


@pytest.mark.parametrize(
    "query", ["omelet", "omelette", "omelettes", "egg omelette", "plain omelette", "חביתה"]
)
@pytest.mark.parametrize("preparation", ["unknown", "cooked", "fried"])
def test_omelet_names_select_whole_egg_not_an_ingredient_or_substitute(query, preparation):
    rows = ReferenceCatalog().search(query, preparation, limit=8)
    assert rows and rows[0].id == "fdc:172185"
    assert all(row.nutrition.calories is not None for row in rows)
    assert all(
        not any(
            word in row.name.lower() for word in ["ingredient", "substitute", "white", "cheese"]
        )
        for row in rows
    )


@pytest.mark.parametrize(
    "query,preparation,expected",
    [
        ("fried eggs", "unknown", "fdc:173423"),
        ("ביצים", "fried", "fdc:173423"),
        ("ביצת עין", "unknown", "fdc:173423"),
        ("scrambled eggs", "cooked", "fdc:172187"),
        ("ביצה מקושקשת", "cooked", "fdc:172187"),
        ("ביצה קשה", "unknown", "fdc:173424"),
        ("bread roll", "baked", "fdc:174078"),
        ("לחמנייה", "baked", "fdc:174078"),
    ],
)
def test_related_foods_preserve_identity_and_preparation(query, preparation, expected):
    rows = ReferenceCatalog().search(query, preparation, limit=8)
    assert rows and rows[0].id == expected
    assert all("ingredient" not in row.name.lower() for row in rows)
    if "egg" in rows[0].name.lower():
        assert all(
            not any(word in row.name.lower() for word in ["substitute", "white", "yolk"])
            for row in rows
        )


@pytest.mark.parametrize("query", ["omelette with cheese made with oil", "חביתה עם גבינה ושמן"])
def test_cheese_qualifier_is_preserved_instead_of_using_plain_omelet(query):
    rows = ReferenceCatalog().search(query, "fried", limit=8)
    assert rows
    assert all("cheese" in row.name.lower() for row in rows)
    assert all(
        "substitute" not in row.name.lower() and "white" not in row.name.lower() for row in rows
    )
    assert all(
        "meat" not in row.name.lower() and "vegetable" not in row.name.lower() for row in rows
    )
    assert all("oil" in row.name.lower() for row in rows)


@pytest.mark.parametrize(
    "query,qualifier", [("egg white omelette", "white"), ("egg substitute omelette", "substitute")]
)
def test_explicit_egg_variants_remain_available_and_never_become_whole_egg(query, qualifier):
    rows = ReferenceCatalog().search(query, "fried", limit=8)
    assert rows and all(qualifier in row.name.lower() for row in rows)
    assert all("ingredient" not in row.name.lower() for row in rows)
    assert all(
        "with meat" not in row.name.lower() and "with vegetables" not in row.name.lower()
        for row in rows
    )


@pytest.mark.parametrize("query", ["omelette unicorn", "vegan omelette", "tahini sauce"])
def test_unresolved_qualifiers_do_not_fall_back_to_unrelated_nutrition(query):
    assert ReferenceCatalog().search(query) == []


@pytest.mark.parametrize("query", ["pita", "פיתה"])
def test_pita_is_bread_not_chips(query):
    rows = ReferenceCatalog().search(query, limit=8)
    assert rows and "bread" in rows[0].name.lower()
    assert all("chip" not in row.name.lower() for row in rows)


def test_food_name_inside_another_dish_does_not_become_the_primary_food():
    for query in ["egg", "omelet", "bread roll"]:
        rows = ReferenceCatalog().search(query, "cooked", limit=8)
        assert rows
        assert all(
            not any(
                word in r.name.lower()
                for word in ["ingredient", "quesadilla", "taquito", "congee", "sandwich"]
            )
            for r in rows
        )


@pytest.mark.parametrize(
    "query,preparation,expected",
    [
        ("flaxseed", "unknown", "fdc:169414"),
        ("macadamia", "raw", "fdc:170178"),
        ("coconut", "raw", "fdc:170169"),
        ("walnut", "raw", "fdc:170187"),
        ("pita chips", "baked", "fdc:2708215"),
    ],
)
def test_category_first_foods_and_explicit_pita_chips_still_work(query, preparation, expected):
    rows = ReferenceCatalog().search(query, preparation)
    assert rows and rows[0].id == expected


def test_omelet_unknown_fat_does_not_silently_become_fat_free_or_spray():
    rows = ReferenceCatalog().search("omelette", "fried", limit=8)
    assert rows and rows[0].id == "fdc:172185"
    assert all("no added fat" not in r.name and "cooking spray" not in r.name for r in rows)
    # The extract has only fat-specific cheese recipes. Ask for the missing
    # detail rather than quietly assume that no fat was used.
    assert ReferenceCatalog().search("omelette with cheese", "fried") == []


@pytest.mark.parametrize("query", ["omelette fat added", "omelette with cheese fat added"])
def test_added_fat_query_never_selects_no_added_fat(query):
    rows = ReferenceCatalog().search(query, "fried", limit=8)
    assert all("no added fat" not in r.name for r in rows)


def test_explicit_no_added_fat_preserves_negation():
    rows = ReferenceCatalog().search("egg omelette no added fat", "fried", limit=8)
    assert rows and all("no added fat" in r.name for r in rows)


@pytest.mark.parametrize("query", ["egg", "eggs", "ביצים"])
def test_generic_cooked_egg_does_not_invent_recipe_species_or_cooking_method(query):
    rows = ReferenceCatalog().search(query, "cooked", limit=8)
    assert rows and rows[0].id == "fdc:2707153"
    assert all(
        not any(
            word in r.name.lower()
            for word in ["deviled", "benedict", "creamed", "yung", "goose", "duck", "quail"]
        )
        for r in rows
    )
