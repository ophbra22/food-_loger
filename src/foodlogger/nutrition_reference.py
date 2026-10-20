"""Public-domain USDA reference retrieval and auditable decimal portion arithmetic.

Matching scores rank records; they are NOT calibrated probabilities. A record is
never invented and a missing value never becomes zero. No photo or user data in cache.
"""

import json
import math
import re
from decimal import ROUND_HALF_UP, Decimal
from functools import lru_cache
from importlib.resources import files

from foodlogger.analysis_schemas import ReferenceFood
from foodlogger.nutrition import NUTRIENTS

ALIASES = {
    "חומוס": "hummus",
    "פלאפל": "falafel",
    "אורז": "rice cooked",
    "טחינה": "tahini",
    "עוף": "chicken",
    "שניצל": "chicken breaded fried",
    "קוסקוס": "couscous cooked",
    "שווארמה": "shawarma",
    "סלט": "salad",
    "תפוח אדמה": "potato",
    "ביצה": "egg",
    "ביצים": "eggs",
    "חביתה": "egg omelet",
    "חביתות": "egg omelet",
    "ביצת עין": "egg fried",
    "ביצי עין": "egg fried",
    "ביצה מקושקשת": "egg scrambled",
    "ביצים מקושקשות": "egg scrambled",
    "ביצה קשה": "egg hard boiled",
    "ביצים קשות": "egg hard boiled",
    "לחמנייה": "bread roll",
    "לחמניה": "bread roll",
    "לחמניות": "bread roll",
    "גבינה": "cheese",
    "עם": "with",
    "schnitzel": "chicken breaded fried",
    "garbanzo": "chickpea",
    "aubergine": "eggplant",
    "courgette": "zucchini",
    "tahina": "tahini",
    "capsicum": "pepper",
}
STOP = {
    "and",
    "with",
    "of",
    "the",
    "a",
    "an",
    "in",
    "or",
    "food",
    "plain",
    "fresh",
    "sliced",
    "chopped",
    "cubed",
    "cubes",
    "pieces",
}
# A mention inside a different recipe is not the requested food's composition.
RECIPE_KINDS = {
    "cookie",
    "cake",
    "pie",
    "soup",
    "sandwich",
    "pudding",
    "salad",
    "dressing",
    "sauce",
    "bread",
    "pizza",
    "juice",
    "jam",
    "butter",
    "spread",
    "candy",
    "chocolate",
    "flour",
    "powder",
    "cereal",
    "bar",
    "oil",
    "paste",
    "cracker",
    "muffin",
    "gravy",
    "burrito",
    "roll",
    "grease",
    "margarine",
    "chip",
    "quesadilla",
    "taquito",
    "congee",
    "burger",
}
OTHER_MAIN_FOODS = {
    "chicken",
    "fish",
    "shrimp",
    "tofu",
    "bean",
    "pea",
    "milk",
    "yogurt",
    "egg",
    "cheese",
    "potato",
    "rice",
    "pasta",
    "noodle",
    "lentil",
    "carrot",
    "vegetable",
    "tomato",
    "onion",
}
IMPLICIT_RAW = {"almond", "walnut", "cashew", "pecan", "hazelnut", "pistachio"}
COOKED = {
    "cooked",
    "grilled",
    "roasted",
    "fried",
    "boiled",
    "steamed",
    "baked",
    "stewed",
    "braised",
    "rotisserie",
}


def tokens(text):
    from foodlogger.food_providers import regional_query

    text = regional_query(text)
    # Translate multiword foods before their component words (e.g. ביצה קשה).
    for word in sorted(ALIASES, key=len, reverse=True):
        replacement = ALIASES[word]
        text = re.sub(r"(?<!\w)" + re.escape(word) + r"(?!\w)", replacement, text)
    irregular = {
        "omelette": "omelet",
        "omelettes": "omelet",
        "potatoes": "potato",
        "tomatoes": "tomato",
        "berries": "berry",
        "strawberries": "strawberry",
        "blueberries": "blueberry",
    }
    return {
        irregular.get(word, word[:-1] if word.endswith("s") and len(word) > 3 else word)
        for word in re.findall(r"[^\W_]+", text)
        if word not in STOP
    }


def rounded(value):
    return float(Decimal(str(value)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def scale_nutrients(per100: dict, grams: float) -> dict:
    if isinstance(grams, bool) or not math.isfinite(grams) or not 1 <= grams <= 2000:
        raise ValueError("Use 1–2000 grams per component.")
    return {
        k: None
        if per100.get(k) is None
        else float(
            (Decimal(str(per100[k])) * Decimal(str(grams)) / 100).quantize(
                Decimal("0.1"), rounding=ROUND_HALF_UP
            )
        )
        for k in NUTRIENTS
    }


def aggregate(items: list[dict]) -> dict:
    return {
        k: None
        if any(row.get(k) is None for row in items)
        else float(
            sum((Decimal(str(row[k])) for row in items), Decimal(0)).quantize(
                Decimal("0.1"), rounding=ROUND_HALF_UP
            )
        )
        for k in NUTRIENTS
    }


@lru_cache(maxsize=1)
def _data():
    from foodlogger.food_providers import reference_version

    payload = json.loads(files("foodlogger").joinpath("data/usda_reference.json").read_text())
    records = {
        row["id"]: ReferenceFood(
            **row,
            source_version=reference_version(),
            source_url=f"https://fdc.nal.usda.gov/food-details/{row['id'].split(':')[1]}/nutrients",
        )
        for row in payload["foods"]
    }
    index = {key: tokens(value.name) for key, value in records.items()}
    # USDA names start with the subject; a later ingredient is not that subject.
    subjects = {
        key: tokens(re.split(r",|\bwith\b|\bas ingredient\b", value.name.lower())[0])
        for key, value in records.items()
    }
    frequency = {}
    for words in index.values():
        for word in words:
            frequency[word] = frequency.get(word, 0) + 1
    return records, index, frequency, subjects


class ReferenceCatalog:
    def __init__(self):
        self.records, self.index, self.frequency, self.subjects = _data()
        self._cached_search = lru_cache(maxsize=256)(self._search_ids)

    def get(self, reference_id: str) -> ReferenceFood:
        return self.records[reference_id].model_copy(deep=True)

    def _search_ids(self, query: str, preparation: str):
        words = tokens(query)
        # Implicit identities apply to queries only, never to a record merely
        # mentioning an omelet as the destination for a separate ingredient.
        if words & {"omelet", "scrambled"}:
            words.add("egg")
        if "pita" in words:
            words.add("bread")
        if preparation == "unknown":
            preparation = next(
                (
                    p
                    for p in [
                        "raw",
                        "fried",
                        "grilled",
                        "roasted",
                        "boiled",
                        "steamed",
                        "baked",
                        "cooked",
                    ]
                    if p in words
                ),
                "unknown",
            )
        identity = words - COOKED - {"raw"}
        if not identity or identity <= {"meat", "vegetable", "fruit", "mixed", "dish"}:
            return ()
        # All identity terms must occur: better no result than matching tahini
        # sauce to undiluted paste, or chicken breast to chicken soup.
        results = []
        for key, record_words in self.index.items():
            if not identity <= record_words:
                continue
            name = self.records[key].name.lower()
            if "ingredient" in record_words or not identity & self.subjects[key]:
                continue
            if "egg" in words and (record_words & {"white", "yolk", "substitute", "meat"}) - words:
                continue
            if (record_words & RECIPE_KINDS) - words:
                continue
            if (record_words & OTHER_MAIN_FOODS) - words:
                continue
            if "rendered fat" in name and "fat" not in words:
                continue
            if preparation == "raw" and "raw" not in record_words and not identity <= IMPLICIT_RAW:
                continue
            if preparation in COOKED and ("raw" in record_words or "uncooked" in record_words):
                continue
            if (preparation == "raw" or "raw" in words) and record_words & COOKED:
                continue
            if preparation in {"fried", "grilled", "roasted", "boiled", "steamed", "baked"}:
                incompatible = record_words & {"fried", "grilled", "roasted", "boiled", "steamed"}
                if incompatible and preparation not in incompatible:
                    continue
            score = 8 - 0.3 * len(record_words - identity - {"nf", "nfs"})
            if preparation in record_words:
                score += 0.2 if preparation == "cooked" else 3
            if preparation == "raw" and "unroasted" in record_words:
                score += 3
            score += 0.1 if preparation in COOKED and record_words & COOKED else 0
            # Avoid subtly different manufactured/baby/dried foods for generic meals.
            for qualifier in {
                "babyfood",
                "infant",
                "dried",
                "powder",
                "dehydrated",
                "canned",
                "skin",
                "battered",
                "breaded",
                "sweetened",
                "imitation",
                "glutinous",
                "liver",
                "turkey",
                "sweet",
                "solution",
                "flavored",
                "salted",
                "multigrain",
                "meatless",
                "canadian",
                "beef",
                "bits",
                "pickled",
            }:
                if tokens(qualifier) & record_words and not tokens(qualifier) <= words:
                    score -= 4
            if "not specified" in name:
                score -= 0.5
            if score > 0:
                results.append((score, key))
        return tuple(key for _, key in sorted(results, reverse=True)[:8])

    def search(self, query: str, preparation: str = "unknown", limit: int = 5):
        return [self.get(key) for key in self._cached_search(query[:160], preparation)[:limit]]
