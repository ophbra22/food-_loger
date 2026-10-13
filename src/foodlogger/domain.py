"""Canonical v2 contracts; legacy journal snapshots remain authoritative."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, model_validator

from foodlogger.schemas import JournalDate, MealType

Amount = Annotated[
    Decimal,
    Field(ge=0, le=100000, allow_inf_nan=False),
    PlainSerializer(float, return_type=float, when_used="json"),
]
Mass = Annotated[Amount, Field(le=100)]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", validate_assignment=True)


class FoodReference(Contract):
    provider: str = Field(min_length=1, max_length=80)
    reference_id: str | None = Field(default=None, max_length=160)
    version: str | None = Field(default=None, max_length=80)
    name_he: str | None = Field(default=None, max_length=120)
    name_en: str | None = Field(default=None, max_length=120)
    brand: str | None = Field(default=None, max_length=300)
    barcode: str | None = Field(default=None, max_length=14)
    verified_status: Literal["verified", "user_confirmed", "estimated", "legacy_unknown"] = (
        "estimated"
    )
    last_verified_at: datetime | None = None


class NutritionPer100(Contract):
    basis: Literal["g", "ml"]
    energy_kcal: Annotated[Amount, Field(le=1000)] | None = None
    protein_g: Mass | None = None
    carbs_g: Mass | None = None
    fat_g: Mass | None = None
    fiber_g: Mass | None = None
    sugars_g: Mass | None = None
    saturated_fat_g: Mass | None = None
    sodium_mg: Amount | None = None


NUTRIENT_FIELDS = tuple(k for k in NutritionPer100.model_fields if k != "basis")
CORE_FIELDS = ("energy_kcal", "protein_g", "carbs_g", "fat_g")
LEGACY_NUTRIENTS = dict(
    zip(
        ("calories", "protein", "carbs", "fat", "fiber", "sugars", "saturated_fat", "sodium"),
        NUTRIENT_FIELDS,
        strict=True,
    )
)


class Portion(Contract):
    quantity: Annotated[Amount, Field(gt=0)]
    unit: str = Field(min_length=1, max_length=40)
    normalized_g: Annotated[Amount, Field(gt=0)] | None = None
    normalized_ml: Annotated[Amount, Field(gt=0)] | None = None
    food_specific_conversion_id: str | None = Field(default=None, max_length=160)
    estimated: bool = False

    @model_validator(mode="after")
    def one_basis(self):
        if self.normalized_g is not None and self.normalized_ml is not None:
            raise ValueError(
                "Use one normalized basis; convert explicitly with food-specific density."
            )
        return self


class LabelMetadata(Contract):
    barcode: str = Field(max_length=14)
    brand: str | None = Field(default=None, max_length=300)
    quantity: str | None = Field(default=None, max_length=240)
    servingQuantity: Amount | None = None
    sourceUrl: str = Field(max_length=2048)
    missingAtLookup: list[Annotated[str, Field(max_length=80)]] = Field(max_length=20)
    notes: list[Annotated[str, Field(max_length=240)]] = Field(max_length=30)
    rawNutriments: dict[str, str | float | None] = Field(max_length=256)


class MealDraftItem(Contract):
    id: str = Field(min_length=1, max_length=64)
    display_name: str = Field(min_length=1, max_length=120, pattern=r"^[^\x00-\x1f]+$")
    portion: Portion
    nutrition_per_100: NutritionPer100
    source: FoodReference
    label_metadata: LabelMetadata | None = None
    confidence: Literal["high", "medium", "low"] | None = None
    warnings: list[Annotated[str, Field(max_length=240)]] = Field(
        default_factory=list, max_length=30
    )
    manual_override: bool = False


class MealDraft(Contract):
    schema_version: Literal["2"] = "2"
    calculation_version: Literal["exact-v1"] = "exact-v1"
    input_method: Literal[
        "image",
        "barcode",
        "manual",
        "catalog",
        "text",
        "voice",
        "label",
        "recipe",
        "repeat",
        "copy",
    ]
    status: Literal["draft"] = "draft"
    occurred_at: datetime | None = None
    timezone_id: str | None = Field(default=None, max_length=80)
    local_date: JournalDate
    meal_category: MealType
    items: list[MealDraftItem] = Field(min_length=1, max_length=15)
    warnings: list[Annotated[str, Field(max_length=240)]] = Field(
        default_factory=list, max_length=30
    )

    @model_validator(mode="after")
    def validate_context(self):
        if len({item.id for item in self.items}) != len(self.items):
            raise ValueError("Item identities must be unique.")
        if (self.occurred_at is None) != (self.timezone_id is None):
            raise ValueError("Timestamp and timezone must be supplied together.")
        if self.occurred_at is not None:
            try:
                zone = ZoneInfo(self.timezone_id)
            except (ZoneInfoNotFoundError, ValueError):
                raise ValueError("Use an IANA timezone.") from None
            instant = self.occurred_at
            if (
                instant.tzinfo is None
                or instant.utcoffset() != instant.astimezone(zone).utcoffset()
            ):
                raise ValueError("Timestamp offset must match the timezone at that instant.")
            if instant.astimezone(zone).date() != self.local_date:
                raise ValueError("Timestamp must belong to the assigned local date.")
        return self


def adapt_legacy_draft(entry: dict) -> MealDraft:
    """Only adapt recorded facts. Never infer eaten-at time or missing provenance."""
    details = entry.get("details", {})
    basis = details.get("basis_unit", "g")
    raw = details.get("nutrition_per100", {})
    values = {new: raw.get(old) for old, new in LEGACY_NUTRIENTS.items()}
    if values["sodium_mg"] is not None:
        values["sodium_mg"] = Decimal(str(values["sodium_mg"])) * 1000
    return MealDraft(
        input_method="manual",
        local_date=entry["day"],
        meal_category=entry["meal_type"],
        warnings=["legacy_time_unknown", "historical_totals_preserved"],
        items=[
            MealDraftItem(
                id=entry["id"],
                display_name=entry["name"],
                portion=Portion(
                    quantity=entry["grams"], unit=basis, **{"normalized_" + basis: entry["grams"]}
                ),
                nutrition_per_100=NutritionPer100(basis=basis, **values),
                source=FoodReference(provider="legacy", verified_status="legacy_unknown"),
            )
        ],
    )


class MealLogCreate(MealDraft):
    confirmed: Literal[True]


class MealLogPatch(Contract):
    draft: MealDraft
    expected_version: int = Field(ge=1)
    confirmed: Literal[True]
