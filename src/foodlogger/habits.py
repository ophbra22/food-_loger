"""Derived logging streaks and conservative opt-in reminder decisions.

No AI. No cached eligibility or local repeating notifications. Attempts are consumed
before delivery: uncertain sends are never retried. See p09-design.md for tradeoffs.
"""

import hashlib
import json
import time
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, StrictBool, field_validator, model_validator

from foodlogger.domain import Contract
from foodlogger.foundation import lock_owner
from foodlogger.goals import Goals, effective_goal
from foodlogger.library import table_exists
from foodlogger.meal_service import MealConflict

CATEGORIES = ("breakfast", "lunch", "dinner", "water", "evening")
LEASE_SECONDS = 900


class HabitPreferences(Contract):
    expected_version: int = Field(ge=0, strict=True)
    timezone_id: str = Field(default="UTC", max_length=80)
    language: Literal["en", "he"] = "en"
    muted: StrictBool = False
    breakfast: str | None = None
    lunch: str | None = None
    dinner: str | None = None
    water: str | None = None
    evening: str | None = None
    quiet_start: str | None = "22:00"
    quiet_end: str | None = "07:00"

    @field_validator("timezone_id")
    @classmethod
    def zone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Use an IANA timezone.") from None
        return value

    @field_validator(*CATEGORIES, "quiet_start", "quiet_end")
    @classmethod
    def clock(cls, value):
        import re

        if value is not None and not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", value):
            raise ValueError("Use HH:MM or null.")
        return value

    @model_validator(mode="after")
    def quiet_pair(self):
        if (self.quiet_start is None) != (self.quiet_end is None):
            raise ValueError("Quiet hours require both endpoints.")
        return self


class DeviceBody(Contract):
    token: str = Field(pattern=r"^(?:ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{8,180}\]$")
    platform: Literal["ios", "android"]
    ready: StrictBool
    installation_secret: str = Field(pattern=r"^[a-f0-9]{32}$")
    installation_generation: int = Field(ge=1, le=9007199254740991, strict=True)


def ensure_sqlite_habits(database):
    if not database.postgres:
        with database.connect() as db:
            for sql in (Path(__file__).parent / "data/habits.sql").read_text().split(";"):
                if sql.strip():
                    db.execute(sql)


def minute(value):
    h, m = map(int, value.split(":"))
    return h * 60 + m


def due(p, category, now):
    local = now.astimezone(ZoneInfo(p["timezone_id"]))
    clock = local.hour * 60 + local.minute
    scheduled = p[category]
    if p["muted"] or scheduled is None or not 0 <= clock - minute(scheduled) < 5:
        return False
    scheduled_local = local.replace(
        hour=minute(scheduled) // 60, minute=minute(scheduled) % 60, second=0, microsecond=0
    )
    # A wall time inside a DST gap must not catch up in the first minutes after it.
    round_trip = scheduled_local.astimezone(UTC).astimezone(local.tzinfo)
    if round_trip.replace(tzinfo=None) != scheduled_local.replace(tzinfo=None):
        return False
    if p["quiet_start"] is not None:
        start, end = minute(p["quiet_start"]), minute(p["quiet_end"])
        if start == end or (start <= clock < end if start < end else clock >= start or clock < end):
            return False
    return True


class Habits:
    def __init__(self, database):
        self.database = database

    def available(self):
        return all(
            table_exists(self.database, t)
            for t in ("reminder_preferences", "reminder_devices", "reminder_attempts")
        )

    @staticmethod
    def _preferences(db, owner):
        row = db.execute("SELECT * FROM reminder_preferences WHERE user_id=?", (owner,)).fetchone()
        if not row:
            return dict(
                version=0,
                **HabitPreferences(expected_version=0).model_dump(exclude={"expected_version"}),
            )
        body = HabitPreferences(expected_version=row["version"], **json.loads(row["body"]))
        return dict(version=row["version"], **body.model_dump(exclude={"expected_version"}))

    def preferences(self, owner):
        with self.database.connect() as db:
            return self._preferences(db, owner)

    def put_preferences(self, owner, body):
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            old = self._preferences(db, owner)
            if old["version"] != body.expected_version:
                raise MealConflict("Preferences changed. Reload before saving.")
            version = old["version"] + 1
            db.execute(
                "INSERT INTO reminder_preferences(user_id,version,body) VALUES (?,?,?) ON "
                "CONFLICT(user_id) DO UPDATE SET "
                "version=excluded.version,body=excluded.body",
                (owner, version, body.model_dump_json(exclude={"expected_version"})),
            )
            return self._preferences(db, owner)

    def streak(self, owner, today):
        with self.database.connect() as db:
            rows = db.execute(
                "SELECT DISTINCT day FROM meals WHERE user_id=? AND day<=? ORDER BY day",
                (owner, str(today)),
            ).fetchall()
        days = [date.fromisoformat(r["day"]) for r in rows]
        longest = run = 0
        last = None
        for day in days:
            run = run + 1 if last and day == last + timedelta(days=1) else 1
            longest = max(run, longest)
            last = day
        current = run if last in (today, today - timedelta(days=1)) else 0
        return dict(current=current, longest=longest, logged_days=len(days))

    def register(self, owner, session_token, body, now=None):
        now = now or datetime.now(UTC)
        session_hash = hashlib.sha256(session_token.encode("ascii")).hexdigest()
        installation_hash = hashlib.sha256(body.installation_secret.encode("ascii")).hexdigest()
        with self.database.connect() as db:
            if not self.database.postgres:
                db.execute("BEGIN IMMEDIATE")
            # Lock both account parents in stable order before moving an installation.
            rows = db.execute(
                "SELECT * FROM reminder_devices WHERE token=? OR installation_hash=?",
                (body.token, installation_hash),
            ).fetchall()
            owners = sorted({owner, *(r["user_id"] for r in rows)})
            for identity in owners:
                db.execute(
                    "SELECT id FROM users WHERE id=?"
                    + (" FOR UPDATE" if self.database.postgres else ""),
                    (identity,),
                ).fetchone()
            session = db.execute(
                "SELECT 1 FROM sessions WHERE user_id=? AND token_hash=? AND expires_at>?",
                (owner, session_hash, int(now.timestamp())),
            ).fetchone()
            if not session:
                raise ValueError("Session expired.")
            rows = db.execute(
                "SELECT * FROM reminder_devices WHERE token=? OR installation_hash=?",
                (body.token, installation_hash),
            ).fetchall()
            for existing in rows:
                if (
                    existing["user_id"] not in owners
                    or existing["installation_hash"] != installation_hash
                ):
                    raise MealConflict("Device ownership could not be verified.")
                same_session = (
                    existing["user_id"] == owner and existing["session_hash"] == session_hash
                )
                generation = body.installation_generation
                if generation < existing["installation_generation"] or (
                    not same_session and generation == existing["installation_generation"]
                ):
                    raise MealConflict("Device registration was superseded. Refresh this session.")
            db.execute(
                "DELETE FROM reminder_devices WHERE installation_hash=? "
                "OR (user_id=? AND session_hash=?)",
                (installation_hash, owner, session_hash),
            )
            count = db.execute(
                "SELECT COUNT(*) AS n FROM reminder_devices WHERE user_id=?", (owner,)
            ).fetchone()["n"]
            if count >= 5:
                raise ValueError("Device limit reached. Sign out another device.")
            db.execute(
                "INSERT INTO reminder_devices(token,user_id,session_hash,platform,ready,checked_at,"
                "installation_hash,installation_generation) VALUES (?,?,?,?,?,?,?,?)",
                (
                    body.token,
                    owner,
                    session_hash,
                    body.platform,
                    int(body.ready),
                    int(now.timestamp()),
                    installation_hash,
                    body.installation_generation,
                ),
            )
        return {"registered": True, "lease_seconds": LEASE_SECONDS}

    def unregister(self, owner, session_token):
        session_hash = hashlib.sha256(session_token.encode("ascii")).hexdigest()
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            db.execute(
                "DELETE FROM reminder_devices WHERE user_id=? AND session_hash=?",
                (owner, session_hash),
            )

    def pause(self, owner, session_token):
        session_hash = hashlib.sha256(session_token.encode("ascii")).hexdigest()
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            db.execute(
                "UPDATE reminder_devices SET ready=0 WHERE user_id=? AND session_hash=?",
                (owner, session_hash),
            )

    def _eligible(self, db, owner, category, now):
        p = self._preferences(db, owner)
        if category not in CATEGORIES or not due(p, category, now):
            return None
        day = str(now.astimezone(ZoneInfo(p["timezone_id"])).date())
        stamp = int(now.timestamp())
        devices = db.execute(
            "SELECT d.*,s.expires_at AS session_expires_at FROM reminder_devices d JOIN sessions s "
            "ON s.token_hash=d.session_hash AND s.user_id=d.user_id "
            "WHERE d.user_id=? AND s.expires_at>? ORDER BY d.checked_at DESC,d.token",
            (owner, stamp),
        ).fetchall()
        if not devices or any(
            not d["ready"] or not stamp - LEASE_SECONDS <= d["checked_at"] <= stamp for d in devices
        ):
            return None
        device = dict(devices[0])
        device["eligible_until"] = min(
            min(d["checked_at"] + LEASE_SECONDS, d["session_expires_at"]) for d in devices
        )
        rows = db.execute(
            "SELECT meal_type FROM meals WHERE user_id=? AND day=?", (owner, day)
        ).fetchall()
        if category in CATEGORIES[:3] and any(r["meal_type"] == category for r in rows):
            return None
        if category == "evening" and not rows:
            return None
        if category == "water":
            goal = effective_goal(Goals._document(db, owner), day)
            if not goal or not goal["water_ml"]:
                return None
            water = db.execute(
                "SELECT COALESCE(SUM(value),0) AS n FROM tracking_entries WHERE user_id=? "
                "AND local_date=? AND kind='water' AND deleted=0",
                (owner, day),
            ).fetchone()["n"]
            if water >= goal["water_ml"]:
                return None
        return p, day, dict(device)

    def dispatch(self, owner, category, sender, now=None):
        started = time.monotonic()
        now = now or datetime.now(UTC)
        if now.tzinfo is None:
            return "suppressed"
        try:
            # Commit a durable at-most-once claim before handing anything to transport.
            with self.database.connect() as db:
                lock_owner(self.database, db, owner)
                state = self._eligible(db, owner, category, now)
                if not state:
                    return "suppressed"
                p, day, device = state
                previous = db.execute(
                    "SELECT 1 FROM reminder_attempts WHERE user_id=? AND category=? AND "
                    "(local_date=? OR attempted_at>?)",
                    (owner, category, day, int(now.timestamp()) - 72000),
                ).fetchone()
                if previous:
                    return "suppressed"
                db.execute(
                    "INSERT INTO reminder_attempts VALUES (?,?,?,?)",
                    (owner, day, category, int(now.timestamp())),
                )
            # Fresh authoritative query after claim; owner lock serializes all log edits.
            with self.database.connect() as db:
                lock_owner(self.database, db, owner)
                elapsed = time.monotonic() - started
                if elapsed > 5:
                    return "suppressed"
                fresh = self._eligible(db, owner, category, now + timedelta(seconds=elapsed))
                if not fresh or fresh[0] != p or fresh[2] != device:
                    return "suppressed"
                text = (
                    "פתחו את BiteFlow לעיון ביומן."
                    if p["language"] == "he"
                    else "Open BiteFlow to review your diary."
                )
                elapsed = time.monotonic() - started
                final_now = now + timedelta(seconds=elapsed)
                if (
                    elapsed > 5
                    or not due(p, category, final_now)
                    or str(final_now.astimezone(ZoneInfo(p["timezone_id"])).date()) != day
                    or final_now.timestamp() >= device["eligible_until"]
                ):
                    return "suppressed"
                try:
                    result = sender(
                        dict(
                            to=device["token"],
                            title="BiteFlow",
                            body=text,
                            ttl=0,
                            channelId="biteflow-reminders",
                            data={"kind": "biteflow-reminder", "category": category},
                        )
                    )
                    if result == "DeviceNotRegistered":
                        db.execute(
                            "DELETE FROM reminder_devices WHERE user_id=? AND token=?",
                            (owner, device["token"]),
                        )
                        return "suppressed"
                except Exception:
                    return "uncertain"
            return "sent"
        except Exception:
            # Unknown DB/zone/session/permission/progress state must not send.
            return "suppressed"

    def tick(self, sender, now=None, *, enabled=False):
        counts = dict(sent=0, uncertain=0, suppressed=0)
        if not enabled:
            return counts
        with self.database.connect() as db:
            owners = [
                r["user_id"]
                for r in db.execute(
                    "SELECT user_id FROM reminder_preferences ORDER BY user_id"
                ).fetchall()
            ]
        for owner in owners:
            for category in CATEGORIES:
                counts[self.dispatch(owner, category, sender, now)] += 1
        return counts
