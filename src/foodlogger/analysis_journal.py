"""Atomic, retry-safe multi-component save using the existing meals table."""

import hashlib
import sqlite3
from datetime import UTC, datetime

from foodlogger.foundation import Foundation
from foodlogger.meal_service import MealConflict, MealService
from foodlogger.nutrition_reference import scale_nutrients
from foodlogger.storage import _entry_id

AnalysisSaveConflict = MealConflict


def save_analyzed(journal, payload, references, user_id, request_key):
    digest = hashlib.sha256(payload.model_dump_json().encode()).hexdigest()
    group_id = _entry_id(user_id, request_key)
    now = datetime.now(UTC).isoformat()
    entries = []
    for index, food in enumerate(payload.foods):
        reference = references.get(food.reference_id) if food.reference_id else None
        per100 = (reference.nutrition if reference else food.manual_nutrition).model_dump()
        if any(value is None for value in per100.values()):
            raise ValueError("Choose a complete nutrient record or enter the missing values.")
        nutrients = scale_nutrients(per100, food.grams)
        entries.append(
            {
                "id": _entry_id(user_id, request_key if index == 0 else f"{request_key}:{index}"),
                "day": payload.day.isoformat(),
                "meal_type": payload.meal_type,
                "food_id": "custom",
                "name": food.name,
                "emoji": "🍽️",
                "grams": food.grams,
                **nutrients,
                "created_at": now,
                "details": {
                    "source": "photo_analysis",
                    "basis_unit": "g",
                    "nutrition_per100": per100,
                    "nutrition_total": nutrients,
                    "nutrition_reference": reference.model_dump() if reference else None,
                    "nutrition_source": reference.source if reference else "User supplied",
                    "analysis_id": payload.analysis_id,
                    "group_id": group_id,
                    "request_digest": digest,
                    "component_count": len(payload.foods),
                    "portion_basis": "user_reviewed_estimate",
                    "confirmed": True,
                },
            }
        )

    if Foundation(journal.database).available():
        return MealService(journal).save_entries(entries, user_id, request_key, digest, "analyzed")

    def existing(db):
        rows = [
            db.execute(
                "SELECT * FROM meals WHERE id = ? AND user_id = ?", (entry["id"], user_id)
            ).fetchone()
            for entry in entries
        ]
        if not any(rows):
            return None
        if not all(rows):
            raise AnalysisSaveConflict("A saved component was removed. Reload your journal.")
        saved = [journal._public(row) for row in rows]
        if any(row["details"].get("request_digest") != digest for row in saved):
            raise AnalysisSaveConflict("This save key was used for different meal content.")
        return saved

    try:
        with journal.connect() as db:
            saved = existing(db)
            if saved:
                return saved, False
            for entry in entries:
                journal.insert_into(db, entry, user_id)
        return entries, True
    except sqlite3.IntegrityError:
        # Unique ids settle concurrent retries in both SQLite and PostgreSQL.
        with journal.connect() as db:
            saved = existing(db)
            if saved:
                return saved, False
        raise
