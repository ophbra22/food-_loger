"""Private measurements. Meal beverages never write to this independent journal."""

import hashlib
import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Literal
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, model_validator

from foodlogger.foundation import lock_owner
from foodlogger.schemas import JournalDate

Kind = Literal["water", "weight"]


class TrackingBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    value: float = Field(ge=0.1, le=15000, strict=True, allow_inf_nan=False)
    occurred_at: datetime
    local_date: JournalDate
    timezone_id: str = Field(min_length=1, max_length=80)
    source: Literal["manual", "apple_health", "health_connect"] = "manual"
    external_id: str | None = Field(default=None, min_length=1, max_length=200)

    @model_validator(mode="after")
    def context(self):
        try:
            zone = ZoneInfo(self.timezone_id)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Use an IANA timezone.") from None
        if (
            self.occurred_at.tzinfo is None
            or self.occurred_at.utcoffset() != self.occurred_at.astimezone(zone).utcoffset()
        ):
            raise ValueError("Timestamp offset must match the timezone.")
        if self.occurred_at.astimezone(zone).date() != self.local_date:
            raise ValueError("Timestamp must belong to the local date.")
        if (self.source == "manual") != (self.external_id is None):
            raise ValueError(
                "Imported records require an external identity; manual records cannot claim one."
            )
        return self


class TrackingPatch(TrackingBody):
    expected_version: int = Field(ge=1, strict=True)


class TrackingConflict(ValueError):
    pass


def ensure_sqlite_tracking(database):
    if not database.postgres:
        with database.connect() as db:
            for statement in (
                (Path(__file__).parent / "data" / "tracking.sql").read_text().split(";")
            ):
                if statement.strip():
                    db.execute(statement)


def date_range(start, end):
    if not 0 <= (end - start).days <= 30:
        raise ValueError("Choose an inclusive range of 1–31 days.")


def total(rows):
    return float(sum((Decimal(str(r["value"])) for r in rows), Decimal(0)))


class Tracking:
    def __init__(self, database):
        self.database = database

    def available(self):
        with self.database.connect() as db:
            if self.database.postgres:
                return bool(
                    db.execute(
                        "SELECT to_regclass('foodlogger.tracking_receipts') AS name"
                    ).fetchone()["name"]
                )
            return bool(
                db.execute("SELECT 1 FROM sqlite_master WHERE name='tracking_receipts'").fetchone()
            )

    @staticmethod
    def public(row):
        return {k: v for k, v in dict(row).items() if k not in ("user_id", "deleted")}

    @staticmethod
    def values(kind, body):
        if kind == "weight" and not 1 <= body.value <= 500:
            raise ValueError("Weight must be between 1 and 500 kg.")
        values = body.model_dump(mode="json", exclude={"expected_version"})
        # Fixed UTC representation makes text ordering chronological across offsets and DST.
        values["occurred_at"] = body.occurred_at.astimezone(UTC).isoformat(timespec="microseconds")
        return values

    def create(self, owner, kind, body, key):
        values = self.values(kind, body)
        digest = hashlib.sha256(json.dumps([kind, values], sort_keys=True).encode()).hexdigest()
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            receipt = db.execute(
                "SELECT * FROM tracking_receipts WHERE user_id=? AND request_key=?", (owner, key)
            ).fetchone()
            if receipt:
                if receipt["request_hash"] != digest:
                    raise TrackingConflict("Retry key belongs to a different request.")
                row = self._get(db, owner, kind, receipt["entry_id"], include_deleted=True)
                if row["deleted"]:
                    raise TrackingConflict(
                        "This entry was deleted. Start a new entry to log again."
                    )
                return self.public(row), False
            existing = None
            if body.external_id:
                existing = db.execute(
                    "SELECT * FROM tracking_entries WHERE user_id=? AND kind=? AND source=? AND external_id=?",
                    (owner, kind, body.source, body.external_id),
                ).fetchone()
                if existing and (
                    existing["deleted"] or any(existing[k] != v for k, v in values.items())
                ):
                    raise TrackingConflict(
                        "External measurement already exists with different values or is deleted."
                    )
            now = datetime.now(UTC).isoformat()
            row = (
                dict(existing)
                if existing
                else dict(
                    user_id=owner,
                    id=uuid4().hex,
                    kind=kind,
                    **values,
                    version=1,
                    deleted=0,
                    created_at=now,
                    updated_at=now,
                )
            )
            if not existing:
                columns = list(row)
                db.execute(
                    f"INSERT INTO tracking_entries ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)})",
                    tuple(row.values()),
                )
            db.execute(
                "INSERT INTO tracking_receipts(user_id,request_key,request_hash,entry_id) VALUES (?,?,?,?)",
                (owner, key, digest, row["id"]),
            )
            return self.public(row), not bool(existing)

    @staticmethod
    def _get(db, owner, kind, identity, include_deleted=False):
        row = db.execute(
            "SELECT * FROM tracking_entries WHERE user_id=? AND kind=? AND id=?",
            (owner, kind, identity),
        ).fetchone()
        if not row or (row["deleted"] and not include_deleted):
            raise KeyError("Measurement not found.")
        return row

    def patch(self, owner, kind, identity, body):
        values = self.values(kind, body)
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            row = self._get(db, owner, kind, identity)
            if row["source"] != body.source or row["external_id"] != body.external_id:
                raise TrackingConflict("Measurement provenance cannot be changed.")
            if row["version"] != body.expected_version:
                if row["version"] == body.expected_version + 1 and all(
                    row[k] == v for k, v in values.items()
                ):
                    return self.public(row)
                raise TrackingConflict("Measurement changed. Reload before editing.")
            values.update(version=row["version"] + 1, updated_at=datetime.now(UTC).isoformat())
            db.execute(
                f"UPDATE tracking_entries SET {','.join(k + '=?' for k in values)} WHERE user_id=? AND id=?",
                (*values.values(), owner, identity),
            )
            return self.public(self._get(db, owner, kind, identity))

    def delete(self, owner, kind, identity, version):
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            row = self._get(db, owner, kind, identity, include_deleted=True)
            if row["deleted"] and row["version"] == version + 1:
                return
            if row["deleted"] or row["version"] != version:
                raise TrackingConflict("Measurement changed. Reload before deleting.")
            db.execute(
                "UPDATE tracking_entries SET deleted=1,version=version+1,updated_at=? WHERE user_id=? AND id=?",
                (datetime.now(UTC).isoformat(), owner, identity),
            )

    def list(self, owner, kind, start, end, limit=100, offset=0):
        date_range(start, end)
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            params = (owner, kind, str(start), str(end))
            where = "user_id=? AND kind=? AND deleted=0 AND local_date BETWEEN ? AND ?"
            rows = db.execute(
                "SELECT * FROM tracking_entries WHERE "
                + where
                + " ORDER BY occurred_at DESC,id DESC LIMIT ? OFFSET ?",
                (*params, limit + 1, offset),
            ).fetchall()
            # Sum only scalar values, not every full row, even for an exported page.
            values = db.execute(
                "SELECT value FROM tracking_entries WHERE " + where, params
            ).fetchall()
            latest = db.execute(
                "SELECT * FROM tracking_entries WHERE user_id=? AND kind=? AND deleted=0 ORDER BY occurred_at DESC,id DESC LIMIT 2",
                (owner, kind),
            ).fetchall()
            return dict(
                items=[self.public(r) for r in rows[:limit]],
                has_more=len(rows) > limit,
                total=total(values) if kind == "water" else None,
                latest=self.public(latest[0]) if latest else None,
                previous=self.public(latest[1]) if len(latest) > 1 else None,
                delta=float(Decimal(str(latest[0]["value"])) - Decimal(str(latest[1]["value"])))
                if len(latest) > 1
                else None,
                **{"from": str(start), "to": str(end)},
            )
