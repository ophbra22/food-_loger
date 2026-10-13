import pytest
from fastapi.testclient import TestClient
from test_meal_analysis_pipeline import register

from foodlogger.app import create_app
from foodlogger.security import Settings


def test_flags_default_off_and_admin_is_a_server_identity(tmp_path):
    path = tmp_path / "flags.db"
    with TestClient(create_app(path)) as client:
        assert client.get("/api/capabilities").status_code == 401
        alice = register(client, "alice")
        alice_id = client.get("/api/auth/me", headers=alice).json()["user"]["id"]
        bob = register(client, "bobby")
        result = client.get("/api/capabilities", headers=alice)
        assert result.status_code == 200
        assert result.json()["canonical_writes"] is False
        assert result.json()["ai_photo"] is False
        assert result.json()["partial_core_writes"] is False
        assert client.get("/api/admin/ai-budget").status_code == 401
        assert (
            client.get("/api/admin/ai-budget", headers={**bob, "X-Admin": "true"}).status_code
            == 403
        )
    with TestClient(
        create_app(path, settings=Settings(admin_user_ids=frozenset({alice_id})))
    ) as client:
        assert client.get("/api/admin/ai-budget", headers=bob).status_code == 403
        result = client.get("/api/admin/ai-budget", headers=alice)
        assert result.status_code == 200
        assert result.json() == {"configured": False, "enabled": False}
        assert (
            client.post("/api/admin/ai-budget", json={"enabled": True}, headers=alice).status_code
            == 405
        )


def test_env_flags_are_explicit_and_server_managed(monkeypatch):
    monkeypatch.setenv("FOODLOGGER_CANONICAL_WRITES", "1")
    monkeypatch.setenv("FOODLOGGER_AI_ENABLED", "true")
    monkeypatch.setenv("FOODLOGGER_AI_PROJECT_ID", "mocked-project")
    monkeypatch.setenv("FOODLOGGER_ADMIN_USER_IDS", "a" * 32)
    settings = Settings.from_environment()
    assert settings.canonical_writes and settings.ai_enabled
    assert settings.ai_project_id == "mocked-project"
    assert settings.admin_user_ids == frozenset({"a" * 32})
    monkeypatch.setenv("FOODLOGGER_AI_ENABLED", "maybe")
    with pytest.raises(RuntimeError):
        Settings.from_environment()


def test_canonical_capability_requires_owner_backfill(tmp_path):
    from datetime import date

    from foodlogger.foundation import Foundation
    from foodlogger.nutrition import Catalog
    from foodlogger.schemas import MealCreate
    from foodlogger.storage import Journal

    path = tmp_path / "backfill.db"
    with TestClient(create_app(path, settings=Settings(canonical_writes=True))) as client:
        headers = register(client, "alice")
        owner = client.get("/api/auth/me", headers=headers).json()["user"]["id"]
        journal = Journal(path)
        journal.add(
            MealCreate(food_id="banana", grams=100, day=date(2026, 10, 13), meal_type="snack"),
            Catalog(),
            user_id=owner,
        )
        caps = client.get("/api/capabilities", headers=headers).json()
        assert not caps["canonical_reads"] and not caps["canonical_writes"]
        assert client.get("/api/meal-logs?day=2026-10-13", headers=headers).status_code == 503
        assert Foundation(journal.database).backfill_batch()["processed"] == 1
        assert client.get("/api/capabilities", headers=headers).json()["canonical_reads"]
        assert client.get("/api/meal-logs?day=2026-10-13", headers=headers).status_code == 200
