import math
import re
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_validator

RAW_NUTRIMENT_MAX_FIELDS = 256
RAW_NUTRIMENT_KEY = re.compile(r"[A-Za-z0-9_-]{1,80}")

Portion = Annotated[float, Field(ge=1, le=2000, allow_inf_nan=False)]
MealType = Literal["breakfast", "lunch", "dinner", "snack"]


def iso_date(value):
    if type(value) is date:
        return value
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        raise ValueError("Use an ISO date in YYYY-MM-DD format.")
    return date.fromisoformat(value)


JournalDate = Annotated[date, BeforeValidator(iso_date)]


class MealCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    food_id: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9_]+$")
    grams: Portion
    day: JournalDate
    meal_type: MealType


NutrientGrams = Annotated[float, Field(ge=0, le=100, allow_inf_nan=False)]


class NutritionValues(BaseModel):
    model_config = ConfigDict(extra="forbid")

    calories: float = Field(ge=0, le=1000, allow_inf_nan=False)
    protein: NutrientGrams
    carbs: NutrientGrams
    fat: NutrientGrams
    sugars: NutrientGrams | None = None
    saturated_fat: NutrientGrams | None = None
    fiber: NutrientGrams | None = None
    salt: NutrientGrams | None = None
    sodium: NutrientGrams | None = None


class CustomMealCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    brand: str = Field(default="", max_length=120)
    barcode: str | None = Field(default=None, pattern=r"^[0-9]{8,14}$")
    grams: Portion
    basis_unit: Literal["g", "ml"] = "g"
    day: JournalDate
    meal_type: MealType
    nutrition: NutritionValues
    source: Literal["manual", "barcode"] = "manual"
    raw_nutriments: dict[str, float | str | None] = Field(
        default_factory=dict, max_length=RAW_NUTRIMENT_MAX_FIELDS
    )

    @field_validator("name", "brand")
    @classmethod
    def clean_text(cls, value):
        value = value.strip()
        if any(ord(char) < 32 for char in value):
            raise ValueError("Text must not contain control characters.")
        return value

    @field_validator("name")
    @classmethod
    def nonempty_name(cls, value):
        if not value:
            raise ValueError("Enter a food name.")
        return value

    @field_validator("raw_nutriments")
    @classmethod
    def bounded_raw_nutrients(cls, value):
        for key, item in value.items():
            if not RAW_NUTRIMENT_KEY.fullmatch(key):
                raise ValueError("Invalid nutrient name.")
            if isinstance(item, float) and (not math.isfinite(item) or not -1e9 <= item <= 1e9):
                raise ValueError("Invalid nutrient amount.")
            if isinstance(item, str) and len(item) > 120:
                raise ValueError("Nutrient text is too long.")
        return value


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=12, max_length=128)


class RecoveryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=3, max_length=32)
    recovery_code: str = Field(min_length=20, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)
