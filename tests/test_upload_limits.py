import asyncio

from foodlogger.app import BodyLimitMiddleware


def test_upload_slot_is_reserved_before_reading_body_and_released_on_disconnect():
    async def scenario():
        entered, release = asyncio.Event(), asyncio.Event()
        responses = []

        async def app(scope, receive, send):
            await send({"type": "http.response.start", "status": 204, "headers": []})
            await send({"type": "http.response.body", "body": b""})

        middleware = BodyLimitMiddleware(app)
        scope = {"type": "http", "method": "POST", "path": "/api/predict"}

        async def held_receive():
            entered.set()
            await release.wait()
            return {"type": "http.disconnect"}

        async def forbidden_receive():
            raise AssertionError("Rejected upload must not be buffered")

        async def send(message):
            responses.append(message)

        first = asyncio.create_task(middleware(scope, held_receive, send))
        await entered.wait()
        await middleware({**scope, "path": "/api/barcode/scan"}, forbidden_receive, send)
        assert responses[0]["status"] == 429
        release.set()
        await first
        responses.clear()

        async def empty_receive():
            return {"type": "http.request", "body": b"", "more_body": False}

        await middleware(scope, empty_receive, send)
        assert responses[0]["status"] == 204

    asyncio.run(scenario())


def test_stalled_upload_expires_and_releases_slot(monkeypatch):
    async def scenario():
        async def app(scope, receive, send):
            await send({"type": "http.response.start", "status": 204, "headers": []})

        middleware = BodyLimitMiddleware(app)
        middleware.body_timeout = 0.02
        responses = []

        async def stalled_receive():
            await asyncio.Event().wait()

        async def send(message):
            responses.append(message)

        scope = {"type": "http", "method": "POST", "path": "/api/predict"}
        await asyncio.wait_for(middleware(scope, stalled_receive, send), timeout=1)
        assert responses[0]["status"] == 408
        assert middleware.upload_slot.acquire(blocking=False)
        middleware.upload_slot.release()

    asyncio.run(scenario())


def test_unauthenticated_upload_is_rejected_without_reading_or_reserving():
    class Auth:
        def get_session(self, token):
            return None

    async def scenario():
        async def app(scope, receive, send):
            raise AssertionError("Unauthenticated upload reached parser")

        middleware = BodyLimitMiddleware(app, auth=Auth())
        responses = []

        async def receive():
            raise AssertionError("Unauthenticated upload body was read")

        async def send(message):
            responses.append(message)

        scope = {"type": "http", "method": "POST", "path": "/api/predict", "headers": []}
        await middleware(scope, receive, send)
        assert responses[0]["status"] == 401
        assert middleware.upload_slot.acquire(blocking=False)
        middleware.upload_slot.release()

    asyncio.run(scenario())
