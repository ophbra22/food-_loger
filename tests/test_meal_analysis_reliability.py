import json
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO

import httpx
import pytest
from PIL import Image

from foodlogger.analysis_journal import AnalysisSaveConflict, save_analyzed
from foodlogger.analysis_schemas import AnalysisOptions, AnalyzedMealCreate
from foodlogger.auth import AuthStore
from foodlogger.meal_analysis import AnalysisService, prepare_image
from foodlogger.nutrition_reference import ReferenceCatalog
from foodlogger.storage import Journal
from foodlogger.vision import OllamaVision, VisionUnavailable, configured_vision


def meal_payload():
    return AnalyzedMealCreate.model_validate(
        {
            "day": "2026-10-13",
            "meal_type": "lunch",
            "analysis_id": "real-transaction-test",
            "foods": [
                {
                    "id": "first",
                    "name": "Chicken",
                    "grams": 160,
                    "reference_id": "fdc:171477",
                    "confirmed": True,
                },
                {
                    "id": "second",
                    "name": "Rice",
                    "grams": 180,
                    "manual_nutrition": {
                        "calories": 130,
                        "protein": 2.7,
                        "fat": 0.3,
                        "carbs": 28.2,
                    },
                    "confirmed": True,
                },
            ],
        }
    )


def test_all_components_rollback_when_database_fails_halfway(tmp_path, monkeypatch):
    journal = Journal(tmp_path / "db")
    account, _ = AuthStore(journal.database).register("alice", "long-password-for-tests")
    insert = journal.insert_into

    def interrupted(db, entry, uid):
        if entry["name"] == "Rice":
            raise RuntimeError("interrupted transaction")
        insert(db, entry, uid)

    monkeypatch.setattr(journal, "insert_into", interrupted)
    with pytest.raises(RuntimeError):
        save_analyzed(
            journal, meal_payload(), ReferenceCatalog(), account["id"], "save-request-0001"
        )
    assert journal.list(meal_payload().day, user_id=account["id"]) == []


def test_concurrent_saves_return_same_atomic_group_and_deletion_does_not_resurrect_part(tmp_path):
    journal = Journal(tmp_path / "db")
    account, _ = AuthStore(journal.database).register("alice", "long-password-for-tests")

    def save(_):
        return save_analyzed(
            journal, meal_payload(), ReferenceCatalog(), account["id"], "save-request-0001"
        )

    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(save, range(2)))
    assert results[0][0] == results[1][0]
    assert sorted(result[1] for result in results) == [False, True]
    assert len(journal.list(meal_payload().day, user_id=account["id"])) == 2
    journal.delete(results[0][0][1]["id"], user_id=account["id"])
    with pytest.raises(AnalysisSaveConflict):
        save(0)


def test_image_orientation_metadata_and_aspect_ratio_are_preserved_without_crop():
    original = Image.new("RGB", (900, 300), "white")
    original.putpixel((0, 0), (255, 0, 0))
    exif = Image.Exif()
    exif[274] = 6
    exif[270] = "private metadata"
    buf = BytesIO()
    original.save(buf, "JPEG", exif=exif)
    clean, _ = prepare_image(buf.getvalue())
    with Image.open(BytesIO(clean)) as image:
        assert image.size == (300, 900)
        assert not image.getexif()
        assert b"private metadata" not in clean


def test_timeout_is_not_automatically_repeated_and_malformed_response_fails_closed():
    calls = []

    def fail(request):
        calls.append(1)
        raise httpx.ReadTimeout("private upstream text")

    provider = OllamaVision(client=httpx.Client(transport=httpx.MockTransport(fail)))
    with pytest.raises(VisionUnavailable):
        provider.recognize([b"test-image"], AnalysisOptions())
    assert len(calls) == 1
    with pytest.raises(VisionUnavailable):
        OllamaVision(
            client=httpx.Client(
                transport=httpx.MockTransport(lambda _: httpx.Response(200, json=["not an object"]))
            ),
        ).recognize([b"image"], AnalysisOptions())


def test_reference_search_preserves_preparation_and_important_food_identity():
    references = ReferenceCatalog()
    assert all("raw" in x.name.lower() for x in references.search("chicken breast", "raw"))
    assert references.search("potato cooked")
    assert references.search("tomato")
    assert references.search("tahini sauce") == []


@pytest.mark.parametrize(
    "address",
    [
        "https://api.example.com",
        "http://169.254.169.254",
        "http://127.0.0.1:11434/elsewhere",
        "http://user@localhost",
    ],
)
def test_model_cannot_send_photos_to_external_services(address):
    with pytest.raises(ValueError, match="loopback"):
        OllamaVision(base_url=address)


def test_paid_or_cloud_models_are_never_automatic_fallbacks(monkeypatch):
    monkeypatch.setenv("FOODLOGGER_VISION_PROVIDER", "openai")
    with pytest.raises(ValueError, match="paid APIs are disabled"):
        configured_vision()
    with pytest.raises(ValueError, match="locally downloaded"):
        OllamaVision(model="qwen3-vl:235b-cloud")


def test_truncated_and_oversized_local_output_is_rejected():
    for body in [
        json.dumps({"done": True, "done_reason": "length", "message": {"content": "{}"}}),
        "x" * 512001,
    ]:
        provider = OllamaVision(
            client=httpx.Client(
                transport=httpx.MockTransport(
                    lambda _, body=body: httpx.Response(200, content=body)
                )
            )
        )
        with pytest.raises(VisionUnavailable):
            provider.recognize([b"image"], AnalysisOptions())


def test_result_cache_expiry_does_not_preserve_photos_or_cross_users():
    # External provider boundary only; orchestration/cache/reference logic is real.
    response = {
        "done": True,
        "done_reason": "stop",
        "message": {
            "content": json.dumps(
                {"meal_name": "Empty plate", "status": "no_food", "foods": [], "warnings": []}
            )
        },
    }
    clock = [0.0]
    count = []

    def respond(_):
        count.append(1)
        return httpx.Response(200, json=response)

    provider = OllamaVision(client=httpx.Client(transport=httpx.MockTransport(respond)))
    service = AnalysisService(provider, now=lambda: clock[0])
    buf = BytesIO()
    Image.new("RGB", (200, 200), "white").save(buf, "JPEG")
    first = service.analyze([buf.getvalue()], AnalysisOptions(), "alice", "analysis-request1")
    clock[0] = 601
    second = service.analyze([buf.getvalue()], AnalysisOptions(), "alice", "analysis-request1")
    assert first.analysis_id != second.analysis_id and len(count) == 2
    service.clear_user("alice")
    service.analyze([buf.getvalue()], AnalysisOptions(), "alice", "analysis-request1")
    assert len(count) == 3
