"""RC03: a correction is a snapshot, never an upgrade of source verification."""

import json
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient
from test_meal_analysis_pipeline import register
from test_meal_service import DRAFT, setup_journal

from foodlogger.app import create_app
from foodlogger.domain import MealDraft
from foodlogger.meal_service import MealService, digest
from foodlogger.security import Settings


def corrected():
    body = deepcopy(DRAFT)
    item = body["items"][0]
    item["basis_correction"] = {
        "original_nutrition_per_100": deepcopy(item["nutrition_per_100"]),
        "original_source": {
            "provider": "fixture-label",
            "reference_id": "product-1",
            "verified_status": "estimated",
        },
    }
    item["nutrition_per_100"]["basis"] = "ml"
    item["portion"] = {"quantity": 10, "unit": "ml", "normalized_ml": 10}
    item["manual_override"] = True
    return body


def test_correction_requires_override_and_preserves_unknown_original():
    body = corrected()
    body["items"][0]["basis_correction"]["original_source"]["verified_status"] = "legacy_unknown"
    draft = MealDraft.model_validate(body)
    assert (
        draft.model_dump(mode="json")["items"][0]["basis_correction"]["original_source"][
            "verified_status"
        ]
        == "legacy_unknown"
    )
    body["items"][0]["manual_override"] = False
    with pytest.raises(ValueError):
        MealDraft.model_validate(body)


def test_old_receipt_digest_omits_absent_correction(tmp_path):
    journal, owner, _ = setup_journal(tmp_path)
    draft = MealDraft.model_validate(DRAFT)
    old_wire = draft.model_dump(mode="json")
    assert "basis_correction" not in old_wire["items"][0]
    service = MealService(journal)
    group, _ = service.create(draft, owner, "old-rc03-request")
    # Explicit null from a newer reader must normalize to the old wire identity.
    null_wire = deepcopy(old_wire)
    null_wire["items"][0]["basis_correction"] = None
    retried = MealDraft.model_validate(null_wire)
    assert digest(retried.model_dump(mode="json")) == digest(old_wire)
    assert service.create(retried, owner, "old-rc03-request") == (group, False)


def test_provenance_survives_private_recipe_repeat_copy_archive(tmp_path):
    with TestClient(
        create_app(
            tmp_path / "rc03.db",
            settings=Settings(
                canonical_writes=True,
                library_enabled=True,
                recipe_writes=True,
                copy_enabled=True,
                private_products_enabled=True,
            ),
        )
    ) as client:
        h = register(client, "alice")
        assert (
            client.get("/api/capabilities", headers=h).json()["basis_correction_provenance"] is True
        )
        body = corrected()
        body.update(occurred_at="2026-10-13T12:00:00+03:00", timezone_id="Asia/Jerusalem")

        def save(draft, key):
            r = client.post(
                "/api/meal-logs",
                headers={**h, "Idempotency-Key": key},
                json={**draft, "confirmed": True},
            )
            assert r.status_code == 201, r.text
            return r.json()

        group = save(body, "rc03-source-request")
        expected = group["snapshot"]["draft"]["items"][0]["basis_correction"]
        assert expected["original_nutrition_per_100"]["basis"] == "g"
        assert (
            group["snapshot"]["meals"][0]["details"]["canonical_item"]["basis_correction"]
            == expected
        )
        private = client.put(
            "/api/private-products/" + "a" * 32,
            headers={**h, "Idempotency-Key": "rc03-private-request"},
            json={"item": body["items"][0], "expected_version": 0, "confirmed": True},
        )
        assert private.status_code in (200, 201), private.text
        assert private.json()["item"]["basis_correction"] == expected
        recipe = client.post(
            "/api/saved-recipes",
            headers={**h, "Idempotency-Key": "rc03-recipe-request"},
            json={"name": "Corrected fixture", "servings": 2, "items": body["items"]},
        )
        assert recipe.status_code == 201, recipe.text
        assert recipe.json()["draft"]["items"][0]["basis_correction"] == expected
        entry = client.get("/api/recents", headers=h).json()["items"][0]
        assert entry["draft"]["items"][0]["basis_correction"] == expected
        repeated = save(
            {
                **entry["draft"],
                "local_date": "2026-10-14",
                "input_method": "repeat",
                "occurred_at": None,
                "timezone_id": None,
            },
            "rc03-repeat-request",
        )
        assert repeated["snapshot"]["draft"]["items"][0]["basis_correction"] == expected
        selection = {
            "source_day": "2026-10-13",
            "sources": [{"id": group["id"], "version": 1}],
            "destination_date": "2026-10-15",
            "timezone_id": "Asia/Jerusalem",
            "times": {},
        }
        preview = client.post("/api/days/copy", headers=h, json={**selection, "action": "preview"})
        assert preview.status_code == 200, preview.text
        p = preview.json()
        assert p["drafts"][0]["items"][0]["basis_correction"] == expected
        saved = client.post(
            "/api/days/copy",
            headers={**h, "Idempotency-Key": "rc03-copy-request"},
            json={
                **selection,
                "action": "confirm",
                "confirmed": True,
                "confirm_populated": False,
                "preview_token": p["preview_token"],
                "drafts": p["drafts"],
            },
        )
        assert saved.status_code == 201, saved.text
        assert (
            saved.json()["groups"][0]["snapshot"]["draft"]["items"][0]["basis_correction"]
            == expected
        )
        archive = client.get("/api/account/export", headers=h)
        assert archive.status_code == 200, archive.text
        stored = [json.loads(x["snapshot"]) for x in archive.json()["data"]["meal_groups"]]
        assert all(x["draft"]["items"][0]["basis_correction"] == expected for x in stored)
