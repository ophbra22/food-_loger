"""Private, durable Health export revisions and imported sample provenance.

No provider calls. Reconciliation is explicit, owner-locked and bounded; unknown
values/timestamps are withheld. HealthKit permissions and data stay device-side.
"""

import json
import math
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, model_validator

from foodlogger.domain import Contract
from foodlogger.foundation import lock_owner
from foodlogger.library import table_exists
from foodlogger.meal_service import MealConflict

KINDS = {"calories": "kcal", "protein": "g", "carbs": "g", "fat": "g", "water": "ml"}
MAX_RECORDS = 10000
APP_BUNDLE = "io.github.ophbra22.foodlogger"


class HealthSample(Contract):
    external_id: UUID
    kind: Literal["weight", "steps"]
    value: float = Field(ge=0, le=1000000, allow_inf_nan=False, strict=True)
    start: datetime
    end: datetime
    source_bundle: str = Field(min_length=1, max_length=200, pattern=r"^[A-Za-z0-9_.-]+$")
    timezone_id: str = Field(default="UTC", max_length=80)

    @model_validator(mode="after")
    def context(self):
        try:
            ZoneInfo(self.timezone_id)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Use an IANA timezone.") from None
        if self.start.tzinfo is None or self.end.tzinfo is None or self.end < self.start:
            raise ValueError("Use ordered, timezone-aware sample timestamps.")
        if self.source_bundle == APP_BUNDLE:
            raise ValueError("BiteFlow samples cannot be imported.")
        if self.kind == "weight" and not 1 <= self.value <= 500:
            raise ValueError("Weight must be 1–500 kg.")
        if self.kind == "steps" and not self.value.is_integer():
            raise ValueError("Step samples require a whole count.")
        return self


class HealthImport(Contract):
    samples: list[HealthSample] = Field(max_length=100)


def ensure_sqlite_health(database):
    if not database.postgres:
        with database.connect() as db:
            for sql in (Path(__file__).parent / "data/health.sql").read_text().split(";"):
                if sql.strip():
                    db.execute(sql)


class Health:
    def __init__(self, database):
        self.database = database

    def available(self):
        return all(
            table_exists(self.database, t)
            for t in ("health_scopes", "health_exports", "health_imports")
        )

    @staticmethod
    def _stamp(stamp, zone, day):
        value = datetime.fromisoformat(stamp)
        if value.tzinfo is None or str(value.astimezone(ZoneInfo(zone)).date()) != day:
            raise ValueError("Unknown original timestamp.")
        return value.astimezone(UTC).isoformat()

    def reconcile(self, owner):
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            db.execute(
                "INSERT INTO health_scopes VALUES (?,?) ON CONFLICT(user_id) DO NOTHING",
                (owner, uuid4().hex),
            )
            scope = db.execute(
                "SELECT scope FROM health_scopes WHERE user_id=?", (owner,)
            ).fetchone()["scope"]
            meals = db.execute(
                "SELECT * FROM meals WHERE user_id=? LIMIT ?", (owner, MAX_RECORDS + 1)
            ).fetchall()
            water = db.execute(
                "SELECT * FROM tracking_entries WHERE user_id=? AND kind='water' AND "
                "source='manual' AND deleted=0 LIMIT ?",
                (owner, MAX_RECORDS + 1),
            ).fetchall()
            old = db.execute(
                "SELECT * FROM health_exports WHERE user_id=? ORDER BY record_key LIMIT ?",
                (owner, MAX_RECORDS + 1),
            ).fetchall()
            if max(len(meals), len(water), len(old)) > MAX_RECORDS:
                raise ValueError("Health history exceeds the local reconciliation limit.")
            desired = {}
            withheld = 0
            for row in meals:
                try:
                    details = json.loads(row["details"])
                    stamp = self._stamp(
                        details.get("occurred_at"), details.get("timezone_id"), row["day"]
                    )
                    for kind in ("calories", "protein", "carbs", "fat"):
                        value = row[kind]
                        if value is not None and math.isfinite(value) and value >= 0:
                            key = f"meal:{row['id']}:{kind}"
                            desired[key] = dict(
                                kind=kind,
                                unit=KINDS[kind],
                                value=value,
                                start=stamp,
                                end=stamp,
                                local_date=row["day"],
                                timezone_id=details["timezone_id"],
                                provenance="user_confirmed_unverified",
                                deleted=False,
                            )
                except (ValueError, TypeError, KeyError, AttributeError):
                    withheld += 1
            for row in water:
                stamp = self._stamp(row["occurred_at"], row["timezone_id"], row["local_date"])
                desired[f"water:{row['id']}"] = dict(
                    kind="water",
                    unit="ml",
                    value=row["value"],
                    start=stamp,
                    end=stamp,
                    local_date=row["local_date"],
                    timezone_id=row["timezone_id"],
                    provenance="user_entered",
                    deleted=False,
                )
            previous = {r["record_key"]: r for r in old}
            for key, row in previous.items():
                if key not in desired:
                    desired[key] = {**json.loads(row["payload"]), "deleted": True, "value": None}
            if len(desired) > MAX_RECORDS:
                raise ValueError("Health history exceeds the local reconciliation limit.")
            items = []
            for key, body in sorted(desired.items()):
                payload = json.dumps(body, sort_keys=True, separators=(",", ":"))
                before = previous.get(key)
                revision = (before["revision"] + (payload != before["payload"])) if before else 1
                identity = before["sample_id"] if before else uuid4().hex
                if not before or payload != before["payload"]:
                    db.execute(
                        "INSERT INTO health_exports VALUES (?,?,?,?,?) ON "
                        "CONFLICT(user_id,record_key) DO UPDATE SET "
                        "revision=excluded.revision,payload=excluded.payload",
                        (owner, key, identity, revision, payload),
                    )
                items.append(dict(id=identity, record_key=key, revision=revision, **body))
            return dict(scope=scope, items=items, withheld=withheld)

    def import_samples(self, owner, body):
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            for sample in body.samples:
                data = sample.model_dump(mode="json")
                data["start"] = sample.start.astimezone(UTC).isoformat()
                data["end"] = sample.end.astimezone(UTC).isoformat()
                external = str(sample.external_id)
                payload = json.dumps(data, sort_keys=True, separators=(",", ":"))
                prior = db.execute(
                    "SELECT payload FROM health_imports WHERE user_id=? AND external_id=?",
                    (owner, external),
                ).fetchone()
                if prior:
                    if prior["payload"] != payload:
                        raise MealConflict(
                            "External sample changed. Review instead of overwriting."
                        )
                    continue
                now = datetime.now(UTC).isoformat()
                db.execute(
                    "INSERT INTO health_imports VALUES (?,?,?,?)", (owner, external, payload, now)
                )
                if sample.kind == "weight":
                    identity = "healthkit:" + external
                    existing = db.execute(
                        "SELECT id FROM tracking_entries WHERE user_id=? AND kind='weight' AND "
                        "source='apple_health' AND external_id=?",
                        (owner, identity),
                    ).fetchone()
                    if existing:
                        raise MealConflict("An imported weight already uses this identity.")
                    db.execute(
                        "INSERT INTO tracking_entries(user_id,id,kind,value,occurred_at,local_date,"
                        "timezone_id,source,external_id,version,deleted,created_at,updated_at) "
                        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (
                            owner,
                            uuid4().hex,
                            "weight",
                            sample.value,
                            sample.start.astimezone(UTC).isoformat(timespec="microseconds"),
                            str(sample.start.astimezone(ZoneInfo(sample.timezone_id)).date()),
                            sample.timezone_id,
                            "apple_health",
                            identity,
                            1,
                            0,
                            now,
                            now,
                        ),
                    )
            return dict(accepted=len(body.samples))

    def imports(self, owner):
        with self.database.connect() as db:
            rows = db.execute(
                "SELECT payload FROM health_imports WHERE user_id=? ORDER BY created_at "
                "DESC,external_id LIMIT 101",
                (owner,),
            ).fetchall()
        return dict(items=[json.loads(r["payload"]) for r in rows[:100]], has_more=len(rows) > 100)
