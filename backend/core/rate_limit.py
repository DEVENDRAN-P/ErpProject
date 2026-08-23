"""Simple in-memory rate limiter for FastAPI.

Limits requests per client IP to prevent abuse.
For production, replace with Redis-backed rate limiting.
"""

import os
import time
from collections import defaultdict
from typing import Callable, Dict, List, Tuple

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimitConfig:
    """Rate limit configuration."""

    # Default: 60 requests per minute
    DEFAULT_LIMIT = 60
    DEFAULT_WINDOW = 60  # seconds

    # Stricter limits for expensive endpoints
    STRICT_LIMITS: Dict[str, Tuple[int, int]] = {
        "/api/products/upload": (10, 60),        # 10 uploads/min
        "/api/workflow/process": (10, 60),       # 10 workflows/min
        "/api/products/url-ingest": (10, 60),    # 10 URL ingests/min
        "/api/products/ingest": (20, 60),        # 20 manual ingests/min
        "/api/products/*/export/json": (30, 60), # 30 exports/min
        "/api/products/*/export/csv": (30, 60),  # 30 exports/min
        "/api/products/*/validate": (20, 60),    # 20 validations/min
        "/api/products/*/health": (30, 60),      # 30 health checks/min
    }


class RateLimitMiddleware(BaseHTTPMiddleware):
    """In-memory sliding window rate limiter."""

    def __init__(self, app, config: RateLimitConfig = None):
        super().__init__(app)
        self.config = config or RateLimitConfig()
        self._requests: Dict[str, List[float]] = defaultdict(list)

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP, respecting X-Forwarded-For for proxied requests."""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _get_limit(self, path: str) -> Tuple[int, int]:
        """Get the rate limit for a specific path."""
        for pattern, (limit, window) in self.config.STRICT_LIMITS.items():
            # Simple pattern matching (supports * wildcard)
            if pattern.endswith("*"):
                if path.startswith(pattern[:-1]):
                    return limit, window
            elif path == pattern:
                return limit, window
        return self.config.DEFAULT_LIMIT, self.config.DEFAULT_WINDOW

    def _cleanup_old_entries(self, key: str, window: float):
        """Remove entries older than the window."""
        cutoff = time.time() - window
        self._requests[key] = [t for t in self._requests[key] if t > cutoff]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Apply rate limiting to each request."""
        # Skip rate limiting for health checks, root, WebSockets, and tests
        if os.environ.get("TESTING") == "1" or request.scope.get("type") == "websocket" or request.url.path in ("/", "/docs", "/openapi.json") or request.url.path.startswith("/api/ws"):
            return await call_next(request)

        client_ip = self._get_client_ip(request)
        path = request.url.path
        limit, window = self._get_limit(path)

        key = f"{client_ip}:{path}"
        now = time.time()

        self._cleanup_old_entries(key, window)
        self._requests[key].append(now)

        if len(self._requests[key]) > limit:
            return Response(
                content='{"detail":"Rate limit exceeded. Please try again later."}',
                status_code=429,
                media_type="application/json",
                headers={
                    "Retry-After": str(int(window)),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(
            max(0, limit - len(self._requests[key]))
        )
        return response
