"""Explicit account archive; never export authentication or delivery credentials."""

import json
from datetime import UTC, datetime

from fastapi.encoders import jsonable_encoder

from foodlogger.database import Database

MAX_ROWS = 50_000
PAGE_ROWS = 32
MAX_BYTES = 10 * 1024 * 1024
# Fixed SQL identifiers, not request input. New tables/columns require privacy review.
EXPORT_COLUMNS = {
    "meals": (
        "id,day,meal_type,food_id,name,emoji,grams,calories,protein,carbs,fat,created_at,details"
    ),
    "meal_groups": "id,local_date,occurred_at,timezone_id,version,deleted_at,snapshot",
    "meal_group_items": "entry_id,group_id",
    "save_receipts": "operation,group_id,result_ids,status,created_at",
    "foundation_issues": "entry_id,reason,created_at",
    "ai_attempts": (
        "id,project_id,attempt,feature,provider,model,provider_day,"
        "started_at,reserved_tokens,input_tokens,output_tokens,cost_microusd,state"
    ),
    "user_nutrition_goal_revisions": (
        "id,version,effective_local_date,created_at,calorie_target,"
        "protein_g,carbs_g,fat_g,water_ml,target_weight_kg,calorie_min_percent,calorie_max_percent"
    ),
    "tracking_entries": (
        "id,kind,value,occurred_at,local_date,timezone_id,source,"
        "external_id,version,deleted,created_at,updated_at"
    ),
    "tracking_receipts": "request_key,entry_id",
    "library_favorites": "kind,source_id,created_at",
    "recipe_headers": "id,current_version,created_at,updated_at,deleted_at",
    "recipe_versions": "recipe_id,version,name,servings,created_at",
    "recipe_items": "recipe_id,version,position,item",
    "library_requests": "operation,result,created_at",
    "recommendation_preferences": "version,body",
    "recommendation_source_reviews": "kind,source_id,source_revision,version,body",
    "reminder_preferences": "version,body",
    "reminder_devices": "installation_generation,platform,ready,checked_at",
    "reminder_attempts": "local_date,category,attempted_at",
    "private_products": "id,current_version,created_at,updated_at,deleted_at",
    "private_product_versions": "product_id,version,item,created_at",
    "private_product_requests": "result",
    "label_cache": "payload,created_at,expires_at",
    "health_scopes": "scope",
    "health_exports": "record_key,sample_id,revision,payload",
    "health_imports": "external_id,payload,created_at",
    "health_connect_imports": "external_id,payload,modified_at,tracking_id,deleted,updated_at",
    "apple_identities": "subject,has_password",
}
EXCLUDED_TABLES = {
    "sessions": "Authentication credentials; revoked on logout/deletion.",
    "apple_challenges": "Short-lived authentication secrets, not account content.",
    "foundation_migrations": "Shared migration metadata.",
    "foundation_jobs": "Shared migration progress.",
    "ai_projects": "Shared provider policy; per-account usage is exported separately.",
}
EXCLUSIONS = {
    **EXCLUDED_TABLES,
    "credentials": (
        "Password/recovery hashes, Apple refresh tokens, push tokens and request digests excluded."
    ),
    "device_data": (
        "Device-local drafts,"
        " pending operations and preferences require a device export. "
        "External Health records are managed by the OS."
    ),
    "derived_views": (
        "Trends/insights/widget views derive from the exported source "
        "records; no separate server copy."
    ),
    "photos_audio": "No server photo/audio archive is retained by this application.",
}


class ArchiveTooLarge(ValueError):
    """The archive cannot be returned completely within the safe response limit."""


def account_archive(database: Database, user_id: str) -> dict:
    """One consistent database read; fail explicitly instead of truncating user data."""
    result = {
        "schema_version": 1,
        "generated_at": datetime.now(UTC).isoformat(),
        "account": {},
        "data": {},
        "exclusions": EXCLUSIONS,
    }
    remaining, size = MAX_ROWS, 0
    with database.connect() as db:
        db.execute(
            "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"
            if database.postgres
            else "BEGIN"
        )
        account = db.execute("SELECT id, username FROM users WHERE id=?", (user_id,)).fetchone()
        if account is None:
            raise LookupError("Account no longer exists.")
        result["account"] = dict(account)
        for table, columns in EXPORT_COLUMNS.items():
            data, offset = [], 0
            size += 2  # Array brackets; the complete envelope is checked below.
            while True:
                limit = min(PAGE_ROWS, remaining + 1)
                # SQL pagination bounds driver buffering too (fetchmany alone does not).
                # The read snapshot and fixed complete ordering keep pages consistent.
                rows = db.execute(
                    f"SELECT {columns} FROM {table} WHERE user_id=? "
                    f"ORDER BY {columns} LIMIT ? OFFSET ?",
                    (user_id, limit, offset),
                ).fetchall()
                if len(rows) > remaining:
                    raise ArchiveTooLarge("Account archive exceeds the local response limit.")
                for row in rows:
                    item = jsonable_encoder(dict(row))
                    size += len(json.dumps(item, ensure_ascii=False, allow_nan=False).encode())
                    size += 2 if data else 0  # JSON comma and space.
                    if size > MAX_BYTES:
                        raise ArchiveTooLarge("Account archive exceeds the local response limit.")
                    data.append(item)
                remaining -= len(rows)
                offset += len(rows)
                if len(rows) < limit:
                    break
            result["data"][table] = data
    if len(json.dumps(result, ensure_ascii=False, allow_nan=False).encode()) > MAX_BYTES:
        raise ArchiveTooLarge("Account archive exceeds the local response limit.")
    return result
