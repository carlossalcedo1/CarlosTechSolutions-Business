"""Minimal per-IP rate limiting for the public form endpoints.

A fixed-window counter held in process memory. It resets on container
restart and doesn't share state across workers or replicas — an acceptable
trade for a single-container, single-worker deploy (see docker-compose in
Phase 5). If this ever runs with more than one worker, move the counters
somewhere shared instead of trusting this file, or push the limiting up into
Caddy.
"""

from __future__ import annotations

import time
from collections import defaultdict

from fastapi import HTTPException, Request


class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: float):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> None:
        now = time.monotonic()
        window_start = now - self.window_seconds
        hits = [t for t in self._hits[key] if t > window_start]
        hits.append(now)
        self._hits[key] = hits
        if len(hits) > self.max_requests:
            raise HTTPException(
                status_code=429, detail="Too many requests — try again shortly."
            )


def client_ip(request: Request) -> str:
    # Caddy sets X-Real-IP (see deploy/Caddyfile) since the API container
    # isn't reachable directly from the internet.
    forwarded = request.headers.get("x-real-ip")
    if forwarded:
        return forwarded
    return request.client.host if request.client else "unknown"
