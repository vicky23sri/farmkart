"""
Lightweight in-process rate limiting.

Limits are enforced per worker process. With N gunicorn workers the effective limit is up to
N x the configured value, which is still enough to stop brute-force and spam attacks. For a
strict global limit, place the API behind a gateway/WAF rate limit as well.
"""

import threading
import time
from collections import defaultdict, deque
from typing import Callable, Deque, Dict

from fastapi import HTTPException, Request, status

from app.core.config import settings


def client_ip(request: Request) -> str:
    """
    Client IP as seen by the ASGI server.

    X-Forwarded-For is only honoured when the server was started with trusted proxy IPs
    (gunicorn/uvicorn `--forwarded-allow-ips`), which rewrites `request.client` for us.
    Reading the header directly would let any client spoof its IP and bypass limits.
    """
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()
        self._last_sweep = time.monotonic()

    def hit(self, key: str, limit: int, window_seconds: int) -> bool:
        """Record a hit for `key`; return False if the limit is exceeded."""
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            if now - self._last_sweep > 300:
                self._sweep(now)
            hits = self._hits[key]
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= limit:
                return False
            hits.append(now)
            return True

    def _sweep(self, now: float) -> None:
        # Drop keys with no hits in the last hour to bound memory use.
        stale = [k for k, v in self._hits.items() if not v or v[-1] < now - 3600]
        for k in stale:
            del self._hits[k]
        self._last_sweep = now

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = SlidingWindowLimiter()


def rate_limit(scope: str, limit: int, window_seconds: int) -> Callable[[Request], None]:
    """FastAPI dependency enforcing `limit` requests per `window_seconds` per client IP."""

    def dependency(request: Request) -> None:
        if not settings.RATE_LIMIT_ENABLED:
            return
        key = f"{scope}:{client_ip(request)}"
        if not limiter.hit(key, limit, window_seconds):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please wait a moment and try again.",
                headers={"Retry-After": str(window_seconds)},
            )

    return dependency


def check_identifier_limit(scope: str, identifier: str, limit: int, window_seconds: int) -> None:
    """Per-identifier limit (e.g. per email) to slow down credential stuffing across IPs."""
    if not settings.RATE_LIMIT_ENABLED:
        return
    if not limiter.hit(f"{scope}:{identifier}", limit, window_seconds):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts for this account. Please try again later.",
            headers={"Retry-After": str(window_seconds)},
        )
