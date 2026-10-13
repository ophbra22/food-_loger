"""Separate model observations from server-owned nutrition provenance."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from foodlogger.schemas import JournalDate, MealType

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
Mass = Annotated[float, Field(strict=True, ge=1, le=2000, allow_inf_nan=False)]
Confidence = Literal["high", "medium", "low"]
Preparation = Literal[
    "raw", "cooked", "grilled", "roasted", "fried", "boiled", "steamed", "baked", "unknown"
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class VisionFood(StrictModel):
    id: Annotated[str, StringConstraints(pattern=r"^[a-z0-9_]{1,40}$")]
    name: Text
    search_name: Text  # English identity, not an FDC id; names stay in requested language.
    preparation: Preparation
    region: Text  # Descriptive only, never claimed to be pixel-accurate localization.
    dish_type: Literal["single", "composite"]
    visible_ingredients: list[Text] = Field(max_length=15)
    estimated_weight_g: Mass
    weight_min_g: Mass
    weight_max_g: Mass
    confidence: Confidence
    alternatives: list[Text] = Field(max_length=3)
    question: ShortText | None

    @model_validator(mode="after")
    def ordered_mass(self):
        if not self.weight_min_g <= self.estimated_weight_g <= self.weight_max_g:
            raise ValueError("Weight range must contain the estimate.")
        return self


class VisionMeal(StrictModel):
    meal_name: Text
    status: Literal["food", "no_food", "uncertain"]
    foods: list[VisionFood] = Field(max_length=15)
    warnings: list[ShortText] = Field(max_length=8)

    @model_validator(mode="after")
    def consistent(self):
        if len({f.id for f in self.foods}) != len(self.foods):
            raise ValueError("Duplicate food ids.")
        if self.status == "no_food" and self.foods or self.status == "food" and not self.foods:
            raise ValueError("Food status disagrees with components.")
        return self


class AnalysisOptions(StrictModel):
    language: Literal["en", "he"] = "en"
    plate_diameter_cm: float | None = Field(default=None, ge=10, le=50, allow_inf_nan=False)
    context: str = Field(default="", max_length=500)


class Nutrients(StrictModel):
    calories: float | None = Field(default=None, ge=0, le=1000, allow_inf_nan=False)
    protein: float | None = Field(default=None, ge=0, le=100, allow_inf_nan=False)
    carbs: float | None = Field(default=None, ge=0, le=100, allow_inf_nan=False)
    fat: float | None = Field(default=None, ge=0, le=100, allow_inf_nan=False)


class ReferenceFood(StrictModel):
    id: str
    name: str
    data_type: str
    nutrition: Nutrients
    source: str = "USDA FoodData Central"
    source_url: str
    basis_unit: Literal["g"] = "g"


class AnalyzedFood(VisionFood):
    reference: ReferenceFood | None
    reference_alternatives: list[ReferenceFood]
    nutrients: dict[str, float | None]
    requires_confirmation: bool
    match_confidence: Confidence
    weight_basis: Literal["visual_estimate"] = "visual_estimate"


class AnalysisResult(StrictModel):
    schema_version: Literal[1] = 1
    analysis_id: str
    meal_name: str
    status: Literal["food", "no_food", "uncertain"]
    foods: list[AnalyzedFood]
    total: dict[str, float | None]
    complete_nutrition: bool
    overall_confidence: Confidence
    warnings: list[str]
    provider: str
    model: str
    usage: dict[str, int]
    elapsed_ms: int


class ReviewedFood(StrictModel):
    id: Annotated[str, StringConstraints(pattern=r"^[a-zA-Z0-9_-]{1,64}$")]
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    grams: Mass
    reference_id: str | None = Field(default=None, max_length=80)
    manual_nutrition: Nutrients | None = None
    confirmed: Literal[True]

    @model_validator(mode="after")
    def source(self):
        if (self.reference_id is None) == (self.manual_nutrition is None):
            raise ValueError("Choose one reference or supply manual nutrition.")
        if self.manual_nutrition and any(
            v is None for v in self.manual_nutrition.model_dump().values()
        ):
            raise ValueError("Supply all four nutrients for manual food.")
        return self


class AnalyzedMealCreate(StrictModel):
    day: JournalDate
    meal_type: MealType
    analysis_id: str = Field(max_length=64)
    foods: list[ReviewedFood] = Field(min_length=1, max_length=15)

    @model_validator(mode="after")
    def unique(self):
        if len({f.id for f in self.foods}) != len(self.foods):
            raise ValueError("Duplicate food ids.")
        return self
