"""Routine tests may use MockTransport, never a real HTTPX network transport."""

import httpx
import pytest


@pytest.fixture(autouse=True)
def no_real_httpx_transport(monkeypatch):
    def blocked(*args, **kwargs):
        raise AssertionError("Real HTTP transport is disabled in tests; inject MockTransport.")

    async def async_blocked(*args, **kwargs):
        blocked(*args, **kwargs)

    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", blocked)
    monkeypatch.setattr(httpx.AsyncHTTPTransport, "handle_async_request", async_blocked)
