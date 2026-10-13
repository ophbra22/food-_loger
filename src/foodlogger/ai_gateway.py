"""Fail-closed, transaction-backed reservations around each actual provider attempt.

Only the application gateway's traffic is bounded. Policies require independently
verified provider allowances and a conservative per-attempt input token bound.
No prompt, image, response or food text is stored in this accounting ledger.
"""

import hashlib
import re
import time
from contextlib import contextmanager
from datetime import datetime
from typing import Literal
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from foodlogger.vision import VisionQuotaExceeded, VisionUnavailable

FEATURES = ("photo", "text", "voice", "ocr", "insight", "recommendation")


class BudgetPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid", validate_assignment=True)
    project_id: str = Field(min_length=1, max_length=160, pattern=r"^[A-Za-z0-9_-]+$")
    provider: Literal["gemini-free"] = "gemini-free"
    model: Literal["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.8-flash"]
    enabled: bool = False
    verified_at: AwareDatetime | None = None
    verification_ttl_seconds: int = Field(default=604800, ge=1, le=2592000)
    reset_timezone: str = "America/Los_Angeles"
    daily_limit: int = Field(ge=0, le=1000000)
    rpm: int = Field(ge=0, le=100000)
    input_tpm: int = Field(ge=0, le=100000000)
    max_input_tokens: int = Field(ge=1, le=10000000)
    photo_reserve: int = Field(ge=0, le=1000000)
    user_daily_limit: int = Field(ge=0, le=1000000)
    feature_daily_limits: dict[str, int] = Field(default_factory=dict, max_length=6)

    @model_validator(mode="after")
    def valid_limits(self):
        if self.photo_reserve > self.daily_limit:
            raise ValueError("Photo reserve exceeds the daily allowance.")
        if any(
            key not in FEATURES or type(value) is not int or not 0 <= value <= self.daily_limit
            for key, value in self.feature_daily_limits.items()
        ):
            raise ValueError("Feature limits must be within the daily allowance.")
        try:
            ZoneInfo(self.reset_timezone)
        except (ValueError, ZoneInfoNotFoundError):
            raise ValueError("Use an IANA reset timezone.") from None
        return self


class AIGateway:
    def __init__(self, database, project_id, *, enabled=False, now=time.time):
        self.database = database
        self.project_id = project_id
        self.enabled = enabled
        self.now = now

    def available(self):
        with self.database.connect() as db:
            if self.database.postgres:
                return bool(
                    db.execute("SELECT to_regclass('foodlogger.ai_projects') AS name").fetchone()[
                        "name"
                    ]
                )
            return bool(
                db.execute("SELECT 1 FROM sqlite_master WHERE name='ai_projects'").fetchone()
            )

    def configure(self, policy: BudgetPolicy):
        """Operator-side setup only, never callable by an application user or model."""
        if policy.project_id != self.project_id:
            raise ValueError("Policy belongs to another project.")
        with self.database.connect() as db:
            db.execute(
                "INSERT INTO ai_projects(id,policy) VALUES (?,?) "
                "ON CONFLICT(id) DO UPDATE SET policy=excluded.policy,"
                "revision=ai_projects.revision+1",
                (self.project_id, policy.model_dump_json()),
            )

    def _policy(self, db, lock=False):
        if lock and not self.database.postgres:
            db.execute("BEGIN IMMEDIATE")
        row = db.execute(
            "SELECT policy FROM ai_projects WHERE id=?"
            + (" FOR UPDATE" if lock and self.database.postgres else ""),
            (self.project_id,),
        ).fetchone()
        if not row:
            raise VisionUnavailable("AI policy is not configured. Use manual entry.")
        return BudgetPolicy.model_validate_json(row["policy"])

    def policy(self):
        with self.database.connect() as db:
            return self._policy(db)

    def _ready(self, policy, now):
        age = now - policy.verified_at.timestamp() if policy.verified_at else None
        if (
            not self.enabled
            or not policy.enabled
            or age is None
            or not 0 <= age <= policy.verification_ttl_seconds
        ):
            raise VisionUnavailable(
                "AI allowance is not verified or AI is disabled. Use manual entry."
            )

    @staticmethod
    def _hash(owner, key):
        if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z0-9_-]{16,64}", key):
            raise ValueError("Invalid AI request key.")
        return hashlib.sha256(f"{owner}:{key}".encode()).hexdigest()

    def reserve(self, owner, feature, key, payload_digest, attempt):
        if (
            feature not in FEATURES
            or attempt not in (0, 1)
            or not re.fullmatch(r"[a-f0-9]{64}", payload_digest)
        ):
            raise ValueError("Invalid reservation metadata.")
        if not self.available():
            raise VisionUnavailable("AI ledger needs setup. Use manual entry.")
        key_hash = self._hash(owner, key)
        now = int(self.now())
        with self.database.connect() as db:
            policy = self._policy(db, lock=True)
            self._ready(policy, self.now())
            previous = db.execute(
                "SELECT * FROM ai_attempts WHERE project_id=? AND request_hash=? ORDER BY attempt",
                (self.project_id, key_hash),
            ).fetchall()
            if previous:
                if any(
                    row["payload_digest"] != payload_digest
                    or row["feature"] != feature
                    or row["model"] != policy.model
                    for row in previous
                ):
                    raise ValueError("This analysis key was used for different content.")
                if any(row["attempt"] == attempt for row in previous):
                    raise VisionUnavailable(
                        "Analysis was already attempted. "
                        "Reuse its cached result or start a new request."
                    )
            if attempt and (not previous or previous[-1]["state"] not in ("consumed", "uncertain")):
                raise VisionUnavailable("A retry needs a recorded prior provider attempt.")
            day = datetime.fromtimestamp(now, ZoneInfo(policy.reset_timezone)).date().isoformat()
            rows = db.execute(
                "SELECT * FROM ai_attempts WHERE project_id=? AND state!='released' "
                "AND (provider_day=? OR started_at>?)",
                (self.project_id, day, now - 60),
            ).fetchall()
            today = [row for row in rows if row["provider_day"] == day]
            minute = [row for row in rows if row["started_at"] > now - 60]
            total = len(today)
            feature_count = sum(row["feature"] == feature for row in today)
            owner_count = sum(row["user_id"] == owner for row in today)
            nonphoto = sum(row["feature"] != "photo" for row in today)
            token_count = sum(
                max(row["reserved_tokens"], row["input_tokens"] or 0) for row in minute
            )
            if (
                total >= policy.daily_limit
                or feature_count >= policy.feature_daily_limits.get(feature, 0)
                or owner_count >= policy.user_daily_limit
                or len(minute) >= policy.rpm
                or token_count + policy.max_input_tokens > policy.input_tpm
                or (feature != "photo" and nonphoto >= policy.daily_limit - policy.photo_reserve)
            ):
                raise VisionQuotaExceeded(
                    "AI allowance is exhausted. Use manual entry or try later."
                )
            identity = uuid4().hex
            db.execute(
                "INSERT INTO ai_attempts(id,project_id,user_id,request_hash,payload_digest,attempt,"
                "feature,provider,model,provider_day,started_at,reserved_tokens,state) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    identity,
                    self.project_id,
                    owner,
                    key_hash,
                    payload_digest,
                    attempt,
                    feature,
                    policy.provider,
                    policy.model,
                    day,
                    now,
                    policy.max_input_tokens,
                    "reserved",
                ),
            )
            return identity

    def mark_dispatched(self, identity):
        with self.database.connect() as db:
            policy = self._policy(db, lock=True)
            now = int(self.now())
            self._ready(policy, self.now())
            row = db.execute(
                "SELECT started_at,model,reserved_tokens FROM ai_attempts "
                "WHERE project_id=? AND id=?",
                (self.project_id, identity),
            ).fetchone()
            # Fail closed rather than shifting a reservation across rate/reset windows.
            if (
                not row
                or row["started_at"] != now
                or row["model"] != policy.model
                or row["reserved_tokens"] != policy.max_input_tokens
            ):
                raise VisionUnavailable("Reservation expired or policy changed. Use a new request.")
            if (
                db.execute(
                    "UPDATE ai_attempts SET state='dispatched' "
                    "WHERE project_id=? AND id=? AND state='reserved'",
                    (self.project_id, identity),
                ).rowcount
                != 1
            ):
                raise VisionUnavailable("Reservation is no longer dispatchable.")

    def settle(self, identity, outcome, *, input_tokens=None, output_tokens=None):
        if outcome not in ("released", "consumed", "uncertain"):
            raise ValueError("Invalid outcome.")
        for value in (input_tokens, output_tokens):
            if value is not None and (type(value) is not int or not 0 <= value <= 100000000):
                raise ValueError("Invalid usage.")
        with self.database.connect() as db:
            policy = self._policy(db, lock=True)
            row = db.execute(
                "SELECT * FROM ai_attempts WHERE project_id=? AND id=?", (self.project_id, identity)
            ).fetchone()
            if not row:
                raise ValueError("Unknown reservation.")
            if outcome == "released" and row["state"] != "reserved":
                raise ValueError("A possibly consumed call cannot be released.")
            if row["state"] == "released":
                raise ValueError("Released reservations cannot be settled again.")
            db.execute(
                "UPDATE ai_attempts SET state=?,input_tokens=COALESCE(?,input_tokens),"
                "output_tokens=COALESCE(?,output_tokens) WHERE project_id=? AND id=?",
                (outcome, input_tokens, output_tokens, self.project_id, identity),
            )
            if input_tokens is not None and input_tokens > row["reserved_tokens"]:
                # Keep actual usage and halt new calls; a wrong bound must not silently repeat.
                policy.enabled = False
                db.execute(
                    "UPDATE ai_projects SET policy=?,revision=revision+1 WHERE id=?",
                    (policy.model_dump_json(), self.project_id),
                )

    def summary(self):
        with self.database.connect() as db:
            policy = self._policy(db)
            day = (
                datetime.fromtimestamp(self.now(), ZoneInfo(policy.reset_timezone))
                .date()
                .isoformat()
            )
            rows = db.execute(
                "SELECT feature,state,input_tokens,output_tokens,cost_microusd FROM ai_attempts "
                "WHERE project_id=? AND provider_day=? AND state!='released'",
                (self.project_id, day),
            ).fetchall()
        try:
            self._ready(policy, self.now())
            enabled = True
        except VisionUnavailable:
            enabled = False
        features = {feature: sum(row["feature"] == feature for row in rows) for feature in FEATURES}
        return {
            "project_id": self.project_id,
            "model": policy.model,
            "provider_day": day,
            "reset_timezone": policy.reset_timezone,
            "enabled": enabled,
            "verified_at": policy.verified_at.isoformat() if policy.verified_at else None,
            "daily_limit": policy.daily_limit,
            "used_requests": len(rows),
            "features": features,
            "photo_remaining": max(
                0,
                min(
                    policy.daily_limit - len(rows),
                    policy.feature_daily_limits.get("photo", 0) - features["photo"],
                ),
            ),
            "reserved_photo_remaining": max(0, policy.photo_reserve - features["photo"]),
            "input_tokens_reported": sum(row["input_tokens"] or 0 for row in rows),
            "unknown_cost_attempts": sum(row["cost_microusd"] is None for row in rows),
            "known_cost_microusd": sum(row["cost_microusd"] or 0 for row in rows),
        }

    def recognize(self, provider, images, options, owner, key, payload_digest):
        if not self.available():
            raise VisionUnavailable("AI ledger needs setup. Use manual entry.")
        policy = self.policy()
        self._ready(policy, self.now())
        if (provider.name, provider.model) != (policy.provider, policy.model):
            raise VisionUnavailable("Provider does not match the verified AI policy.")
        attempts = []

        @contextmanager
        def attempt_scope(index):
            identity = self.reserve(owner, "photo", key, payload_digest, index)
            attempts.append(identity)
            self.mark_dispatched(identity)
            try:
                yield
            except BaseException:
                self.settle(identity, "uncertain")
                raise
            else:
                self.settle(identity, "consumed")

        result, usage = provider.recognize(images, options, attempt_scope=attempt_scope)
        if attempts:
            self.settle(
                attempts[-1],
                "consumed",
                input_tokens=usage.get("input_tokens"),
                output_tokens=usage.get("output_tokens"),
            )
        return result, usage
