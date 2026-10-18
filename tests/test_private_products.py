from datetime import UTC, datetime

import pytest

from foodlogger.auth import AuthStore
from foodlogger.meal_service import MealConflict
from foodlogger.private_products import PrivateProducts, ProductBody
from foodlogger.storage import Journal


def body(**updates):
    return ProductBody.model_validate(
        {
            "confirmed": True,
            "expected_version": 0,
            "item": {
                "id": "label",
                "display_name": "Private milk",
                "portion": {"quantity": 100, "unit": "ml", "normalized_ml": 100},
                "nutrition_per_100": {"basis": "ml", "energy_kcal": 50, "protein_g": None},
                "source": {"provider": "label", "verified_status": "user_confirmed"},
            },
            **updates,
        }
    )


@pytest.fixture
def setup(tmp_path):
    journal = Journal(tmp_path / "p.db")
    auth = AuthStore(journal.database)
    a, _ = auth.register("alice", "local-product-test-password")
    b, _ = auth.register("bob", "local-product-test-password")
    now = [datetime(2026, 10, 14, tzinfo=UTC).timestamp()]
    return PrivateProducts(journal.database, now=lambda: now[0]), a["id"], b["id"], now


def test_confirm_private_version_retry_owner_and_delete(setup):
    p, a, b, _ = setup
    saved, created = p.save(a, "a" * 32, body(), "private-key-0001")
    assert created and saved["version"] == 1
    assert p.save(a, "a" * 32, body(), "private-key-0001") == (saved, False)
    assert p.list(b) == []
    with pytest.raises(KeyError):
        p.get(b, "a" * 32)
    with pytest.raises(MealConflict):
        p.save(a, "a" * 32, body(), "different-key-0001")
    changed = body(expected_version=1)
    changed.item.nutrition_per_100.energy_kcal = 60
    second, _ = p.save(a, "a" * 32, changed, "private-key-0002")
    assert (
        second["version"] == 2
        and p.get(a, "a" * 32, 1)["item"]["nutrition_per_100"]["energy_kcal"] == 50
    )
    with pytest.raises(MealConflict):
        p.save(a, "a" * 32, changed, "private-key-0001")
    with pytest.raises(KeyError):
        p.delete(b, "a" * 32, 2)
    p.delete(a, "a" * 32, 2)
    assert p.list(a) == []
    with pytest.raises(KeyError):
        p.get(a, "a" * 32)


def test_confirmation_source_claims_and_missing_values(setup):
    p, a, _, _ = setup
    with pytest.raises(ValueError):
        body(confirmed=False)
    raw = body().model_dump()
    raw["item"]["source"]["verified_status"] = "verified"
    with pytest.raises(ValueError):
        ProductBody.model_validate(raw)
    result, _ = p.save(a, "b" * 32, body(), "missing-core-key-01")
    assert result["item"]["nutrition_per_100"]["protein_g"] is None


def test_fingerprints_are_private_bounded_expiring_and_deleted_with_account(setup):
    p, a, b, now = setup
    for i in range(40):
        p.cache_put(a, f"{i:064x}", {"fixture": i})
    assert p.cache_get(b, f"{39:064x}") is None
    assert p.cache_get(a, f"{0:064x}") is None
    assert p.cache_get(a, f"{39:064x}") == {"fixture": 39}
    with p.database.connect() as db:
        assert (
            db.execute("SELECT count(*) AS n FROM label_cache WHERE user_id=?", (a,)).fetchone()[
                "n"
            ]
            == 32
        )
    now[0] += 7 * 86400 + 1
    assert p.cache_get(a, f"{39:064x}") is None
    p.cache_put(a, "f" * 64, {"fixture": 0})
    with p.database.connect() as db:
        db.execute("DELETE FROM users WHERE id=?", (a,))
    with p.database.connect() as db:
        assert (
            db.execute("SELECT count(*) AS n FROM label_cache WHERE user_id=?", (a,)).fetchone()[
                "n"
            ]
            == 0
        )


def test_api_private_confirmation_reuse_ownership_and_flags(tmp_path):
    from fastapi.testclient import TestClient
    from test_meal_analysis_pipeline import register

    from foodlogger.app import create_app
    from foodlogger.security import Settings

    with TestClient(
        create_app(
            tmp_path / "api.db",
            settings=Settings(private_products_enabled=True, food_sources_enabled=True),
        )
    ) as c:
        a = register(c, "alice")
        b = register(c, "bob")
        key = {"Idempotency-Key": "product-create-key-001"}
        r = c.put(
            "/api/private-products/" + "a" * 32,
            headers={**a, **key},
            json=body().model_dump(mode="json"),
        )
        assert r.status_code == 201, r.text
        assert (
            c.put(
                "/api/private-products/" + "a" * 32,
                headers={**a, **key},
                json=body().model_dump(mode="json"),
            ).status_code
            == 200
        )
        assert c.get("/api/private-products", headers=b).json()["products"] == []
        assert c.get("/api/private-products/" + "a" * 32, headers=b).status_code == 404
        assert (
            c.get("/api/food-sources?q=milk", headers=a).json()["private_products"][0]["item"][
                "display_name"
            ]
            == "Private milk"
        )
        assert c.get("/api/meals?day=2026-10-14", headers=a).json()["meals"] == []
    with TestClient(create_app(tmp_path / "api.db", settings=Settings())) as c:
        assert c.get("/api/private-products", headers=a).status_code == 503


def test_active_product_limit_preserves_updates_and_frees_a_slot_only_after_delete(setup):
    products, alice, bob, _ = setup
    for index in range(100):
        products.save(alice, f"{index:032x}", body(), f"limit-product-{index:04d}")
    assert len(products.list(alice)) == 100
    with pytest.raises(ValueError, match="Private product limit reached"):
        products.save(alice, "f" * 32, body(), "limit-product-overflow")
    assert len(products.list(alice)) == 100
    products.save(alice, "0" * 32, body(expected_version=1), "limit-product-update")
    assert products.get(alice, "0" * 32)["version"] == 2
    products.save(bob, "f" * 32, body(), "limit-product-other-owner")
    products.delete(alice, "0" * 32, 2)
    products.save(alice, "f" * 32, body(), "limit-product-overflow")
    assert len(products.list(alice)) == 100
    assert len(products.list(bob)) == 1
