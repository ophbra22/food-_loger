"""Owner goal revisions must not silently alter past adherence or lose concurrent edits."""

from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from test_meal_analysis_pipeline import register

from foodlogger.app import create_app
from foodlogger.security import Settings

TODAY = date.today()
TARGET = {
    "effective_local_date": str(TODAY),
    "timezone_id": "UTC",
    "allow_past": True,
    "expected_version": 0,
    "calorie_target": 2300,
    "protein_g": 150,
    "carbs_g": 250,
    "fat_g": 70,
    "water_ml": 2000,
    "target_weight_kg": None,
    "calorie_min_percent": 90,
    "calorie_max_percent": 110,
}


@pytest.fixture
def client(tmp_path):
    with TestClient(
        create_app(
            tmp_path / "goals.db", settings=Settings(goals_enabled=True, canonical_writes=True)
        )
    ) as c:
        yield c


def test_goals_are_authenticated_default_off_and_require_available_schema(tmp_path):
    with TestClient(create_app(tmp_path / "off.db")) as c:
        assert c.get("/api/goals").status_code == 401
        h = register(c, "alice")
        assert c.get("/api/capabilities", headers=h).json()["goals"] is False
        assert c.get("/api/goals", headers=h).status_code == 503
        assert c.put("/api/goals", headers=h, json=TARGET).status_code == 503


def test_tomorrow_revision_preserves_yesterday_and_cross_owner_reads(client):
    alice, bob = register(client, "alice"), register(client, "bobby")
    yesterday, tomorrow = TODAY - timedelta(days=1), TODAY + timedelta(days=1)
    first = client.put(
        "/api/goals", headers=alice, json={**TARGET, "effective_local_date": str(yesterday)}
    )
    assert first.status_code == 200, first.text
    assert first.json()["version"] == 1
    second = client.put(
        "/api/goals",
        headers=alice,
        json={
            **TARGET,
            "effective_local_date": str(tomorrow),
            "expected_version": 1,
            "calorie_target": 2500,
        },
    )
    assert second.json()["version"] == 2
    assert client.get("/api/goals", headers=bob).json() == {"version": 0, "revisions": []}
    past = client.get(f"/api/daily-summary?date={yesterday}", headers=alice).json()
    future = client.get(f"/api/daily-summary?date={tomorrow}", headers=alice).json()
    assert past["progress"]["calories"]["target"] == 2300
    assert future["progress"]["calories"]["target"] == 2500
    assert past["logging_status"] == "unlogged"
    assert past["progress"]["calories"]["status"] == "unlogged"
    assert past["progress"]["water"]["consumed"] is None
    assert past["progress"]["water"]["status"] == "untracked"


def test_concurrent_updates_have_one_winner_and_same_day_revision_is_append_only(client):
    h = register(client, "alice")
    with ThreadPoolExecutor(2) as pool:
        responses = list(
            pool.map(lambda _: client.put("/api/goals", headers=h, json=TARGET), range(2))
        )
    assert sorted(r.status_code for r in responses) == [200, 409]
    changed = client.put(
        "/api/goals", headers=h, json={**TARGET, "expected_version": 1, "protein_g": 160}
    )
    assert changed.status_code == 200
    doc = client.get("/api/goals", headers=h).json()
    assert [r["protein_g"] for r in doc["revisions"]] == [150, 160]
    assert doc["version"] == 2


@pytest.mark.parametrize(
    "patch",
    [
        {"calorie_target": 0},
        {"protein_g": -1},
        {"carbs_g": 2000},
        {"fat_g": True},
        {"water_ml": 20000},
        {"target_weight_kg": 1000},
        {"calorie_min_percent": 120},
        {"calorie_max_percent": 80},
        {"timezone_id": "not/a-zone"},
        {"effective_local_date": "2026-02-30"},
        {"expected_version": -1},
        {"user_id": "someone-else"},
        {"effective_local_date": "2020-01-01", "allow_past": False},
    ],
)
def test_invalid_or_implicit_historical_goals_are_rejected(client, patch):
    h = register(client, "alice")
    assert client.put("/api/goals", headers=h, json={**TARGET, **patch}).status_code == 422
    assert client.get("/api/goals", headers=h).json()["version"] == 0


def test_energy_macro_warning_does_not_change_user_values_and_empty_goals_clear(client):
    h = register(client, "alice")
    result = client.put("/api/goals", headers=h, json={**TARGET, "calorie_target": 5000})
    assert result.json()["revisions"][0]["calorie_target"] == 5000
    assert result.json()["revisions"][0]["warnings"] == ["energy_macro_mismatch"]
    cleared = client.put(
        "/api/goals",
        headers=h,
        json={
            **TARGET,
            "expected_version": 1,
            **dict.fromkeys(["calorie_target", "protein_g", "carbs_g", "fat_g", "water_ml"]),
        },
    )
    assert cleared.status_code == 200
    assert (
        client.get(f"/api/daily-summary?date={TODAY}", headers=h).json()["progress"]["calories"][
            "status"
        ]
        == "no_goal"
    )


def test_progress_boundaries_partial_nutrients_and_lunch_mutations(client):
    h = register(client, "alice")
    assert client.put("/api/goals", headers=h, json=TARGET).status_code == 200
    from copy import deepcopy

    from test_meal_service import DRAFT

    draft = deepcopy(DRAFT)
    draft["local_date"] = str(TODAY)
    draft["items"][0]["portion"] = {"quantity": 1000, "unit": "g", "normalized_g": 1000}
    draft["items"][0]["nutrition_per_100"].update(
        energy_kcal=207, protein_g=15, carbs_g=10, fat_g=1
    )
    created = client.post(
        "/api/meal-logs",
        headers={**h, "Idempotency-Key": "p03-lunch-fixture"},
        json={**draft, "confirmed": True},
    )
    assert created.status_code == 201, created.text

    def daily():
        r = client.get(f"/api/daily-summary?date={TODAY}", headers=h)
        assert r.status_code == 200, r.text
        return r.json()

    progress = daily()["progress"]
    assert progress["calories"] == {
        "consumed": 2070,
        "known_total": 2070,
        "target": 2300,
        "remaining": 230,
        "percent": 90,
        "status": "in_range",
    }
    assert progress["protein"]["status"] == "met"
    assert progress["carbs"]["status"] == "below_target"
    group = created.json()
    draft["items"][0]["nutrition_per_100"].update(energy_kcal=253, protein_g=None)
    edited = client.patch(
        f"/api/meal-logs/{group['id']}",
        headers={**h, "Idempotency-Key": "p03-edit-fixture"},
        json={"draft": draft, "confirmed": True, "expected_version": 1},
    )
    assert edited.status_code == 200, edited.text
    assert daily()["progress"]["calories"]["status"] == "in_range"
    assert daily()["progress"]["protein"]["consumed"] is None
    assert daily()["progress"]["protein"]["remaining"] is None
    assert daily()["progress"]["protein"]["status"] == "partial"
    assert daily()["logging_status"] == "logged_incomplete"
    assert (
        client.delete(f"/api/meal-logs/{group['id']}?expected_version=2", headers=h).status_code
        == 204
    )
    assert daily()["summary"]["count"] == 0
    assert daily()["progress"]["calories"]["status"] == "unlogged"


def test_account_erasure_removes_goal_history(client):
    h = register(client, "alice")
    assert client.put("/api/goals", headers=h, json=TARGET).status_code == 200
    owner = client.get("/api/auth/me", headers=h).json()["user"]["id"]
    with client.app.state.auth.database.connect() as db:
        assert (
            db.execute(
                "SELECT COUNT(*) AS n FROM user_nutrition_goal_revisions WHERE user_id=?", (owner,)
            ).fetchone()["n"]
            == 1
        )
    # Exercise the real account deletion, including custom-auth password verification.
    assert (
        client.request(
            "DELETE",
            "/api/auth/account",
            headers=h,
            json={"password": "test-long-password-2026", "confirmation": "DELETE"},
        ).status_code
        == 204
    )
    with client.app.state.auth.database.connect() as db:
        assert (
            db.execute("SELECT COUNT(*) AS n FROM user_nutrition_goal_revisions").fetchone()["n"]
            == 0
        )


def test_near_zero_targets_cannot_overflow_progress(client):
    h = register(client, "alice")
    for key in ("calorie_target", "protein_g", "carbs_g", "fat_g", "water_ml", "target_weight_kg"):
        assert client.put("/api/goals", headers=h, json={**TARGET, key: 1e-308}).status_code == 422


def test_rc04_multi_item_edit_moves_day_preserves_basis_and_historical_goals(client):
    """E2E-04 API portion: 2300/150 goals, lunch edit, retry and future-only goal change."""
    from copy import deepcopy

    from test_meal_service import DRAFT

    h = register(client, "alice")
    assert client.put("/api/goals", headers=h, json=TARGET).status_code == 200
    draft = deepcopy(DRAFT)
    draft["local_date"] = str(TODAY)
    draft["items"][0]["portion"] = {"quantity": 100, "unit": "g", "normalized_g": 100}
    draft["items"][0]["nutrition_per_100"].update(energy_kcal=200, protein_g=20)
    other = deepcopy(draft["items"][0])
    other["id"] = "second"
    draft["items"].append(other)
    created = client.post(
        "/api/meal-logs",
        headers={**h, "Idempotency-Key": "rc04-create-lunch"},
        json={**draft, "confirmed": True},
    )
    assert created.status_code == 201
    group_id = created.json()["id"]
    assert len(created.json()["snapshot"]["meals"]) == 2
    tomorrow = TODAY + timedelta(days=1)
    draft["local_date"] = str(tomorrow)
    draft["occurred_at"] = f"{tomorrow}T12:30:00Z"
    draft["timezone_id"] = "UTC"
    draft["items"] = draft["items"][:1]  # Remove a component and correct the remaining basis.
    item = draft["items"][0]
    item["basis_correction"] = {
        "original_nutrition_per_100": deepcopy(item["nutrition_per_100"]),
        "original_source": deepcopy(item["source"]),
    }
    item["manual_override"] = True
    item["nutrition_per_100"]["basis"] = "ml"
    item["portion"] = {"quantity": 150, "unit": "ml", "normalized_ml": 150}
    body = {"draft": draft, "confirmed": True, "expected_version": 1}
    headers = {**h, "Idempotency-Key": "rc04-edit-lunch-key"}
    first = client.patch(f"/api/meal-logs/{group_id}", headers=headers, json=body)
    retry = client.patch(f"/api/meal-logs/{group_id}", headers=headers, json=body)
    assert first.status_code == retry.status_code == 200, first.text
    assert first.json() == retry.json()
    assert first.json()["version"] == 2
    row = first.json()["snapshot"]["meals"][0]
    assert row["calories"] == 300 and row["protein"] == 30
    from foodlogger.domain import BasisCorrection

    assert row["details"]["canonical_item"]["basis_correction"] == BasisCorrection(
        **item["basis_correction"]
    ).model_dump(mode="json")
    old = client.get(f"/api/daily-summary?date={TODAY}", headers=h).json()
    new = client.get(f"/api/daily-summary?date={tomorrow}", headers=h).json()
    assert old["summary"]["count"] == 0
    assert new["summary"]["count"] == 1
    assert new["progress"]["calories"]["target"] == 2300
    assert new["progress"]["calories"]["consumed"] == 300
    assert new["progress"]["protein"]["target"] == 150
    assert (
        client.put(
            "/api/goals",
            headers=h,
            json={
                **TARGET,
                "expected_version": 1,
                "effective_local_date": str(tomorrow + timedelta(days=1)),
                "calorie_target": 2500,
            },
        ).status_code
        == 200
    )
    later = client.get(f"/api/daily-summary?date={tomorrow}", headers=h).json()
    assert later["progress"] == new["progress"]
