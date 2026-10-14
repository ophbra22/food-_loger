"""Food/version-specific measures. Missing measures require a weighed amount."""

import json
from decimal import Decimal, InvalidOperation
from importlib.resources import files

from foodlogger.domain import Portion

UNITS = {
    "tbsp": "tablespoon",
    "כף": "tablespoon",
    "tsp": "teaspoon",
    "כפית": "teaspoon",
    "כוס": "cup",
    "פרוסה": "slice",
    "יחידה": "piece",
    "קטן": "small",
    "בינוני": "medium",
    "גדול": "large",
}


def normalize_unit(unit):
    return UNITS.get(unit.strip().lower(), unit.strip().lower())


class Servings:
    def __init__(self, database):
        self.database = database
        if not database.postgres:
            with database.connect() as db:
                db.execute(
                    "CREATE TABLE IF NOT EXISTS serving_conversions ("
                    "id TEXT PRIMARY KEY, food_id TEXT NOT NULL, source_version TEXT NOT NULL, "
                    "payload TEXT NOT NULL)"
                )
                db.execute(
                    "CREATE INDEX IF NOT EXISTS serving_food_version "
                    "ON serving_conversions(food_id,source_version)"
                )
                for row in json.loads(
                    files("foodlogger").joinpath("data/servings.json").read_text()
                ):
                    db.execute(
                        "INSERT INTO serving_conversions(id,food_id,source_version,payload) "
                        "VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING",
                        (row["id"], row["food_id"], row["source_version"], json.dumps(row)),
                    )

    def list(self, food_id, version):
        with self.database.connect() as db:
            return [
                json.loads(r["payload"])
                for r in db.execute(
                    "SELECT payload FROM serving_conversions WHERE food_id=? AND source_version=? "
                    "ORDER BY id LIMIT 50",
                    (food_id, version),
                ).fetchall()
            ]

    def convert(self, identity, food_id, version, quantity):
        try:
            quantity = Decimal(str(quantity))
            if not quantity.is_finite() or not 0 < quantity <= 100000:
                raise ValueError("Enter a positive bounded quantity.")
        except InvalidOperation:
            raise ValueError("Enter a valid quantity.") from None
        row = next((r for r in self.list(food_id, version) if r["id"] == identity), None)
        if row is None:
            raise ValueError("No conversion for the selected food and source version.")
        amount = quantity * Decimal(str(row["amount"]))
        if not Decimal("0.0001") <= amount <= 2000:
            raise ValueError("Use 0.0001–2000 g/ml per food.")
        return Portion(
            quantity=quantity,
            unit=row["label"],
            **{f"normalized_{row['basis']}": amount},
            food_specific_conversion_id=row["id"],
            estimated=True,
        )
