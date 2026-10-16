"""Health Connect import receipts, isolated from HealthKit and manual journal data.

Tokens and permission checks remain on device. Receipts make page replay safe;
source deletions are permanent for that UUID, including delete-before-snapshot.
"""

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated, Literal
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from pydantic import Field, model_validator

from foodlogger.domain import Contract
from foodlogger.foundation import lock_owner
from foodlogger.health import HealthSample
from foodlogger.library import table_exists
from foodlogger.meal_service import MealConflict


class ConnectSample(HealthSample):
    operation: Literal["upsert"]
    modified_at: datetime
    start_offset_seconds: int | None = Field(default=None, ge=-64800, le=64800, strict=True)
    end_offset_seconds: int | None = Field(default=None, ge=-64800, le=64800, strict=True)

    @model_validator(mode="after")
    def modified_context(self):
        if self.modified_at.tzinfo is None:
            raise ValueError("Source modification time must be timezone-aware.")
        return self


class ConnectDeletion(Contract):
    operation: Literal["delete"]
    external_id: UUID


class ConnectImport(Contract):
    events: list[Annotated[ConnectSample | ConnectDeletion, Field(discriminator="operation")]] = (
        Field(max_length=100)
    )


def ensure_sqlite_health_connect(database):
    if not database.postgres:
        with database.connect() as db:
            db.execute((Path(__file__).parent / "data/health_connect.sql").read_text())


class HealthConnect:
    def __init__(self, database):
        self.database = database

    def available(self):
        return table_exists(self.database, "health_connect_imports")

    def import_changes(self, owner, body):
        dates = set()
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            for event in body.events:
                external = str(event.external_id)
                prior = db.execute(
                    "SELECT * FROM health_connect_imports WHERE user_id=? AND external_id=?",
                    (owner, external),
                ).fetchone()
                if prior and prior["deleted"]:
                    continue
                now = datetime.now(UTC).isoformat()
                tracked = None
                if prior and prior["tracking_id"]:
                    tracked = db.execute(
                        "SELECT * FROM tracking_entries WHERE user_id=? AND id=? AND "
                        "source='health_connect' AND external_id=?",
                        (owner, prior["tracking_id"], "healthconnect:" + external),
                    ).fetchone()
                if event.operation == "delete":
                    if tracked and not tracked["deleted"]:
                        dates.add(tracked["local_date"])
                        db.execute(
                            "UPDATE tracking_entries SET deleted=1,version=version+1,updated_at=? "
                            "WHERE user_id=? AND id=?",
                            (now, owner, tracked["id"]),
                        )
                    db.execute(
                        "INSERT INTO health_connect_imports VALUES (?,?,?,?,?,?,?) "
                        "ON CONFLICT(user_id,external_id) DO UPDATE SET "
                        "deleted=1,updated_at=excluded.updated_at",
                        (owner, external, None, None, None, 1, now),
                    )
                    continue
                data = event.model_dump(mode="json")
                for key in ("start", "end", "modified_at"):
                    data[key] = (
                        getattr(event, key).astimezone(UTC).isoformat(timespec="microseconds")
                    )
                if prior:
                    previous = json.loads(prior["payload"])
                    if (previous["kind"], previous["source_bundle"]) != (
                        event.kind,
                        event.source_bundle,
                    ):
                        raise MealConflict("External sample identity changed source or type.")
                    # Health Connect exposes offsets, not an IANA zone. Keep the
                    # first journal display zone while retaining actual source offsets.
                    data["timezone_id"] = previous["timezone_id"]
                    if data["modified_at"] < prior["modified_at"]:
                        continue
                payload = json.dumps(data, sort_keys=True, separators=(",", ":"))
                if prior and data["modified_at"] == prior["modified_at"]:
                    if payload != prior["payload"]:
                        raise MealConflict("Equal source revisions have conflicting payloads.")
                    continue
                tracking_id = prior["tracking_id"] if prior else None
                if event.kind == "weight":
                    day = str(event.start.astimezone(ZoneInfo(data["timezone_id"])).date())
                    if not prior:
                        tracking_id = uuid4().hex
                        db.execute(
                            "INSERT INTO tracking_entries(user_id,id,kind,value,occurred_at,"
                            "local_date,"
                            "timezone_id,source,external_id,version,deleted,created_at,updated_at) "
                            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                            (
                                owner,
                                tracking_id,
                                "weight",
                                event.value,
                                data["start"],
                                day,
                                data["timezone_id"],
                                "health_connect",
                                "healthconnect:" + external,
                                1,
                                0,
                                now,
                                now,
                            ),
                        )
                        dates.add(day)
                    elif tracked and not tracked["deleted"]:
                        dates.update((tracked["local_date"], day))
                        db.execute(
                            "UPDATE tracking_entries SET value=?,occurred_at=?,local_date=?,"
                            "version=version+1,updated_at=? WHERE user_id=? AND id=?",
                            (event.value, data["start"], day, now, owner, tracking_id),
                        )
                    # A user-deleted/missing imported row is never recreated.
                db.execute(
                    "INSERT INTO health_connect_imports VALUES (?,?,?,?,?,?,?) "
                    "ON CONFLICT(user_id,external_id) DO UPDATE SET payload=excluded.payload,"
                    "modified_at=excluded.modified_at,updated_at=excluded.updated_at",
                    (owner, external, payload, data["modified_at"], tracking_id, 0, now),
                )
        return dict(accepted=len(body.events), weight_dates=sorted(dates))

    def imports(self, owner):
        with self.database.connect() as db:
            rows = db.execute(
                "SELECT payload FROM health_connect_imports WHERE user_id=? AND deleted=0 "
                "ORDER BY updated_at DESC,external_id LIMIT 101",
                (owner,),
            ).fetchall()
        return dict(items=[json.loads(r["payload"]) for r in rows[:100]], has_more=len(rows) > 100)
