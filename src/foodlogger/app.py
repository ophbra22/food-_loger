"""Multi-user HTTP application with private journals and server-side inference."""

import asyncio
import csv
import logging
import os
import re
import secrets
import sqlite3
import threading
from io import StringIO
from pathlib import Path
from typing import Annotated
from urllib.parse import urlsplit
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool
from starlette.middleware.trustedhost import TrustedHostMiddleware

from foodlogger.ai_gateway import AIGateway
from foodlogger.analysis_journal import AnalysisSaveConflict, save_analyzed
from foodlogger.analysis_schemas import AnalysisOptions, AnalysisResult, AnalyzedMealCreate
from foodlogger.apple_auth import AppleAuth, AppleUnavailable
from foodlogger.auth import AccountExists, AuthStore, InvalidAccountInput, InvalidCredentials
from foodlogger.classifier import Classifier, ModelUnavailable
from foodlogger.copying import Copying, CopyRequest
from foodlogger.database import Database, DatabaseUnavailable
from foodlogger.domain import MealDraft, MealLogCreate, MealLogPatch
from foodlogger.foundation import Foundation
from foodlogger.goals import GoalConflict, Goals, GoalUpdate
from foodlogger.images import MAX_UPLOAD_BYTES, InvalidImage, decode_image
from foodlogger.library import Favorite, Library
from foodlogger.meal_analysis import AnalysisService
from foodlogger.meal_service import MealConflict, MealService
from foodlogger.nutrition import Catalog
from foodlogger.products import (
    InvalidBarcode,
    LookupUnavailable,
    OpenFoodFactsClient,
    ProductNotFound,
    decode_barcode,
    validate_barcode,
)
from foodlogger.recipes import RecipeBody, RecipeDuplicate, RecipePatch, Recipes
from foodlogger.schemas import (
    AccountDeletionRequest,
    AppleChallengeRequest,
    AppleDeletionRequest,
    AppleProof,
    Credentials,
    CustomMealCreate,
    JournalDate,
    MealCreate,
    RecoveryRequest,
)
from foodlogger.security import RateLimiter, Settings
from foodlogger.storage import Journal
from foodlogger.vision import VisionQuotaExceeded, VisionUnavailable

logger = logging.getLogger(__name__)
PACKAGE = Path(__file__).parent
COOKIE = "foodlogger_session"
IDEMPOTENCY_KEY = re.compile(r"[A-Za-z0-9_-]{16,64}")


def resolve_session(auth, request: Request) -> tuple[dict | None, bool]:
    """Return the session and whether it relies on an ambient browser cookie.

    Native clients send the opaque session token as ``Authorization: Bearer``.
    Browsers never attach that header on their own, so only cookie sessions
    need the CSRF token. A bearer header is never mixed with a cookie.
    """
    scheme, _, value = request.headers.get("authorization", "").partition(" ")
    if scheme:
        token = value.strip() if scheme.lower() == "bearer" else None
        return auth.get_session(token), False
    return auth.get_session(request.cookies.get(COOKIE)), True


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
        upload = scope["path"] in {"/api/predict", "/api/barcode/scan", "/api/analyze-meal"}
        if upload and self.auth is not None:
            request = Request(scope)
            try:
                session, ambient = await run_in_threadpool(resolve_session, self.auth, request)
            except DatabaseUnavailable:
                return await JSONResponse(
                    {"detail": "The journal database is temporarily unavailable."}, 503
                )(scope, receive, send)
            if not session:
                return await JSONResponse({"detail": "Sign in to access your journal."}, 401)(
                    scope, receive, send
                )
            if ambient and not secrets.compare_digest(
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
            2 * MAX_UPLOAD_BYTES + 65536
            if scope["path"] == "/api/analyze-meal"
            else (
                MAX_UPLOAD_BYTES + 65536
                if scope["path"]
                in {
                    "/api/predict",
                    "/api/barcode/scan",
                }
                else (524288 if scope["path"] in {"/api/meals/copy", "/api/days/copy"} else 65536)
            )
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
    analyzer=None,
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
    foundation = Foundation(database)
    meal_service = MealService(journal)
    library = Library(database)
    recipes = Recipes(database)
    goal_service = Goals(database)
    apple = AppleAuth(auth)
    app.state.apple = apple
    gateway = AIGateway(database, settings.ai_project_id, enabled=settings.ai_enabled)
    app.state.ai_gateway = gateway
    meal_analyzer = analyzer if analyzer is not None else AnalysisService()
    meal_analyzer.gateway = gateway
    app.mount("/static", StaticFiles(directory=PACKAGE / "static"), name="static")

    @app.exception_handler(MealConflict)
    async def meal_conflict(request, error):
        return JSONResponse({"detail": str(error)}, 409)

    @app.exception_handler(AppleUnavailable)
    async def apple_unavailable(request, error):
        return JSONResponse({"detail": str(error)}, 503)

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
        session, ambient = resolve_session(auth, request)
        if not session:
            raise HTTPException(401, "Sign in to access your journal.")
        if (
            ambient
            and request.method not in {"GET", "HEAD", "OPTIONS"}
            and not secrets.compare_digest(
                request.headers.get("x-csrf-token", ""),
                session["csrf_token"],
            )
        ):
            raise HTTPException(403, "Your session changed. Refresh and try again.")
        return session

    def auth_request(request: Request):
        if request.headers.get("x-foodlogger-request") != "1":
            raise HTTPException(403, "Use the FoodLogger sign-in form.")
        address = settings.client_address(request)
        limiter.check("auth:" + address, 8, 60)

    def open_session(user, request, response, recovery_code=None, session_tokens=None):
        token, csrf = session_tokens or auth.create_session(user["id"])
        result = {"user": apple.flags(user), "csrf_token": csrf}
        if request.headers.get("x-foodlogger-client") == "mobile":
            # Native apps keep the token in the device keystore and send it as a
            # bearer credential; they receive no cookie.
            result["session_token"] = token
            result["expires_in"] = AuthStore.SESSION_TTL_SECONDS
        else:
            response.set_cookie(
                COOKIE,
                token,
                httponly=True,
                secure=settings.production,
                samesite="lax",
                max_age=AuthStore.SESSION_TTL_SECONDS,
                path="/",
            )
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
        return open_session(user, request, response, recovery)

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
        return open_session(user, request, response, session_tokens=(token, csrf))

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
        return open_session(user, request, response, code)

    @app.get("/api/auth/me")
    def me(session: Annotated[dict, Depends(require_user)]):
        return {"user": apple.flags(session["user"]), "csrf_token": session["csrf_token"]}

    @app.post("/api/auth/logout", status_code=204)
    def logout(request: Request, session: Annotated[dict, Depends(require_user)]):
        scheme, _, bearer = request.headers.get("authorization", "").partition(" ")
        auth.revoke_session(bearer.strip() if scheme else request.cookies.get(COOKIE))
        response = Response(status_code=204)
        response.delete_cookie(
            COOKIE, path="/", secure=settings.production, httponly=True, samesite="lax"
        )
        return response

    @app.delete("/api/auth/account", status_code=204)
    def delete_account(
        payload: AccountDeletionRequest,
        session: Annotated[dict, Depends(require_user)],
    ):
        user_id = session["user"]["id"]
        limiter.check("delete-account:" + user_id, 5, 300)
        try:
            auth.delete_account(
                user_id, payload.password, before_delete=apple.revoke_in_transaction
            )
        except InvalidCredentials as error:
            # This is a failed identity check, not an expired session.
            raise HTTPException(403, "Current password is incorrect.") from error
        meal_analyzer.clear_user(user_id)
        response = Response(status_code=204)
        response.delete_cookie(
            COOKIE, path="/", secure=settings.production, httponly=True, samesite="lax"
        )
        return response

    def apple_request(request):
        if request.headers.get("x-foodlogger-request") != "1":
            raise HTTPException(403, "Use the Biteflow sign-in form.")
        limiter.check("apple:" + settings.client_address(request), 30, 60)

    def apple_context(request, purpose):
        if purpose == "login":
            return "", None
        session = require_user(request)
        # Bind linking/deletion to the exact currently authenticated session.
        token = request.headers.get("authorization", "") or request.cookies.get(COOKIE, "")
        return token, session["user"]["id"]

    @app.post("/api/auth/apple/challenge")
    def apple_challenge(payload: AppleChallengeRequest, request: Request):
        apple_request(request)
        token, uid = apple_context(request, payload.purpose)
        return apple.challenge(payload.purpose, token, uid)

    def apple_complete(payload, request, purpose):
        apple_request(request)
        token, uid = apple_context(request, purpose)
        try:
            subject, encrypted = apple.consume(payload, purpose, token, uid)
            if purpose == "delete":
                apple.delete(uid, subject, encrypted)
                return None
            return apple.sign_in(subject, encrypted, uid)
        except InvalidCredentials as error:
            raise HTTPException(403, str(error)) from error
        except AccountExists as error:
            raise HTTPException(409, str(error)) from error

    @app.post("/api/auth/apple/login")
    def apple_login(payload: AppleProof, request: Request, response: Response):
        return open_session(apple_complete(payload, request, "login"), request, response)

    @app.post("/api/auth/apple/link")
    def apple_link(payload: AppleProof, request: Request):
        return {"user": apple.flags(apple_complete(payload, request, "link"))}

    @app.post("/api/auth/apple/delete", status_code=204)
    def apple_delete(payload: AppleDeletionRequest, request: Request):
        user_id = require_user(request)["user"]["id"]
        apple_complete(payload, request, "delete")
        meal_analyzer.clear_user(user_id)
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

    @app.get("/api/capabilities")
    def capabilities(session: Annotated[dict, Depends(require_user)]):
        from foodlogger.partial_migration import partial_storage_ready

        ready = foundation.ready_for_owner(session["user"]["id"])
        partial_ready = ready and settings.canonical_writes and partial_storage_ready(database)
        ai_photo = False
        if gateway.available():
            try:
                policy = gateway.policy()
                gateway._ready(policy, gateway.now())
                ai_photo = (meal_analyzer.provider.name, meal_analyzer.provider.model) == (
                    policy.provider,
                    policy.model,
                )
            except VisionUnavailable:
                pass
        return {
            "schema_versions": [1, 2],
            "canonical_reads": ready,
            "canonical_writes": ready and settings.canonical_writes,
            "partial_core_writes": partial_ready,
            "tiny_portion_writes": partial_ready,
            "ai_photo": ai_photo,
            "copy": settings.copy_enabled
            and settings.canonical_writes
            and partial_ready
            and ready
            and Copying(meal_service).available(),
            "recipes": settings.library_enabled and ready and recipes.available(),
            "recipe_writes": settings.library_enabled
            and settings.recipe_writes
            and ready
            and recipes.available(),
            "library": settings.library_enabled and ready and library.available(),
            "goals": settings.goals_enabled and goal_service.available(),
        }

    def library_ready(owner):
        if (
            not settings.library_enabled
            or not foundation.ready_for_owner(owner)
            or not library.available()
        ):
            raise HTTPException(503, "Library is not enabled on this server.")

    @app.get("/api/recents")
    @app.get("/api/favorites")
    def list_library(
        request: Request,
        session: Annotated[dict, Depends(require_user)],
        query: Annotated[str, Query(max_length=120)] = "",
        limit: Annotated[int, Query(ge=1, le=20)] = 20,
        offset: Annotated[int, Query(ge=0, le=100000)] = 0,
    ):
        owner = session["user"]["id"]
        library_ready(owner)
        return library.list(
            owner,
            favorites=request.url.path.endswith("favorites"),
            query=query,
            limit=limit,
            offset=offset,
        )

    @app.post("/api/favorites")
    def favorite(payload: Favorite, session: Annotated[dict, Depends(require_user)]):
        owner = session["user"]["id"]
        library_ready(owner)
        limiter.check("write:" + owner, 60, 60)
        try:
            return library.favorite(owner, payload)
        except KeyError:
            raise HTTPException(404, "Source no longer exists.") from None

    @app.delete("/api/favorites/{kind}/{identity}", status_code=204)
    def unfavorite(kind: str, identity: str, session: Annotated[dict, Depends(require_user)]):
        owner = session["user"]["id"]
        library_ready(owner)
        limiter.check("write:" + owner, 60, 60)
        library.unfavorite(owner, kind, identity)
        return Response(status_code=204)

    def recipes_ready(owner, write=False):
        library_ready(owner)
        if not recipes.available() or (write and not settings.recipe_writes):
            raise HTTPException(503, "Recipe editing is not enabled on this server.")
        if write:
            limiter.check("write:" + owner, 60, 60)

    def recipe_call(action):
        try:
            return action()
        except KeyError:
            raise HTTPException(404, "Recipe no longer exists.") from None
        except MealConflict:
            raise
        except ValueError as error:
            raise HTTPException(422, str(error)) from None

    @app.get("/api/saved-recipes")
    def recipe_list(
        session: Annotated[dict, Depends(require_user)],
        query: Annotated[str, Query(max_length=120)] = "",
        limit: Annotated[int, Query(ge=1, le=20)] = 20,
        offset: Annotated[int, Query(ge=0, le=100000)] = 0,
    ):
        owner = session["user"]["id"]
        recipes_ready(owner)
        return recipes.list(owner, query, limit, offset)

    @app.post("/api/saved-recipes", status_code=201)
    def recipe_create(
        payload: RecipeBody,
        response: Response,
        session: Annotated[dict, Depends(require_user)],
        idempotency_key: Annotated[str | None, Header()] = None,
    ):
        owner = session["user"]["id"]
        recipes_ready(owner, True)
        recipe, created = recipe_call(lambda: recipes.create(owner, payload, idempotency_key))
        if not created:
            response.status_code = 200
        return recipe

    @app.get("/api/saved-recipes/{identity}/versions")
    def recipe_versions(identity: str, session: Annotated[dict, Depends(require_user)]):
        owner = session["user"]["id"]
        recipes_ready(owner)
        return recipe_call(lambda: recipes.versions(owner, identity))

    @app.get("/api/saved-recipes/{identity}")
    def recipe_get(identity: str, session: Annotated[dict, Depends(require_user)]):
        owner = session["user"]["id"]
        recipes_ready(owner)
        return recipe_call(lambda: recipes.get(owner, identity))

    @app.patch("/api/saved-recipes/{identity}")
    def recipe_patch(
        identity: str, payload: RecipePatch, session: Annotated[dict, Depends(require_user)]
    ):
        owner = session["user"]["id"]
        recipes_ready(owner, True)
        return recipe_call(lambda: recipes.patch(owner, identity, payload))

    @app.post("/api/saved-recipes/{identity}/duplicate", status_code=201)
    def recipe_duplicate(
        identity: str,
        payload: RecipeDuplicate,
        response: Response,
        session: Annotated[dict, Depends(require_user)],
        idempotency_key: Annotated[str | None, Header()] = None,
    ):
        owner = session["user"]["id"]
        recipes_ready(owner, True)
        recipe, created = recipe_call(
            lambda: recipes.duplicate(owner, identity, payload, idempotency_key)
        )
        if not created:
            response.status_code = 200
        return recipe

    @app.delete("/api/saved-recipes/{identity}", status_code=204)
    def recipe_delete(
        identity: str,
        expected_version: Annotated[int, Query(ge=1)],
        session: Annotated[dict, Depends(require_user)],
    ):
        owner = session["user"]["id"]
        recipes_ready(owner, True)
        recipe_call(lambda: recipes.delete(owner, identity, expected_version))
        return Response(status_code=204)

    def goals_ready():
        if not settings.goals_enabled or not goal_service.available():
            raise HTTPException(503, "Goals are not enabled on this server.")

    @app.get("/api/goals")
    def get_goals(session: Annotated[dict, Depends(require_user)]):
        goals_ready()
        return goal_service.get(session["user"]["id"])

    @app.put("/api/goals")
    def put_goals(payload: GoalUpdate, session: Annotated[dict, Depends(require_user)]):
        goals_ready()
        limiter.check("write:" + session["user"]["id"], 60, 60)
        try:
            return goal_service.put(session["user"]["id"], payload)
        except GoalConflict as error:
            raise HTTPException(409, str(error)) from None

    @app.get("/api/daily-summary")
    def daily_summary(date: JournalDate, session: Annotated[dict, Depends(require_user)]):
        goals_ready()
        return goal_service.daily(session["user"]["id"], date)

    @app.get("/api/admin/ai-budget")
    def ai_budget(session: Annotated[dict, Depends(require_user)]):
        if session["user"]["id"] not in settings.admin_user_ids:
            raise HTTPException(403, "Administrator access is required.")
        if gateway.available():
            try:
                return {"configured": True, **gateway.summary()}
            except VisionUnavailable:
                pass
        return {"configured": False, "enabled": False}

    @app.get("/api/analysis/references")
    def analysis_references(
        q: Annotated[str, Query(min_length=2, max_length=160)],
        session: Annotated[dict, Depends(require_user)],
    ):
        limiter.check("reference:" + session["user"]["id"], 60, 60)
        return {"foods": meal_analyzer.references.search(q, limit=8)}

    @app.post("/api/analyze-meal", response_model=AnalysisResult)
    async def analyze_meal(
        file: Annotated[UploadFile, File()],
        session: Annotated[dict, Depends(require_user)],
        second_file: Annotated[UploadFile | None, File()] = None,
        options: Annotated[str, Form(max_length=2048)] = "{}",
        idempotency_key: Annotated[str | None, Header()] = None,
    ):
        uploads = [file] + ([second_file] if second_file is not None else [])
        acquired = False
        try:
            if not idempotency_key or not IDEMPOTENCY_KEY.fullmatch(idempotency_key):
                raise HTTPException(422, "Provide a valid Idempotency-Key for meal analysis.")
            parsed = AnalysisOptions.model_validate_json(options)
            limiter.check("analyze:" + session["user"]["id"], 6, 60)
            acquired = image_slot.acquire(blocking=False)
            if not acquired:
                raise HTTPException(429, "Image processing is busy.", headers={"Retry-After": "3"})
            data = [await upload.read(MAX_UPLOAD_BYTES + 1) for upload in uploads]
            return await run_in_threadpool(
                meal_analyzer.analyze, data, parsed, session["user"]["id"], idempotency_key
            )
        except (InvalidImage, ValidationError) as error:
            raise HTTPException(422, "Check photo format, size and analysis options.") from error
        except VisionQuotaExceeded as error:
            raise HTTPException(429, str(error), headers={"Retry-After": "60"}) from None
        except VisionUnavailable as error:
            # Never log provider responses, user images or API credentials.
            raise HTTPException(503, str(error)) from None
        except ValueError as error:
            raise HTTPException(409, "This analysis key was used for different content.") from error
        finally:
            if acquired:
                image_slot.release()
            for upload in uploads:
                await upload.close()

    @app.post("/api/meals/analyzed", status_code=201)
    def analyzed_meal(
        payload: AnalyzedMealCreate,
        response: Response,
        session: Annotated[dict, Depends(require_user)],
        idempotency_key: Annotated[str | None, Header()] = None,
    ):
        if not idempotency_key or not IDEMPOTENCY_KEY.fullmatch(idempotency_key):
            raise HTTPException(422, "Provide a valid Idempotency-Key for the meal.")
        user_id = session["user"]["id"]
        limiter.check("write:" + user_id, 60, 60)
        try:
            saved, created = save_analyzed(
                journal, payload, meal_analyzer.references, user_id, idempotency_key
            )
        except AnalysisSaveConflict as error:
            raise HTTPException(409, str(error)) from error
        except (ValueError, KeyError) as error:
            raise HTTPException(
                422, "Choose valid nutrition records and confirm each food."
            ) from error
        if not created:
            response.status_code = 200
        return {"meals": saved}

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

    def save_once(response: Response, user_id: str, key: str | None, prepare):
        if key is not None and not IDEMPOTENCY_KEY.fullmatch(key):
            raise HTTPException(422, "Idempotency-Key must be 16–64 URL-safe characters.")
        key = key or uuid4().hex
        entry = prepare(key)
        if foundation.available():
            saved, created = meal_service.save_entries([entry], user_id, key, None, "legacy")
            if not created:
                response.status_code = 200
            return saved[0]
        # Compatibility with pre-foundation PostgreSQL; activation requires its migration.
        try:
            journal._insert(entry, user_id)
            return entry
        except sqlite3.IntegrityError:
            existing = journal.get_by_request(key, user_id=user_id)
            if existing is None:
                raise
            response.status_code = 200
            return existing

    @app.post("/api/meals", status_code=201)
    def add_meal(
        meal: MealCreate,
        response: Response,
        session: Annotated[dict, Depends(require_user)],
        idempotency_key: Annotated[str | None, Header()] = None,
    ):
        user_id = session["user"]["id"]
        limiter.check("write:" + user_id, 60, 60)
        try:
            return save_once(
                response,
                user_id,
                idempotency_key,
                lambda key: journal.prepare_catalog(
                    meal, catalog, user_id=user_id, request_key=key
                ),
            )
        except KeyError as error:
            raise HTTPException(404, "Choose a food from the catalog.") from error

    @app.post("/api/meals/custom", status_code=201)
    def custom_meal(
        meal: CustomMealCreate,
        response: Response,
        session: Annotated[dict, Depends(require_user)],
        idempotency_key: Annotated[str | None, Header()] = None,
    ):
        user_id = session["user"]["id"]
        limiter.check("write:" + user_id, 60, 60)
        if meal.barcode:
            try:
                validate_barcode(meal.barcode)
            except InvalidBarcode as error:
                raise HTTPException(422, str(error)) from error
        return save_once(
            response,
            user_id,
            idempotency_key,
            lambda key: journal.prepare_custom(meal, user_id=user_id, request_key=key),
        )

    def canonical_ready(owner, write=False):
        if not foundation.ready_for_owner(owner) or (write and not settings.canonical_writes):
            raise HTTPException(503, "Canonical journal is disabled or its backfill is incomplete.")

    @app.get("/api/copy-sources")
    def copy_sources(day: JournalDate, session: Annotated[dict, Depends(require_user)]):
        owner = session["user"]["id"]
        canonical_ready(owner)
        if not settings.copy_enabled:
            raise HTTPException(503, "Copy is not enabled on this server.")
        with database.connect() as db:
            from foodlogger.foundation import lock_owner

            lock_owner(database, db, owner)
            groups = db.execute(
                "SELECT * FROM meal_groups WHERE user_id=? AND local_date=? "
                "AND deleted_at IS NULL ORDER BY id",
                (owner, str(day)),
            ).fetchall()
            items = []
            for raw in groups:
                group = foundation.public(raw)
                item = library.meal(db, owner, group["id"])
                item.update(
                    favorite=False, entry_ids=[m["id"] for m in group["snapshot"].get("meals", [])]
                )
                items.append(item)
            return {"items": items}

    @app.post("/api/meals/copy")
    @app.post("/api/days/copy")
    def copy_logs(
        payload: CopyRequest,
        response: Response,
        session: Annotated[dict, Depends(require_user)],
        idempotency_key: Annotated[str | None, Header()] = None,
    ):
        owner = session["user"]["id"]
        canonical_ready(owner, write=True)
        from foodlogger.partial_migration import partial_storage_ready

        copying = Copying(meal_service)
        if (
            not settings.copy_enabled
            or not copying.available()
            or not partial_storage_ready(journal.database)
        ):
            raise HTTPException(503, "Copy is not enabled on this server.")
        limiter.check("write:" + owner, 60, 60)
        try:
            result, created = copying.run(owner, payload, idempotency_key)
            response.status_code = 201 if created else 200
            return result
        except MealConflict:
            raise
        except KeyError:
            raise HTTPException(404, "A selected meal no longer exists.") from None
        except ValueError as error:
            raise HTTPException(422, str(error)) from None

    @app.post("/api/meal-logs", status_code=201)
    def create_log(
        payload: MealLogCreate,
        response: Response,
        session: Annotated[dict, Depends(require_user)],
        idempotency_key: Annotated[str | None, Header()] = None,
    ):
        canonical_ready(session["user"]["id"], write=True)
        owner = session["user"]["id"]
        limiter.check("write:" + owner, 60, 60)
        try:
            draft = MealDraft.model_validate(payload.model_dump(exclude={"confirmed"}))
            group, created = meal_service.create(draft, owner, idempotency_key)
        except MealConflict:
            raise
        except ValueError as error:
            raise HTTPException(422, str(error)) from None
        if not created:
            response.status_code = 200
        return group

    @app.get("/api/meal-logs")
    def list_logs(day: JournalDate, session: Annotated[dict, Depends(require_user)]):
        canonical_ready(session["user"]["id"])
        return {"groups": foundation.list_groups(session["user"]["id"], str(day))}

    @app.get("/api/meal-logs/{group_id}")
    def get_log(group_id: str, session: Annotated[dict, Depends(require_user)]):
        canonical_ready(session["user"]["id"])
        group = meal_service.get(group_id, session["user"]["id"])
        if not group:
            raise HTTPException(404, "Meal no longer exists.")
        return group

    @app.patch("/api/meal-logs/{group_id}")
    def patch_log(
        group_id: str,
        payload: MealLogPatch,
        session: Annotated[dict, Depends(require_user)],
        idempotency_key: Annotated[str | None, Header()] = None,
    ):
        canonical_ready(session["user"]["id"], write=True)
        limiter.check("write:" + session["user"]["id"], 60, 60)
        try:
            return meal_service.patch(
                group_id,
                payload.draft,
                session["user"]["id"],
                payload.expected_version,
                idempotency_key,
            )
        except MealConflict:
            raise
        except KeyError:
            raise HTTPException(404, "Meal no longer exists.") from None
        except ValueError as error:
            raise HTTPException(422, str(error)) from None

    @app.delete("/api/meal-logs/{group_id}", status_code=204)
    def delete_log(
        group_id: str,
        session: Annotated[dict, Depends(require_user)],
        expected_version: Annotated[int, Query(ge=1)],
    ):
        canonical_ready(session["user"]["id"], write=True)
        try:
            meal_service.delete(group_id, session["user"]["id"], expected_version)
        except KeyError:
            raise HTTPException(404, "Meal no longer exists.") from None
        return Response(status_code=204)

    @app.get("/api/meals")
    def meals(
        day: JournalDate,
        session: Annotated[dict, Depends(require_user)],
        schema_version: Annotated[int, Query(ge=1, le=2)] = 1,
    ):
        from foodlogger.storage import summarize_entries

        entries = journal.list(day, user_id=session["user"]["id"])
        if schema_version == 1 and any(
            m["grams"] < 1 or any(m[k] is None for k in ("calories", "protein", "carbs", "fat"))
            for m in entries
        ):
            raise HTTPException(
                409, "Upgrade required: this day contains partial nutrition or tiny portions."
            )
        summary = summarize_entries(entries)
        if schema_version == 1:
            summary = {
                "count": len(entries),
                **{k: round(summary[k], 1) for k in ("calories", "protein", "carbs", "fat")},
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
