"""One journal, transactional groups and durable owner-scoped retry receipts."""

import hashlib
import json
import re
from datetime import UTC, datetime
from decimal import Decimal

from foodlogger.domain import CORE_FIELDS, LEGACY_NUTRIENTS, MealDraft
from foodlogger.foundation import Foundation, lock_owner
from foodlogger.nutrition_engine import aggregate_nutrients, scale_nutrients_exact
from foodlogger.storage import _entry_id


class MealConflict(ValueError):
    pass


def digest(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def request_hash(owner, key):
    if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z0-9_-]{16,64}", key):
        raise ValueError("Provide a valid Idempotency-Key.")
    return _entry_id(owner, key)


class MealService:
    def __init__(self, journal):
        self.journal = journal
        self.database = journal.database
        self.foundation = Foundation(self.database)

    def _group(self, db, group_id, owner, *, include_deleted=False):
        row = db.execute(
            "SELECT * FROM meal_groups WHERE user_id=? AND id=?", (owner, group_id)
        ).fetchone()
        return (
            self.foundation.public(row)
            if row and (include_deleted or not row["deleted_at"])
            else None
        )

    def get(self, group_id, owner):
        with self.database.connect() as db:
            return self._group(db, group_id, owner)

    def _replay(self, db, owner, key_hash, payload_digest, operation):
        row = db.execute(
            "SELECT * FROM save_receipts WHERE user_id=? AND request_hash=?", (owner, key_hash)
        ).fetchone()
        if not row:
            return None
        if row["status"] != "active":
            raise MealConflict("This saved meal was changed or deleted. Reload your journal.")
        if row["operation"] != operation or (
            operation != "legacy" and row["digest"] != payload_digest
        ):
            raise MealConflict("This save key was used for different meal content.")
        rows = [
            db.execute("SELECT * FROM meals WHERE user_id=? AND id=?", (owner, entry_id)).fetchone()
            for entry_id in json.loads(row["result_ids"])
        ]
        if not rows or not all(rows):
            raise MealConflict("A saved component was removed. Reload your journal.")
        return row["group_id"], [self.journal._public(entry) for entry in rows]

    def _receipt(self, db, owner, key_hash, payload_digest, operation, group_id, entries):
        db.execute(
            "INSERT INTO save_receipts(user_id,request_hash,digest,operation,group_id,"
            "result_ids,status,created_at) VALUES (?,?,?,?,?,?,?,?)",
            (
                owner,
                key_hash,
                payload_digest,
                operation,
                group_id,
                json.dumps([entry["id"] for entry in entries]),
                "active",
                datetime.now(UTC).isoformat(),
            ),
        )

    def save_entries(
        self,
        entries,
        owner,
        key,
        payload_digest,
        operation,
        *,
        snapshot=None,
        occurred_at=None,
        timezone_id=None,
    ):
        key_hash = request_hash(owner, key)
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            replay = self._replay(db, owner, key_hash, payload_digest, operation)
            if replay:
                return replay[1], False
            # Adopt pre-P01 complete entries on their first retry, without changing any value.
            rows = [
                db.execute(
                    "SELECT * FROM meals WHERE user_id=? AND id=?", (owner, e["id"])
                ).fetchone()
                for e in entries
            ]
            created = not any(rows)
            if not created:
                if not all(rows):
                    raise MealConflict("A saved component was removed.")
                entries = [self.journal._public(row) for row in rows]
                if operation != "legacy" and any(
                    e["details"].get("request_digest") != payload_digest for e in entries
                ):
                    raise MealConflict("This save key was used for different meal content.")
            else:
                for entry in entries:
                    self.journal.insert_into(db, entry, owner)
            mapped = db.execute(
                "SELECT group_id FROM meal_group_items WHERE user_id=? AND entry_id=?",
                (owner, entries[0]["id"]),
            ).fetchone()
            group_id = mapped["group_id"] if mapped else key_hash
            self.foundation.record_group(
                db,
                owner,
                group_id,
                entries,
                snapshot=snapshot,
                occurred_at=occurred_at,
                timezone_id=timezone_id,
            )
            self._receipt(db, owner, key_hash, payload_digest, operation, group_id, entries)
        return entries, created

    def _canonical_entries(self, draft: MealDraft, owner, group_id):
        from foodlogger.partial_migration import partial_storage_ready

        compatible = partial_storage_ready(self.journal.database)
        rows, totals = [], []
        for item in draft.items:
            amount = getattr(item.portion, "normalized_" + item.nutrition_per_100.basis)
            if amount is None or not (Decimal("0.0001") if compatible else 1) <= amount <= 2000:
                raise ValueError("Portion outside the supported storage range.")
            values = scale_nutrients_exact(item.nutrition_per_100, item.portion)
            if not compatible and any(values[key] is None for key in CORE_FIELDS):
                raise ValueError(
                    "Partial nutrient writes are disabled until reader compatibility is verified."
                )
            if item.source.verified_status == "verified":
                raise ValueError(
                    "A client cannot attest verified source data; use user-confirmed values."
                )
            totals.append(values)
            old = {
                old: float(values[new]) / (1000 if old == "sodium" else 1)
                for old, new in LEGACY_NUTRIENTS.items()
                if values[new] is not None
            }
            per100 = {
                old: float(getattr(item.nutrition_per_100, new)) / (1000 if old == "sodium" else 1)
                for old, new in LEGACY_NUTRIENTS.items()
                if getattr(item.nutrition_per_100, new) is not None
            }
            rows.append(
                {
                    "id": _entry_id(owner, group_id + ":" + item.id),
                    "day": str(draft.local_date),
                    "meal_type": draft.meal_category,
                    "food_id": "custom",
                    "name": item.display_name,
                    "emoji": "🍽️",
                    "grams": float(amount),
                    **{key: old.get(key) for key in ("calories", "protein", "carbs", "fat")},
                    "created_at": datetime.now(UTC).isoformat(),
                    "details": {
                        "source": "canonical",
                        "occurred_at": draft.occurred_at.isoformat() if draft.occurred_at else None,
                        "timezone_id": draft.timezone_id,
                        "group_id": group_id,
                        "basis_unit": item.nutrition_per_100.basis,
                        "nutrition_per100": per100,
                        "nutrition_total": old,
                        "schema_version": "2",
                        "calculation_version": "exact-v1",
                        "canonical_item": item.model_dump(mode="json"),
                    },
                }
            )
        total = aggregate_nutrients(totals)
        snapshot = {
            "schema_version": "2",
            "draft": draft.model_dump(mode="json"),
            "meals": rows,
            "totals": {
                part: {k: float(v) if v is not None else None for k, v in data.items()}
                for part, data in total.items()
                if part != "partial"
            },
            "partial": total["partial"],
        }
        return rows, snapshot

    def create(self, draft, owner, key):
        group_id = request_hash(owner, key)
        entries, snapshot = self._canonical_entries(draft, owner, group_id)
        _, created = self.save_entries(
            entries,
            owner,
            key,
            digest(draft.model_dump(mode="json")),
            "canonical",
            snapshot=snapshot,
            occurred_at=draft.occurred_at.isoformat() if draft.occurred_at else None,
            timezone_id=draft.timezone_id,
        )
        group = self.get(group_id, owner)
        if group is None:
            raise MealConflict("Meal was deleted before confirmation. Reload your journal.")
        return group, created

    def patch(self, group_id, draft, owner, expected_version, key):
        entries, snapshot = self._canonical_entries(draft, owner, group_id)
        key_hash = request_hash(owner, key)
        payload_digest = digest(
            {"id": group_id, "version": expected_version, "draft": draft.model_dump(mode="json")}
        )
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            replay = self._replay(db, owner, key_hash, payload_digest, "patch")
            if replay:
                return self._group(db, group_id, owner)
            group = self._group(db, group_id, owner)
            if not group:
                raise KeyError("Meal no longer exists.")
            if group["version"] != expected_version:
                raise MealConflict("Meal changed. Reload before editing.")
            ids = db.execute(
                "SELECT entry_id FROM meal_group_items WHERE user_id=? AND group_id=?",
                (owner, group_id),
            ).fetchall()
            for row in ids:
                db.execute("DELETE FROM meals WHERE user_id=? AND id=?", (owner, row["entry_id"]))
            for entry in entries:
                self.journal.insert_into(db, entry, owner)
                db.execute(
                    "INSERT INTO meal_group_items(entry_id,user_id,group_id) VALUES (?,?,?)",
                    (entry["id"], owner, group_id),
                )
            db.execute(
                "UPDATE meal_groups SET version=version+1,local_date=?,occurred_at=?,timezone_id=?,"
                "snapshot=? WHERE user_id=? AND id=?",
                (
                    str(draft.local_date),
                    draft.occurred_at.isoformat() if draft.occurred_at else None,
                    draft.timezone_id,
                    json.dumps(snapshot, ensure_ascii=False),
                    owner,
                    group_id,
                ),
            )
            db.execute(
                "UPDATE save_receipts SET status='changed' WHERE user_id=? AND group_id=?",
                (owner, group_id),
            )
            self._receipt(db, owner, key_hash, payload_digest, "patch", group_id, entries)
            return self._group(db, group_id, owner)

    def _tombstone(self, db, owner, group_id):
        db.execute(
            "UPDATE save_receipts SET status='deleted' WHERE user_id=? AND group_id=?",
            (owner, group_id),
        )
        db.execute(
            "UPDATE meal_groups SET version=version+1,deleted_at=?,snapshot=?,occurred_at=NULL,"
            "timezone_id=NULL WHERE user_id=? AND id=?",
            (datetime.now(UTC).isoformat(), "{}", owner, group_id),
        )

    def delete(self, group_id, owner, expected_version):
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            group = self._group(db, group_id, owner)
            if not group:
                raise KeyError("Meal no longer exists.")
            if group["version"] != expected_version:
                raise MealConflict("Meal changed. Reload before deleting.")
            rows = db.execute(
                "SELECT entry_id FROM meal_group_items WHERE user_id=? AND group_id=?",
                (owner, group_id),
            ).fetchall()
            for row in rows:
                db.execute("DELETE FROM meals WHERE user_id=? AND id=?", (owner, row["entry_id"]))
            self._tombstone(db, owner, group_id)

    def delete_component(self, entry_id, owner):
        with self.database.connect() as db:
            lock_owner(self.database, db, owner)
            row = db.execute(
                "SELECT * FROM meals WHERE user_id=? AND id=?", (owner, entry_id)
            ).fetchone()
            if not row:
                return False
            entry = self.journal._public(row)
            mapped = db.execute(
                "SELECT group_id FROM meal_group_items WHERE user_id=? AND entry_id=?",
                (owner, entry_id),
            ).fetchone()
            group_id = mapped["group_id"] if mapped else entry["details"].get("group_id", entry_id)
            if not mapped:
                self.foundation.record_group(db, owner, group_id, [entry])
            # Even historical keyed saves get a tombstone when deleted after this migration.
            key_hash = entry["details"].get("group_id", entry_id)
            db.execute(
                "INSERT INTO save_receipts(user_id,request_hash,digest,operation,group_id,"
                "result_ids,status,created_at) VALUES (?,?,?,?,?,?,?,?) "
                "ON CONFLICT(user_id,request_hash) DO NOTHING",
                (
                    owner,
                    key_hash,
                    None,
                    "legacy",
                    group_id,
                    "[]",
                    "deleted",
                    datetime.now(UTC).isoformat(),
                ),
            )
            db.execute("DELETE FROM meals WHERE user_id=? AND id=?", (owner, entry_id))
            db.execute(
                "UPDATE save_receipts SET status='deleted' WHERE user_id=? AND group_id=?",
                (owner, group_id),
            )
            remaining = db.execute(
                "SELECT m.* FROM meals m JOIN meal_group_items i "
                "ON m.id=i.entry_id AND m.user_id=i.user_id "
                "WHERE i.user_id=? AND i.group_id=? ORDER BY m.id",
                (owner, group_id),
            ).fetchall()
            if not remaining:
                self._tombstone(db, owner, group_id)
            else:
                saved = [self.journal._public(r) for r in remaining]
                # Legacy component deletion invalidates any complete canonical draft/total snapshot.
                snapshot = {
                    "schema_version": "legacy-v1",
                    "calculation_version": "historical",
                    "meals": saved,
                    "warnings": ["component_removed", "historical_totals_preserved"],
                }
                db.execute(
                    "UPDATE meal_groups SET version=version+1,snapshot=? WHERE user_id=? AND id=?",
                    (json.dumps(snapshot, ensure_ascii=False), owner, group_id),
                )
            return True
