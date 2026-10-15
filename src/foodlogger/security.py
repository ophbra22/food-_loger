"""HTTP deployment settings and bounded, per-process abuse protection."""

import os
import re
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
    canonical_writes: bool = False
    copy_enabled: bool = False
    recipe_writes: bool = False
    library_enabled: bool = False
    tracking_enabled: bool = False
    tracking_writes: bool = False
    recommendations_enabled: bool = False
    recommendation_writes: bool = False
    insights_enabled: bool = False
    trends_enabled: bool = False
    goals_enabled: bool = False
    food_sources_enabled: bool = False
    servings_enabled: bool = False
    label_ai_enabled: bool = False
    private_products_enabled: bool = False
    text_ai_enabled: bool = False
    ai_enabled: bool = False
    ai_project_id: str = "unconfigured"
    admin_user_ids: frozenset[str] = frozenset()

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

        def flag(name):
            value = os.getenv(name, "0").lower()
            if value not in {"0", "1", "false", "true"}:
                raise RuntimeError(f"{name} must be 0/1 or false/true.")
            return value in {"1", "true"}

        project = os.getenv("FOODLOGGER_AI_PROJECT_ID", "unconfigured")
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,160}", project):
            raise RuntimeError("FOODLOGGER_AI_PROJECT_ID must be a project identifier.")
        admins = frozenset(
            x.strip() for x in os.getenv("FOODLOGGER_ADMIN_USER_IDS", "").split(",") if x.strip()
        )
        if any(not re.fullmatch(r"[a-f0-9]{32}", user) for user in admins):
            raise RuntimeError("FOODLOGGER_ADMIN_USER_IDS must contain server user IDs.")
        return cls(
            canonical_writes=flag("FOODLOGGER_CANONICAL_WRITES"),
            copy_enabled=flag("FOODLOGGER_COPY_ENABLED"),
            recipe_writes=flag("FOODLOGGER_RECIPE_WRITES"),
            library_enabled=flag("FOODLOGGER_LIBRARY_ENABLED"),
            tracking_enabled=flag("FOODLOGGER_TRACKING_ENABLED"),
            tracking_writes=flag("FOODLOGGER_TRACKING_WRITES"),
            recommendations_enabled=flag("FOODLOGGER_RECOMMENDATIONS_ENABLED"),
            recommendation_writes=flag("FOODLOGGER_RECOMMENDATION_WRITES"),
            insights_enabled=flag("FOODLOGGER_INSIGHTS_ENABLED"),
            trends_enabled=flag("FOODLOGGER_TRENDS_ENABLED"),
            goals_enabled=flag("FOODLOGGER_GOALS_ENABLED"),
            food_sources_enabled=flag("FOODLOGGER_FOOD_SOURCES_ENABLED"),
            servings_enabled=flag("FOODLOGGER_SERVINGS_ENABLED"),
            label_ai_enabled=flag("FOODLOGGER_LABEL_AI_ENABLED"),
            private_products_enabled=flag("FOODLOGGER_PRIVATE_PRODUCTS_ENABLED"),
            text_ai_enabled=flag("FOODLOGGER_TEXT_AI_ENABLED"),
            ai_enabled=flag("FOODLOGGER_AI_ENABLED"),
            ai_project_id=project,
            admin_user_ids=admins,
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
