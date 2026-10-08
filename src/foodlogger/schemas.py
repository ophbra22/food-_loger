import re
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field

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
