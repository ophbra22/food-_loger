"""Deterministic decimal arithmetic. Rounding belongs to display, not item sums."""

import re
from decimal import Decimal

from foodlogger.domain import NUTRIENT_FIELDS, NutritionPer100, Portion


def number(value):
    result = Decimal(str(value))
    if not result.is_finite() or result < 0 or result > 100000000:
        raise ValueError("Use a finite, nonnegative bounded amount.")
    return result


def parse_quantity(text: str) -> Decimal | None:
    value = re.sub(r"[\s\u200e\u200f\u202a-\u202e\u2066-\u2069]", "", text)
    if not re.fullmatch(r"(?:\d{1,7}(?:[.,]\d{0,4})?|[.,]\d{1,4})", value):
        return None
    return Decimal(value.replace(",", "."))


def normalize_portion(
    quantity,
    unit,
    basis,
    *,
    density_g_per_ml=None,
    conversion_amount=None,
    conversion_id=None,
    estimated=False,
):
    amount = number(quantity)
    if unit != basis:
        if unit in {"g", "ml"} and basis in {"g", "ml"}:
            if density_g_per_ml is None or number(density_g_per_ml) == 0:
                raise ValueError("Food-specific density is required.")
            density = number(density_g_per_ml)
            amount = amount * density if basis == "g" else amount / density
        elif conversion_amount is not None and conversion_id:
            amount *= number(conversion_amount)
        else:
            raise ValueError("Food-specific serving conversion is required.")
    return Portion(
        quantity=quantity,
        unit=unit,
        **{"normalized_" + basis: amount},
        food_specific_conversion_id=conversion_id,
        estimated=estimated,
    )


def scale_nutrients_exact(nutrition: NutritionPer100, portion: Portion) -> dict:
    amount = getattr(portion, "normalized_" + nutrition.basis)
    if amount is None:
        raise ValueError("Resolve the portion in the nutrient basis before calculating.")
    return {
        key: None if (value := getattr(nutrition, key)) is None else value * amount / 100
        for key in NUTRIENT_FIELDS
    }


def aggregate_nutrients(rows: list[dict]) -> dict:
    known, partial, values = {}, {}, {}
    for key in NUTRIENT_FIELDS:
        partial[key] = not rows or any(row.get(key) is None for row in rows)
        known[key] = sum((number(row[key]) for row in rows if row.get(key) is not None), Decimal(0))
        values[key] = None if partial[key] else known[key]
    return {"values": values, "known_totals": known, "partial": partial}


def energy_kcal(*, kcal=None, kj=None):
    return (
        number(kcal) if kcal is not None else None if kj is None else number(kj) / Decimal("4.184")
    )


def sodium_mg(*, sodium_g=None, salt_g=None):
    return (
        number(sodium_g) * 1000
        if sodium_g is not None
        else (None if salt_g is None else number(salt_g) * 1000 / Decimal("2.5"))
    )
