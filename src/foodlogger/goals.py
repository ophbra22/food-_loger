"""Manual goals are dated revisions; intake always comes from the existing journal."""

from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Annotated
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from foodlogger.foundation import lock_owner
from foodlogger.schemas import JournalDate
from foodlogger.storage import Journal, summarize_entries

MIGRATION = "p03-goals-v1"
FIELDS = (
    "calorie_target",
    "protein_g",
    "carbs_g",
    "fat_g",
    "water_ml",
    "target_weight_kg",
    "calorie_min_percent",
    "calorie_max_percent",
)
Positive = Annotated[float, Field(gt=0, allow_inf_nan=False, strict=True)]


class GoalValues(BaseModel):
    model_config = ConfigDict(extra="forbid")
    calorie_target: Annotated[Positive, Field(ge=1, le=10000)] | None = None
    protein_g: Annotated[Positive, Field(ge=0.1, le=500)] | None = None
    carbs_g: Annotated[Positive, Field(ge=0.1, le=1500)] | None = None
    fat_g: Annotated[Positive, Field(ge=0.1, le=500)] | None = None
    water_ml: Annotated[Positive, Field(ge=1, le=15000)] | None = None
    target_weight_kg: Annotated[Positive, Field(ge=1, le=500)] | None = None
    calorie_min_percent: Annotated[Positive, Field(ge=50, le=100)] = 90
    calorie_max_percent: Annotated[Positive, Field(ge=100, le=150)] = 110


class GoalUpdate(GoalValues):
    effective_local_date: JournalDate
    timezone_id: str = Field(min_length=1, max_length=80)
    expected_version: int = Field(ge=0, strict=True)
    allow_past: bool = Field(default=False, strict=True)

    @field_validator("timezone_id")
    @classmethod
    def valid_zone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Use an IANA timezone.") from None
        return value

    @model_validator(mode="after")
    def historical_opt_in(self):
        if (
            not self.allow_past
            and self.effective_local_date < datetime.now(ZoneInfo(self.timezone_id)).date()
        ):
            raise ValueError("Historical goal changes require explicit confirmation.")
        return self


class GoalConflict(ValueError):
    pass


def ensure_sqlite_goals(database):
    if not database.postgres:
        with database.connect() as db:
            for statement in (Path(__file__).parent / "data" / "goals.sql").read_text().split(";"):
                if statement.strip():
                    db.execute(statement)


def warnings(goal):
    kcal, p, c, f = (goal[k] for k in FIELDS[:4])
    if None not in (kcal, p, c, f):
        energy = Decimal(str(p)) * 4 + Decimal(str(c)) * 4 + Decimal(str(f)) * 9
        if abs(energy - Decimal(str(kcal))) > Decimal(str(kcal)) * Decimal("0.1"):
            return ["energy_macro_mismatch"]
    return []


def effective_goal(document, day):
    applicable = [g for g in document["revisions"] if g["effective_local_date"] <= str(day)]
    return max(applicable, key=lambda g: (g["effective_local_date"], g["version"]), default=None)


def progress(summary, goal):
    result = {}
    for key, target_key in (
        ("calories", "calorie_target"),
        ("protein", "protein_g"),
        ("carbs", "carbs_g"),
        ("fat", "fat_g"),
        ("water", "water_ml"),
    ):
        target = goal[target_key] if goal else None
        consumed = summary[key] if key != "water" else None
        known = summary["known_totals"][key] if key != "water" else None
        percent = (
            float(Decimal(str(consumed)) / Decimal(str(target)) * 100)
            if consumed is not None and target is not None
            else None
        )
        remaining = (
            float(Decimal(str(target)) - Decimal(str(consumed)))
            if consumed is not None and target is not None
            else None
        )
        if target is None:
            status = "no_goal"
        elif key == "water":
            status = "untracked"
        elif not summary["count"]:
            status = "unlogged"
        elif consumed is None:
            status = "partial"
        elif key == "calories":
            status = (
                "below_range"
                if percent < goal["calorie_min_percent"]
                else "above_range"
                if percent > goal["calorie_max_percent"]
                else "in_range"
            )
        elif key == "protein":
            status = "met" if percent >= 100 else "below_target"
        else:
            status = (
                "above_target"
                if percent > 100
                else "at_target"
                if percent == 100
                else "below_target"
            )
        result[key] = dict(
            consumed=consumed,
            known_total=known,
            target=target,
            remaining=remaining,
            percent=percent,
            status=status,
        )
    return result


class Goals:
    def __init__(self, database):
        self.database = database

    def available(self):
        with self.database.connect() as db:
            if self.database.postgres:
                exists = db.execute(
                    "SELECT to_regclass('foodlogger.user_nutrition_goal_revisions') AS name"
                ).fetchone()["name"]
            else:
                exists = db.execute(
                    "SELECT 1 FROM sqlite_master WHERE name='user_nutrition_goal_revisions'"
                ).fetchone()
            return bool(exists)

    @staticmethod
    def _document(db, owner):
        rows = db.execute(
            "SELECT * FROM user_nutrition_goal_revisions WHERE user_id=? ORDER BY version", (owner,)
        ).fetchall()
        revisions = []
        for row in rows:
            item = dict(row)
            item.pop("user_id")
            item["warnings"] = warnings(item)
            revisions.append(item)
        return {"version": revisions[-1]["version"] if revisions else 0, "revisions": revisions}

    def get(self, owner):
        with self.database.connect() as db:
            return self._document(db, owner)

    def put(self, owner, update):
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            document = self._document(db, owner)
            if update.expected_version != document["version"]:
                raise GoalConflict("Goals changed. Reload before saving again.")
            columns = ("user_id", "id", "version", "effective_local_date", "created_at", *FIELDS)
            values = (
                owner,
                uuid4().hex,
                document["version"] + 1,
                str(update.effective_local_date),
                datetime.now(UTC).isoformat(),
                *(getattr(update, k) for k in FIELDS),
            )
            db.execute(
                f"INSERT INTO user_nutrition_goal_revisions ({','.join(columns)}) "
                f"VALUES ({','.join('?' for _ in columns)})",
                values,
            )
            return self._document(db, owner)

    def daily(self, owner, day):
        # One transaction/owner lock gives goals and confirmed journal rows the same snapshot.
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            entries = [
                Journal._public(row)
                for row in db.execute(
                    "SELECT * FROM meals WHERE user_id=? AND day=? ORDER BY created_at DESC,id",
                    (owner, str(day)),
                ).fetchall()
            ]
            document = self._document(db, owner)
            summary = summarize_entries(entries)
            return {
                "day": str(day),
                "meals": entries,
                "summary": summary,
                "goals": document,
                "progress": progress(summary, effective_goal(document, day)),
                "logging_status": "logged_incomplete" if entries else "unlogged",
            }
