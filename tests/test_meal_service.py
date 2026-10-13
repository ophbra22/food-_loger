"""Durable receipts must survive component deletion, restart and competing writers."""

from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import date

import pytest
from fastapi.testclient import TestClient

from foodlogger.analysis_journal import AnalysisSaveConflict, save_analyzed
from foodlogger.analysis_schemas import AnalyzedMealCreate
from foodlogger.app import create_app
from foodlogger.auth import AuthStore
from foodlogger.nutrition_reference import ReferenceCatalog
from foodlogger.security import Settings
from foodlogger.storage import Journal

DAY = "2026-10-13"
PASSWORD = "local-only-password-2026"
DRAFT = {
    "input_method": "manual",
    "local_date": DAY,
    "meal_category": "lunch",
    "items": [
        {
            "id": "first",
            "display_name": "Synthetic fixture",
            "portion": {"quantity": 10, "unit": "g", "normalized_g": 10},
            "source": {"provider": "manual", "verified_status": "user_confirmed"},
            "nutrition_per_100": {
                "basis": "g",
                "energy_kcal": 1.4,
                "protein_g": 0,
                "carbs_g": 0,
                "fat_g": 0,
            },
        }
    ],
}


def setup_journal(tmp_path):
    journal = Journal(tmp_path / "journal.db")
    auth = AuthStore(journal.database)
    alice, _ = auth.register("alice", PASSWORD)
    bob, _ = auth.register("bob", PASSWORD)
    return journal, alice["id"], bob["id"]


def test_analyzed_retry_after_all_items_deleted_stays_deleted_across_restart(tmp_path):
    journal, alice, _ = setup_journal(tmp_path)
    payload = AnalyzedMealCreate.model_validate(
        {
            "day": DAY,
            "meal_type": "lunch",
            "analysis_id": "test",
            "foods": [
                {
                    "id": "one",
                    "name": "Fixture",
                    "grams": 100,
                    "confirmed": True,
                    "manual_nutrition": {"calories": 100, "protein": 1, "carbs": 1, "fat": 1},
                }
            ],
        }
    )
    key = "analyzed-save-test-key"
    saved, _ = save_analyzed(journal, payload, ReferenceCatalog(), alice, key)
    assert journal.delete(saved[0]["id"], user_id=alice)
    with pytest.raises(AnalysisSaveConflict):
        save_analyzed(Journal(journal.database), payload, ReferenceCatalog(), alice, key)
    assert journal.list(date.fromisoformat(DAY), user_id=alice) == []


def test_canonical_100_requests_create_one_group_and_conflicting_content_rejected(tmp_path):
    from foodlogger.domain import MealDraft
    from foodlogger.meal_service import MealConflict, MealService

    journal, alice, bob = setup_journal(tmp_path)
    service = MealService(journal)
    draft = MealDraft(**DRAFT)

    def save(_):
        return MealService(Journal(journal.database)).create(draft, alice, "canonical-test-key")

    with ThreadPoolExecutor(12) as pool:
        results = list(pool.map(save, range(100)))
    assert sum(created for _, created in results) == 1
    assert len({group["id"] for group, _ in results}) == 1
    assert len(journal.list(date.fromisoformat(DAY), user_id=alice)) == 1
    assert service.get(results[0][0]["id"], bob) is None
    changed = MealDraft(**{**DRAFT, "meal_category": "dinner"})
    with pytest.raises(MealConflict):
        service.create(changed, alice, "canonical-test-key")
    other, _ = service.create(draft, bob, "canonical-test-key")
    assert other["id"] != results[0][0]["id"]


def test_edit_version_and_delete_tombstone_cannot_be_bypassed(tmp_path):
    from foodlogger.domain import MealDraft
    from foodlogger.meal_service import MealConflict, MealService

    journal, alice, bob = setup_journal(tmp_path)
    service = MealService(journal)
    draft = MealDraft(**DRAFT)
    group, _ = service.create(draft, alice, "canonical-test-key")
    changed = deepcopy(DRAFT)
    changed["items"][0]["portion"] = {"quantity": 20, "unit": "g", "normalized_g": 20}
    updated = service.patch(group["id"], MealDraft(**changed), alice, 1, "patch-canonical-key")
    assert updated["version"] == 2
    assert updated["snapshot"]["meals"][0]["calories"] == 0.28
    assert (
        service.patch(group["id"], MealDraft(**changed), alice, 1, "patch-canonical-key") == updated
    )
    with pytest.raises(MealConflict):
        service.patch(group["id"], draft, alice, 1, "another-patch-key")
    with pytest.raises(KeyError):
        service.patch(group["id"], draft, bob, 2, "another-patch-key")
    with pytest.raises(MealConflict):
        service.delete(group["id"], alice, 1)
    service.delete(group["id"], alice, 2)
    with pytest.raises(MealConflict):
        service.create(draft, alice, "canonical-test-key")
    assert journal.list(date.fromisoformat(DAY), user_id=alice) == []
    with journal.connect() as db:
        assert (
            db.execute("SELECT snapshot FROM meal_groups WHERE user_id=?", (alice,)).fetchone()[
                "snapshot"
            ]
            == "{}"
        )


def test_canonical_partial_and_tiny_writes_blocked_until_compatibility_gate(tmp_path):
    from foodlogger.domain import MealDraft
    from foodlogger.meal_service import MealService

    journal, alice, _ = setup_journal(tmp_path)
    service = MealService(journal)
    for mode in ("missing", "tiny"):
        changed = deepcopy(DRAFT)
        if mode == "missing":
            changed["items"][0]["nutrition_per_100"]["protein_g"] = None
        else:
            changed["items"][0]["portion"] = {"quantity": 0.5, "unit": "g", "normalized_g": 0.5}
        with pytest.raises(ValueError):
            service.create(MealDraft(**changed), alice, "invalid-canonical-key")
    assert journal.list(date.fromisoformat(DAY), user_id=alice) == []


def test_legacy_http_retry_after_delete_is_conflict(tmp_path):
    with TestClient(create_app(tmp_path / "api.db")) as client:
        account = client.post(
            "/api/auth/register",
            headers={"X-FoodLogger-Request": "1", "X-FoodLogger-Client": "mobile"},
            json={"username": "alice", "password": PASSWORD},
        ).json()
        headers = {
            "Authorization": "Bearer " + account["session_token"],
            "Idempotency-Key": "legacy-safe-retry-key",
        }
        body = {"food_id": "banana", "grams": 100, "day": DAY, "meal_type": "lunch"}
        first = client.post("/api/meals", headers=headers, json=body)
        assert first.status_code == 201
        changed = client.post("/api/meals", headers=headers, json={**body, "grams": 200})
        assert changed.status_code == 200 and changed.json()["grams"] == 100
        assert client.delete("/api/meals/" + first.json()["id"], headers=headers).status_code == 204
        assert client.post("/api/meals", headers=headers, json=body).status_code == 409


def test_canonical_http_auth_flags_confirm_and_version_checks(tmp_path):
    with TestClient(
        create_app(tmp_path / "http.db", settings=Settings(canonical_writes=True))
    ) as client:
        assert client.post("/api/meal-logs", json={**DRAFT, "confirmed": True}).status_code == 401
        account = client.post(
            "/api/auth/register",
            headers={"X-FoodLogger-Request": "1", "X-FoodLogger-Client": "mobile"},
            json={"username": "alice", "password": PASSWORD},
        ).json()
        headers = {
            "Authorization": "Bearer " + account["session_token"],
            "Idempotency-Key": "canonical-http-key",
        }
        assert client.post("/api/meal-logs", headers=headers, json=DRAFT).status_code == 422
        saved = client.post("/api/meal-logs", headers=headers, json={**DRAFT, "confirmed": True})
        assert saved.status_code == 201, saved.text
        assert (
            client.post(
                "/api/meal-logs", headers=headers, json={**DRAFT, "confirmed": True}
            ).status_code
            == 200
        )
        assert (
            client.get("/api/meal-logs?day=" + DAY, headers=headers).json()["groups"][0]["id"]
            == saved.json()["id"]
        )
        assert (
            client.delete(
                "/api/meal-logs/" + saved.json()["id"] + "?expected_version=1", headers=headers
            ).status_code
            == 204
        )
    with TestClient(create_app(tmp_path / "http.db")) as disabled:
        assert (
            disabled.post(
                "/api/meal-logs", headers=headers, json={**DRAFT, "confirmed": True}
            ).status_code
            == 503
        )


def test_delete_before_create_response_does_not_report_success_with_null_group(
    tmp_path, monkeypatch
):
    from foodlogger.domain import MealDraft
    from foodlogger.meal_service import MealConflict, MealService

    journal, alice, _ = setup_journal(tmp_path)
    service = MealService(journal)
    get = service.get

    def deleted_before_read(group_id, owner):
        group = get(group_id, owner)
        service.delete(group_id, owner, group["version"])
        return get(group_id, owner)

    monkeypatch.setattr(service, "get", deleted_before_read)
    with pytest.raises(MealConflict):
        service.create(MealDraft(**DRAFT), alice, "create-delete-race-key")
