"""HTTP deployment settings and bounded, per-process abuse protection."""

import os
import threading
import time
from collections import OrderedDict, deque
from dataclasses import dataclass
from ipaddress import ip_address
from urllib.parse import urlsplit

from fastapi import HTTPException, Request


@dataclass(frozen=True)
class Settings:
    production: bool = False
    public_url: str | None = None
    trusted_proxy_hops: int = 0

    @classmethod
    def from_environment(cls):
        production = os.getenv("FOODLOGGER_ENV", "development") == "production"
        url = os.getenv("FOODLOGGER_PUBLIC_URL") or os.getenv("RENDER_EXTERNAL_URL")
        if production:
            parsed = urlsplit(url or "")
            if parsed.scheme != "https" or not parsed.netloc or parsed.path not in {"", "/"}:
                raise RuntimeError("Set FOODLOGGER_PUBLIC_URL to the public HTTPS origin.")
            if not os.getenv("DATABASE_URL") and not os.path.isabs(os.getenv("FOODLOGGER_DB", "")):
                raise RuntimeError("Set FOODLOGGER_DB to an absolute path on persistent storage.")
        hops = int(os.getenv("FOODLOGGER_TRUSTED_PROXY_HOPS", "0"))
        if not 0 <= hops <= 8:
            raise RuntimeError("FOODLOGGER_TRUSTED_PROXY_HOPS must be between 0 and 8.")
        return cls(
            production=production,
            public_url=url.rstrip("/") if url else None,
            trusted_proxy_hops=hops,
        )

    def client_address(self, request: Request) -> str:
        # Only enable behind a controlled proxy that appends the connecting IP.
        # Select from the right: user-supplied prefixes must not evade limits.
        if self.trusted_proxy_hops:
            forwarded = ",".join(request.headers.getlist("x-forwarded-for")).split(",")
            if len(forwarded) >= self.trusted_proxy_hops:
                try:
                    return str(ip_address(forwarded[-self.trusted_proxy_hops].strip()))
                except ValueError:
                    pass
        return request.client.host if request.client else "unknown"


class RateLimiter:
    """Single-worker deployment limiter with bounded memory and fixed time windows."""

    def __init__(self, max_keys=4096):
        self._entries = OrderedDict()
        self._lock = threading.Lock()
        self._max_keys = max_keys

    def check(self, key: str, limit: int, seconds: int):
        now = time.monotonic()
        with self._lock:
            timestamps = self._entries.setdefault(key, deque())
            self._entries.move_to_end(key)
            while timestamps and timestamps[0] <= now - seconds:
                timestamps.popleft()
            if len(timestamps) >= limit:
                raise HTTPException(
                    429,
                    "Too many requests. Please try again later.",
                    headers={"Retry-After": str(seconds)},
                )
            timestamps.append(now)
            while len(self._entries) > self._max_keys:
                self._entries.popitem(last=False)
