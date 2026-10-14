"""Reviewed, owner-scoped copies over the existing transactional journal writer."""

import json
from datetime import UTC, datetime, time
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, model_validator

from foodlogger.domain import Contract, MealDraft
from foodlogger.foundation import lock_owner
from foodlogger.library import draft_totals, snapshot_draft, table_exists
from foodlogger.meal_service import MealConflict, digest, request_hash
from foodlogger.schemas import JournalDate


class SourceSelection(Contract):
    id: str = Field(pattern=r"^[a-f0-9]{32}$")
    version: int = Field(ge=1)


class TimeChoice(Contract):
    wall_time: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$")
    fold: Literal[0, 1] | None = None


class CopyRequest(Contract):
    action: Literal["preview", "confirm"]
    source_day: JournalDate
    sources: list[SourceSelection] = Field(min_length=1, max_length=20)
    destination_date: JournalDate
    timezone_id: str = Field(min_length=1, max_length=80)
    times: dict[str, TimeChoice] = Field(default_factory=dict, max_length=20)
    confirmed: bool = False
    confirm_populated: bool = False
    preview_token: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    drafts: list[MealDraft] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def selection(self):
        ids = [s.id for s in self.sources]
        if len(ids) != len(set(ids)) or not set(self.times).issubset(ids):
            raise ValueError("Choose each source once; time choices must belong to the selection.")
        try:
            ZoneInfo(self.timezone_id)
        except (ValueError, ZoneInfoNotFoundError):
            raise ValueError("Choose a valid IANA timezone.") from None
        return self


def local_time(day, wall_time, zone, fold=None):
    """Round-trip both folds: never advance a nonexistent time or guess an overlap."""
    naive = datetime.combine(day, time.fromisoformat(wall_time))
    candidates = {}
    for f in (0, 1):
        value = naive.replace(tzinfo=zone, fold=f)
        if value.astimezone(UTC).astimezone(zone).replace(tzinfo=None) == naive:
            candidates[value.utcoffset()] = value
    if not candidates:
        return None, "nonexistent_time"
    if len(candidates) > 1 and fold is None:
        return None, "ambiguous_time"
    return naive.replace(tzinfo=zone, fold=fold or 0), None


class Copying:
    def __init__(self, meal_service):
        self.meals = meal_service
        self.database = meal_service.database

    def available(self):
        return table_exists(self.database, "library_requests")

    def _preview(self, db, owner, body):
        sources = []
        drafts, issues = [], []
        zone = ZoneInfo(body.timezone_id)
        for selected in body.sources:
            group = self.meals._group(db, selected.id, owner)
            if not group:
                raise KeyError("A selected meal no longer exists.")
            if group["version"] != selected.version or group["local_date"] != str(body.source_day):
                raise MealConflict("A selected meal changed. Prepare a new preview.")
            sources.append(group)
            choice = body.times.get(selected.id)
            wall = choice.wall_time if choice else None
            if not wall and group.get("occurred_at") and group.get("timezone_id"):
                wall = (
                    datetime.fromisoformat(group["occurred_at"])
                    .astimezone(ZoneInfo(group["timezone_id"]))
                    .strftime("%H:%M:%S")
                )
            if not wall:
                issues.append({"id": selected.id, "reason": "unknown_time"})
                continue
            occurred, issue = local_time(
                body.destination_date, wall, zone, choice.fold if choice else None
            )
            if issue:
                issues.append({"id": selected.id, "reason": issue})
                continue
            raw = snapshot_draft(group).model_dump(mode="json")
            raw.update(
                input_method="copy",
                local_date=str(body.destination_date),
                occurred_at=occurred.isoformat(),
                timezone_id=body.timezone_id,
            )
            drafts.append(MealDraft.model_validate(raw).model_dump(mode="json"))
        destination = db.execute(
            "SELECT * FROM meal_groups WHERE user_id=? AND local_date=? "
            "AND deleted_at IS NULL ORDER BY id",
            (owner, str(body.destination_date)),
        ).fetchall()
        token = digest(
            {
                "owner": owner,
                "sources": sources,
                "destination": [dict(r) for r in destination],
                "date": str(body.destination_date),
                "zone": body.timezone_id,
                "times": {k: v.model_dump() for k, v in body.times.items()},
            }
        )
        return {
            "preview_token": token,
            "destination_populated": bool(destination),
            "time_issues": issues,
            "drafts": drafts if not issues else [],
            "totals": [draft_totals(MealDraft.model_validate(d)) for d in drafts]
            if not issues
            else [],
        }

    def run(self, owner, body, key=None):
        key_hash = request_hash(owner, key) if body.action == "confirm" else None
        payload_digest = digest(body.model_dump(mode="json"))
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            if key_hash:
                receipt = db.execute(
                    "SELECT * FROM library_requests WHERE user_id=? AND request_hash=?",
                    (owner, key_hash),
                ).fetchone()
                if receipt:
                    if receipt["operation"] != "copy" or receipt["digest"] != payload_digest:
                        raise MealConflict("This copy key was already used for different content.")
                    saved = json.loads(receipt["result"])
                    groups = [self.meals._group(db, g["id"], owner) for g in saved]
                    if any(
                        g is None or g["version"] != previous["version"]
                        for g, previous in zip(groups, saved, strict=True)
                    ):
                        raise MealConflict(
                            "A copied meal changed or was deleted. Reload your journal."
                        )
                    return {"groups": groups}, False
            preview = self._preview(db, owner, body)
            if body.action == "preview":
                return preview, False
            if not body.confirmed or preview["time_issues"]:
                raise ValueError("Resolve meal times and explicitly confirm the preview.")
            if preview["preview_token"] != body.preview_token:
                raise MealConflict("The source or destination changed. Prepare a new preview.")
            if preview["destination_populated"] and not body.confirm_populated:
                raise ValueError("Confirm adding meals to a date that already contains meals.")
            if len(body.drafts) != len(preview["drafts"]):
                raise ValueError("Confirm every selected meal.")
            groups = []
            for index, (draft, original) in enumerate(
                zip(body.drafts, preview["drafts"], strict=True)
            ):
                if (
                    str(draft.local_date) != original["local_date"]
                    or draft.timezone_id != original["timezone_id"]
                    or not draft.occurred_at
                    or draft.occurred_at.isoformat() != original["occurred_at"]
                    or draft.input_method != "copy"
                ):
                    raise ValueError("Date or time changed. Prepare a new preview.")
                child_key = digest({"copy": key_hash, "index": index})
                group_id = request_hash(owner, child_key)
                rows, snapshot = self.meals._canonical_entries(draft, owner, group_id)
                source = body.sources[index]
                snapshot.update(copied_from_id=source.id, copied_from_version=source.version)
                for row in rows:
                    row["details"].update(
                        copied_from_id=source.id, copied_from_version=source.version
                    )
                self.meals._save_entries_in_transaction(
                    db,
                    rows,
                    owner,
                    child_key,
                    digest(draft.model_dump(mode="json")),
                    "copy",
                    snapshot=snapshot,
                    occurred_at=draft.occurred_at.isoformat(),
                    timezone_id=draft.timezone_id,
                )
                groups.append(self.meals._group(db, group_id, owner))
            db.execute(
                "INSERT INTO library_requests(user_id,request_hash,digest,operation,"
                "result,created_at) VALUES (?,?,?,?,?,?)",
                (
                    owner,
                    key_hash,
                    payload_digest,
                    "copy",
                    json.dumps([{"id": g["id"], "version": g["version"]} for g in groups]),
                    datetime.now(UTC).isoformat(),
                ),
            )
            return {"groups": groups}, True
