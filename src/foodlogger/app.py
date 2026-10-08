"""HTTP composition layer; domain modules are independent of FastAPI."""

import csv
import logging
import os
from datetime import date
from io import StringIO
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from foodlogger.classifier import Classifier, ModelUnavailable
from foodlogger.images import MAX_UPLOAD_BYTES, InvalidImage, decode_image
from foodlogger.nutrition import Catalog
from foodlogger.schemas import MealCreate
from foodlogger.storage import Journal

logger = logging.getLogger(__name__)
PACKAGE = Path(__file__).parent


class BodyLimitMiddleware:
    """Bound raw upload bodies, including chunked bodies, before multipart parsing."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in {"POST", "PUT", "PATCH"}:
            return await self.app(scope, receive, send)
        chunks, total = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            total += len(message.get("body", b""))
            if total > MAX_UPLOAD_BYTES + 65536:
                response = JSONResponse({"detail": "Upload exceeds the 8 MiB limit."}, 413)
                return await response(scope, receive, send)
            chunks.append(message)
            if not message.get("more_body", False):
                break
        iterator = iter(chunks)

        async def replay():
            try:
                return next(iterator)
            except StopIteration:
                return await receive()

        await self.app(scope, replay, send)


def create_app(db_path: str | Path | None = None, classifier=None) -> FastAPI:
    app = FastAPI(title="FoodLogger API", version="1.0.0", description="Local food journal")
    app.add_middleware(BodyLimitMiddleware)
    catalog = Catalog()
    journal = Journal(db_path or os.getenv("FOODLOGGER_DB", "runtime/journal.sqlite3"))
    predictor = classifier if classifier is not None else Classifier(catalog)
    app.mount("/static", StaticFiles(directory=PACKAGE / "static"), name="static")

    @app.get("/", include_in_schema=False)
    def index():
        return FileResponse(PACKAGE / "templates/index.html")

    @app.get("/api/health")
    def health():
        return {"status": "ok", "model": predictor.name, "version": "1.0.0"}

    @app.get("/api/foods")
    def foods():
        return {"foods": list(catalog.foods.values()), "source": catalog.source}

    @app.get("/api/nutrition")
    def nutrition(
        food_id: str,
        grams: Annotated[float, Query(ge=1, le=2000, allow_inf_nan=False)],
    ):
        try:
            return catalog.estimate(food_id, grams)
        except KeyError as error:
            raise HTTPException(404, "Food is not in the nutrition catalog.") from error

    @app.post("/api/predict")
    async def predict(file: Annotated[UploadFile, File()]):
        try:
            data = await file.read(MAX_UPLOAD_BYTES + 1)
            image = await run_in_threadpool(decode_image, data)
            return await run_in_threadpool(predictor.predict, image)
        except InvalidImage as error:
            raise HTTPException(422, str(error)) from error
        except ModelUnavailable as error:
            logger.warning("Classifier unavailable: %s", error, exc_info=True)
            raise HTTPException(503, str(error)) from error
        finally:
            await file.close()

    @app.post("/api/meals", status_code=201)
    def add_meal(meal: MealCreate):
        try:
            return journal.add(meal, catalog)
        except KeyError as error:
            raise HTTPException(404, "Choose a food from the catalog.") from error

    @app.get("/api/meals")
    def meals(day: date):
        entries = journal.list(day)
        # Build both from the same snapshot so concurrent writes cannot disagree.
        summary = {
            "count": len(entries),
            **{
                key: round(sum(m[key] for m in entries), 1)
                for key in ("calories", "protein", "carbs", "fat")
            },
        }
        return {"day": day, "meals": entries, "summary": summary}

    @app.delete("/api/meals/{meal_id}", status_code=204)
    def delete_meal(meal_id: str):
        if not journal.delete(meal_id):
            raise HTTPException(404, "Meal no longer exists.")
        return Response(status_code=204)

    @app.get("/api/export")
    def export(day: date):
        output = StringIO(newline="")
        fields = ["day", "meal_type", "name", "grams", "calories", "protein", "carbs", "fat"]
        writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(journal.list(day))
        return Response(
            output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="foodlogger-{day}.csv"'},
        )

    return app
