from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

Portion = Annotated[float, Field(ge=1, le=2000, allow_inf_nan=False)]
MealType = Literal["breakfast", "lunch", "dinner", "snack"]


class MealCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    food_id: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9_]+$")
    grams: Portion
    day: date
    meal_type: MealType
