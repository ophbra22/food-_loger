"""Immutable personal product versions; bounded owner-only label cache, never images."""

import json
import re
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator

from foodlogger.domain import Contract, MealDraftItem
from foodlogger.foundation import lock_owner
from foodlogger.library import table_exists
from foodlogger.meal_service import MealConflict, digest, request_hash
from foodlogger.nutrition_engine import scale_nutrients_exact


class ProductBody(Contract):
    confirmed: Literal[True]
    expected_version: int = Field(ge=0, le=100000)
    item: MealDraftItem

    @model_validator(mode="after")
    def confirmed_source(self):
        if self.item.source.verified_status != "user_confirmed":
            raise ValueError(
                "Confirm the product yourself; private products are not verified sources."
            )
        scale_nutrients_exact(self.item.nutrition_per_100, self.item.portion)
        if len(self.item.model_dump_json()) > 50000:
            raise ValueError("Product metadata is too large.")
        return self


class PrivateProducts:
    def __init__(self, database, now=time.time):
        self.database = database
        self.now = now
        if not database.postgres:
            with database.connect() as db:
                for statement in (
                    (Path(__file__).parent / "data/private_products.sql").read_text().split(";")
                ):
                    if statement.strip():
                        db.execute(statement)

    def available(self):
        return table_exists(self.database, "private_products") and table_exists(
            self.database, "label_cache"
        )

    def _get(self, db, owner, identity, version=None):
        header = db.execute(
            "SELECT * FROM private_products WHERE user_id=? AND id=? AND deleted_at IS NULL",
            (owner, identity),
        ).fetchone()
        if not header:
            raise KeyError("Private product not found.")
        row = db.execute(
            "SELECT * FROM private_product_versions WHERE user_id=? AND product_id=? AND version=?",
            (owner, identity, version or header["current_version"]),
        ).fetchone()
        if not row:
            raise KeyError("Private product version not found.")
        return {
            "id": identity,
            "version": row["version"],
            "item": json.loads(row["item"]),
            "created_at": row["created_at"],
        }

    def get(self, owner, identity, version=None):
        with self.database.connect() as db:
            return self._get(db, owner, identity, version)

    def list(self, owner, query=""):
        with self.database.connect() as db:
            headers = db.execute(
                "SELECT id FROM private_products WHERE user_id=? AND deleted_at IS NULL "
                "ORDER BY updated_at DESC,id LIMIT 100",
                (owner,),
            ).fetchall()
            rows = [self._get(db, owner, h["id"]) for h in headers]
        return [r for r in rows if query.casefold() in r["item"]["display_name"].casefold()]

    def save(self, owner, identity, body, key):
        if not re.fullmatch("[a-f0-9]{32}", identity) or not re.fullmatch(
            "[A-Za-z0-9_-]{16,64}", key
        ):
            raise ValueError("Use a valid product identity and request key.")
        fingerprint = digest({"id": identity, "body": body.model_dump(mode="json")})
        request = request_hash(owner, key)
        now = datetime.fromtimestamp(self.now(), UTC).isoformat()
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            previous = db.execute(
                "SELECT digest,result FROM private_product_requests WHERE user_id=? AND "
                "request_hash=?",
                (owner, request),
            ).fetchone()
            if previous:
                if previous["digest"] != fingerprint:
                    raise MealConflict("This product request key was used for different content.")
                result = json.loads(previous["result"])
                self._get(db, owner, identity)
                return result, False
            header = db.execute(
                "SELECT * FROM private_products WHERE user_id=? AND id=?", (owner, identity)
            ).fetchone()
            if (
                header
                and (header["deleted_at"] or header["current_version"] != body.expected_version)
                or not header
                and body.expected_version != 0
            ):
                raise MealConflict("The private product changed. Reload before saving.")
            version = body.expected_version + 1
            if header:
                db.execute(
                    "UPDATE private_products SET current_version=?,updated_at=? WHERE user_id=? "
                    "AND id=?",
                    (version, now, owner, identity),
                )
            else:
                count = db.execute(
                    "SELECT count(*) AS n FROM private_products WHERE user_id=? AND deleted_at "
                    "IS NULL",
                    (owner,),
                ).fetchone()["n"]
                if count >= 100:
                    raise ValueError(
                        "Private product limit reached; remove an unused product first."
                    )
                db.execute(
                    "INSERT INTO private_products VALUES(?,?,?,?,?,NULL)",
                    (owner, identity, version, now, now),
                )
            db.execute(
                "INSERT INTO private_product_versions VALUES(?,?,?,?,?)",
                (owner, identity, version, body.item.model_dump_json(), now),
            )
            result = self._get(db, owner, identity)
            db.execute(
                "INSERT INTO private_product_requests VALUES(?,?,?,?)",
                (owner, request, fingerprint, json.dumps(result)),
            )
            return result, True

    def delete(self, owner, identity, version):
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            current = self._get(db, owner, identity)
            if current["version"] != version:
                raise MealConflict("The product changed. Reload before deleting.")
            db.execute(
                "UPDATE private_products SET deleted_at=? WHERE user_id=? AND id=?",
                (datetime.fromtimestamp(self.now(), UTC).isoformat(), owner, identity),
            )

    def cache_get(self, owner, fingerprint):
        with self.database.connect() as db:
            row = db.execute(
                "SELECT payload FROM label_cache WHERE user_id=? AND fingerprint=? AND "
                "expires_at>?",
                (owner, fingerprint, self.now()),
            ).fetchone()
            return json.loads(row["payload"]) if row else None

    def cache_put(self, owner, fingerprint, result):
        payload = json.dumps(result, ensure_ascii=False, allow_nan=False)
        if not re.fullmatch("[a-f0-9]{64}", fingerprint) or len(payload.encode()) > 65536:
            raise ValueError("Invalid label cache entry.")
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            db.execute(
                "DELETE FROM label_cache WHERE user_id=? AND expires_at<=?", (owner, self.now())
            )
            db.execute(
                "INSERT INTO label_cache VALUES(?,?,?,?,?) ON CONFLICT(user_id,fingerprint) "
                "DO UPDATE SET "
                "payload=excluded.payload,created_at=excluded.created_at,expires_at=excluded.expires_at",
                (owner, fingerprint, payload, self.now(), self.now() + 7 * 86400),
            )
            stale = db.execute(
                "SELECT fingerprint FROM label_cache WHERE user_id=? ORDER BY created_at "
                "DESC,fingerprint DESC LIMIT 100 OFFSET 32",
                (owner,),
            ).fetchall()
            for row in stale:
                db.execute(
                    "DELETE FROM label_cache WHERE user_id=? AND fingerprint=?",
                    (owner, row["fingerprint"]),
                )
