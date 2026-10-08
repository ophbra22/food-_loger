"""Multi-user HTTP application with private journals and server-side inference."""

import asyncio
import csv
import logging
import os
import secrets
import threading
from io import StringIO
from pathlib import Path
from typing import Annotated
from urllib.parse import urlsplit

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool
from starlette.middleware.trustedhost import TrustedHostMiddleware

from foodlogger.auth import AccountExists, AuthStore, InvalidAccountInput, InvalidCredentials
from foodlogger.classifier import Classifier, ModelUnavailable
from foodlogger.database import Database, DatabaseUnavailable
from foodlogger.images import MAX_UPLOAD_BYTES, InvalidImage, decode_image
from foodlogger.nutrition import Catalog
from foodlogger.products import (
    InvalidBarcode,
    LookupUnavailable,
    OpenFoodFactsClient,
    ProductNotFound,
    decode_barcode,
    validate_barcode,
)
from foodlogger.schemas import (
    Credentials,
    CustomMealCreate,
    JournalDate,
    MealCreate,
    RecoveryRequest,
)
from foodlogger.security import RateLimiter, Settings
from foodlogger.storage import Journal

logger = logging.getLogger(__name__)
PACKAGE = Path(__file__).parent
COOKIE = "foodlogger_session"


class BodyLimitMiddleware:
    """Bound raw bodies before parsing, including requests with chunked encoding."""

    def __init__(self, app, auth=None):
        self.app = app
        self.auth = auth
        self.body_timeout = 30
        self.upload_slot = threading.BoundedSemaphore(1)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in {"POST", "PUT", "PATCH"}:
            return await self.app(scope, receive, send)
        upload = scope["path"] in {"/api/predict", "/api/barcode/scan"}
        if upload and self.auth is not None:
            request = Request(scope)
            try:
                session = await run_in_threadpool(
                    self.auth.get_session, request.cookies.get(COOKIE)
                )
            except DatabaseUnavailable:
                return await JSONResponse(
                    {"detail": "The journal database is temporarily unavailable."}, 503
                )(scope, receive, send)
            if not session:
                return await JSONResponse({"detail": "Sign in to access your journal."}, 401)(
                    scope, receive, send
                )
            if not secrets.compare_digest(
                request.headers.get("x-csrf-token", ""), session["csrf_token"]
            ):
                return await JSONResponse(
                    {"detail": "Your session changed. Refresh and try again."}, 403
                )(scope, receive, send)
        if upload and not self.upload_slot.acquire(blocking=False):
            response = JSONResponse(
                {"detail": "Image processing is busy. Please try again shortly."},
                429,
                headers={"Retry-After": "3"},
            )
            return await response(scope, receive, send)
        try:
            return await self.bounded_request(scope, receive, send)
        finally:
            if upload:
                self.upload_slot.release()

    async def bounded_request(self, scope, receive, send):
        limit = (
            MAX_UPLOAD_BYTES + 65536
            if scope["path"]
            in {
                "/api/predict",
                "/api/barcode/scan",
            }
            else 65536
        )
        chunks, total = [], 0
        try:
            async with asyncio.timeout(self.body_timeout):
                while True:
                    message = await receive()
                    if message["type"] == "http.disconnect":
                        return
                    total += len(message.get("body", b""))
                    if total > limit:
                        response = JSONResponse(
                            {"detail": "Request is too large. Photos must be under 8 MiB."}, 413
                        )
                        return await response(scope, receive, send)
                    chunks.append(message)
                    if not message.get("more_body", False):
                        break
        except TimeoutError:
            return await JSONResponse({"detail": "Upload timed out. Please try again."}, 408)(
                scope, receive, send
            )
        iterator = iter(chunks)

        async def replay():
            try:
                return next(iterator)
            except StopIteration:
                return await receive()

        await self.app(scope, replay, send)


def create_app(
    db_path: str | Path | Database | None = None,
    classifier=None,
    products=None,
    settings: Settings | None = None,
) -> FastAPI:
    settings = settings or Settings.from_environment()
    app = FastAPI(title="FoodLogger API", version="2.1.0", description="Private food journals")
    if settings.production:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=[
                urlsplit(settings.public_url).hostname,
                "127.0.0.1",
                "localhost",
            ],
        )
    location = (
        db_path
        if db_path is not None
        else (os.getenv("DATABASE_URL") or os.getenv("FOODLOGGER_DB", "runtime/journal.sqlite3"))
    )
    if os.getenv("FOODLOGGER_PROFILE") == "free" and not (
        isinstance(location, Database)
        and location.postgres
        or str(location).startswith(("postgresql://", "postgres://"))
    ):
        raise RuntimeError("The free profile requires a PostgreSQL DATABASE_URL.")
    database = location if isinstance(location, Database) else Database(location)
    catalog, journal, auth = Catalog(), Journal(database), AuthStore(database)
    app.add_middleware(BodyLimitMiddleware, auth=auth)
    if classifier is not None:
        predictor = classifier
    elif os.getenv("FOODLOGGER_INFERENCE", "tensorflow") == "lite":
        from foodlogger.lite_classifier import LiteClassifier

        predictor = LiteClassifier(catalog, os.getenv("FOODLOGGER_LITE_MODEL"))
    elif os.getenv("FOODLOGGER_INFERENCE", "tensorflow") == "tensorflow":
        predictor = Classifier(catalog)
    else:
        raise RuntimeError("FOODLOGGER_INFERENCE must be tensorflow or lite.")
    product_client = products if products is not None else OpenFoodFactsClient()
    limiter = RateLimiter()
    image_slot = threading.BoundedSemaphore(1)
    app.state.auth = auth
    app.mount("/static", StaticFiles(directory=PACKAGE / "static"), name="static")

    @app.exception_handler(DatabaseUnavailable)
    async def database_unavailable(request, error):
        return JSONResponse(
            {"detail": "The journal database is temporarily unavailable. Please try again."},
            503,
            headers={"Retry-After": "10"},
        )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            expected = settings.public_url or str(request.base_url).rstrip("/")
            origin = request.headers.get("origin")
            if origin and origin != expected:
                return JSONResponse({"detail": "Cross-origin requests are not allowed."}, 403)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["Permissions-Policy"] = "camera=(self), microphone=(), geolocation=()"
        if request.url.path not in {"/docs", "/redoc", "/docs/oauth2-redirect"}:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; script-src 'self'; style-src 'self'; "
                "img-src 'self' data: blob:; connect-src 'self'; "
                "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
            )
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        if settings.production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        # Avoid echoing password inputs in validation responses.
        return JSONResponse(
            {
                "detail": "Check the supplied values.",
                "fields": [
                    {"field": ".".join(map(str, item["loc"])), "message": item["msg"]}
                    for item in error.errors()
                ],
            },
            422,
        )

    def require_user(request: Request) -> dict:
        session = auth.get_session(request.cookies.get(COOKIE))
        if not session:
            raise HTTPException(401, "Sign in to access your journal.")
        if request.method not in {"GET", "HEAD", "OPTIONS"} and not secrets.compare_digest(
            request.headers.get("x-csrf-token", ""),
            session["csrf_token"],
        ):
            raise HTTPException(403, "Your session changed. Refresh and try again.")
        return session

    def auth_request(request: Request):
        if request.headers.get("x-foodlogger-request") != "1":
            raise HTTPException(403, "Use the FoodLogger sign-in form.")
        address = settings.client_address(request)
        limiter.check("auth:" + address, 8, 60)

    def open_session(user, response, recovery_code=None, session_tokens=None):
        token, csrf = session_tokens or auth.create_session(user["id"])
        response.set_cookie(
            COOKIE,
            token,
            httponly=True,
            secure=settings.production,
            samesite="lax",
            max_age=AuthStore.SESSION_TTL_SECONDS,
            path="/",
        )
        result = {"user": user, "csrf_token": csrf}
        if recovery_code:
            result["recovery_code"] = recovery_code
        return result

    @app.get("/", include_in_schema=False)
    def index():
        return FileResponse(PACKAGE / "templates/index.html")

    @app.get("/api/health")
    def health():
        with journal.connect() as db:
            db.execute("SELECT 1").fetchone()
        return {"status": "ok", "model": predictor.name, "version": "2.1.0"}

    @app.post("/api/auth/register", status_code=201)
    def register(credentials: Credentials, request: Request, response: Response):
        auth_request(request)
        address = settings.client_address(request)
        limiter.check("register:" + address, 6, 3600)
        try:
            user, recovery = auth.register(credentials.username, credentials.password)
        except AccountExists as error:
            raise HTTPException(409, str(error)) from error
        except InvalidAccountInput as error:
            raise HTTPException(422, str(error)) from error
        return open_session(user, response, recovery)

    @app.post("/api/auth/login")
    def login(credentials: Credentials, request: Request, response: Response):
        auth_request(request)
        limiter.check("login-user:" + credentials.username.strip().lower(), 8, 60)
        try:
            user, token, csrf = auth.authenticate_session(
                credentials.username, credentials.password
            )
        except InvalidCredentials as error:
            raise HTTPException(401, str(error)) from error
        return open_session(user, response, session_tokens=(token, csrf))

    @app.post("/api/auth/recover")
    def recover(payload: RecoveryRequest, request: Request, response: Response):
        auth_request(request)
        limiter.check("recovery:" + payload.username.strip().lower(), 5, 300)
        try:
            user, code = auth.recover(payload.username, payload.recovery_code, payload.new_password)
        except InvalidCredentials as error:
            raise HTTPException(401, str(error)) from error
        except InvalidAccountInput as error:
            raise HTTPException(422, str(error)) from error
        return open_session(user, response, code)

    @app.get("/api/auth/me")
    def me(session: Annotated[dict, Depends(require_user)]):
        return {"user": session["user"], "csrf_token": session["csrf_token"]}

    @app.post("/api/auth/logout", status_code=204)
    def logout(request: Request, session: Annotated[dict, Depends(require_user)]):
        auth.revoke_session(request.cookies.get(COOKIE))
        response = Response(status_code=204)
        response.delete_cookie(
            COOKIE, path="/", secure=settings.production, httponly=True, samesite="lax"
        )
        return response

    @app.get("/api/foods")
    def foods():
        return {"foods": list(catalog.foods.values()), "source": catalog.source}

    @app.get("/api/nutrition")
    def nutrition(food_id: str, grams: Annotated[float, Query(ge=1, le=2000, allow_inf_nan=False)]):
        try:
            return catalog.estimate(food_id, grams)
        except KeyError as error:
            raise HTTPException(404, "Food is not in the nutrition catalog.") from error

    @app.post("/api/predict")
    async def predict(
        file: Annotated[UploadFile, File()], session: Annotated[dict, Depends(require_user)]
    ):
        limiter.check("predict:" + session["user"]["id"], 12, 60)
        if not image_slot.acquire(blocking=False):
            raise HTTPException(
                429,
                "Image processing is busy. Please try again shortly.",
                headers={"Retry-After": "3"},
            )
        image = None
        try:
            data = await file.read(MAX_UPLOAD_BYTES + 1)
            image = await run_in_threadpool(decode_image, data)
            return await run_in_threadpool(predictor.predict, image)
        except InvalidImage as error:
            raise HTTPException(422, str(error)) from error
        except ModelUnavailable as error:
            logger.warning("Classifier unavailable", exc_info=True)
            raise HTTPException(503, str(error)) from error
        finally:
            if image is not None:
                image.close()
            image_slot.release()
            await file.close()

    @app.get("/api/products/{barcode}")
    def product(barcode: str, session: Annotated[dict, Depends(require_user)]):
        limiter.check("lookup:" + session["user"]["id"], 20, 60)
        limiter.check("lookup:global", 90, 60)
        try:
            return product_client.lookup(barcode)
        except InvalidBarcode as error:
            raise HTTPException(422, str(error)) from error
        except ProductNotFound as error:
            raise HTTPException(
                404, "Product not found. You can enter its nutrition label manually."
            ) from error
        except LookupUnavailable as error:
            raise HTTPException(
                503,
                "Product lookup is temporarily unavailable. Enter the label manually or try again.",
            ) from error

    @app.post("/api/barcode/scan")
    async def scan_barcode(
        file: Annotated[UploadFile, File()], session: Annotated[dict, Depends(require_user)]
    ):
        limiter.check("scan:" + session["user"]["id"], 20, 60)
        if not image_slot.acquire(blocking=False):
            raise HTTPException(
                429,
                "Image processing is busy. Please try again shortly.",
                headers={"Retry-After": "3"},
            )
        image = None
        try:
            image = await run_in_threadpool(decode_image, await file.read(MAX_UPLOAD_BYTES + 1))
            barcode = await run_in_threadpool(decode_barcode, image)
            return {"barcode": barcode}
        except (InvalidImage, InvalidBarcode) as error:
            raise HTTPException(422, str(error)) from error
        finally:
            if image is not None:
                image.close()
            image_slot.release()
            await file.close()

    @app.post("/api/meals", status_code=201)
    def add_meal(meal: MealCreate, session: Annotated[dict, Depends(require_user)]):
        limiter.check("write:" + session["user"]["id"], 60, 60)
        try:
            return journal.add(meal, catalog, user_id=session["user"]["id"])
        except KeyError as error:
            raise HTTPException(404, "Choose a food from the catalog.") from error

    @app.post("/api/meals/custom", status_code=201)
    def custom_meal(meal: CustomMealCreate, session: Annotated[dict, Depends(require_user)]):
        limiter.check("write:" + session["user"]["id"], 60, 60)
        if meal.barcode:
            try:
                validate_barcode(meal.barcode)
            except InvalidBarcode as error:
                raise HTTPException(422, str(error)) from error
        return journal.add_custom(meal, user_id=session["user"]["id"])

    @app.get("/api/meals")
    def meals(day: JournalDate, session: Annotated[dict, Depends(require_user)]):
        entries = journal.list(day, user_id=session["user"]["id"])
        summary = {
            "count": len(entries),
            **{
                key: round(sum(m[key] for m in entries), 1)
                for key in ("calories", "protein", "carbs", "fat")
            },
        }
        return {"day": day, "meals": entries, "summary": summary}

    @app.delete("/api/meals/{meal_id}", status_code=204)
    def delete_meal(meal_id: str, session: Annotated[dict, Depends(require_user)]):
        if not journal.delete(meal_id, user_id=session["user"]["id"]):
            raise HTTPException(404, "Meal no longer exists.")
        return Response(status_code=204)

    @app.get("/api/export")
    def export(day: JournalDate, session: Annotated[dict, Depends(require_user)]):
        output = StringIO(newline="")
        fields = [
            "day",
            "meal_type",
            "name",
            "grams",
            "unit",
            "calories",
            "protein",
            "carbs",
            "fat",
            "sugars",
            "saturated_fat",
            "fiber",
            "salt",
            "sodium",
            "barcode",
        ]
        writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for entry in journal.list(day, user_id=session["user"]["id"]):
            details = entry["details"]
            row = {
                **entry,
                **details.get("nutrition_total", {}),
                "unit": details.get("basis_unit", "g"),
                "barcode": details.get("barcode"),
            }
            # Product names are user/upstream input: avoid spreadsheet formula execution.
            row["name"] = (
                "'" + row["name"]
                if row["name"].lstrip().startswith(("=", "+", "-", "@"))
                else row["name"]
            )
            writer.writerow(row)
        return Response(
            output.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="foodlogger-{day}.csv"',
            },
        )

    return app
