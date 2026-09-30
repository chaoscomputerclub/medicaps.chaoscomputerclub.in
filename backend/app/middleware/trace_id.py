"""
Chaos Computer Club — Medi-Caps Chapter
app/middleware/trace_id.py — Distributed Trace ID & Request Correlation Middleware

Generates or propagates unique request correlation IDs across:
  HTTP Request (X-Request-ID header)
  -> FastAPI request.state.request_id
  -> ContextVar (available to any coroutine / service without prop drilling)
  -> Redis Queue JobContract (correlation_id)
  -> Worker logs & response headers
"""

from __future__ import annotations

import contextvars
import logging
from uuid import uuid4
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Thread-safe & async-safe context variable for the active trace ID
_trace_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("trace_id", default="")


def get_current_trace_id() -> str:
    """Return the active request trace ID for the current async task context."""
    val = _trace_id_ctx.get()
    return val if val else "system"


class TraceIdLogFilter(logging.Filter):
    """
    Log filter that injects `request_id` into every log record.
    Allows formatters to use `%(request_id)s`.
    """
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = get_current_trace_id()
        return True


class TraceIdMiddleware(BaseHTTPMiddleware):
    """
    Ensures every incoming request has an end-to-end trace ID.
    - Honors incoming 'X-Request-ID' or 'X-Trace-ID' if supplied (e.g. from upstream Nginx / Cloudflare).
    - Otherwise generates a clean UUID: 'req-{hex12}'.
    - Propagates into request.state.request_id, contextvars, and outgoing response headers.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        incoming_id = (
            request.headers.get("x-request-id")
            or request.headers.get("x-trace-id")
            or request.headers.get("x-correlation-id")
        )

        trace_id = incoming_id.strip() if incoming_id else f"req-{uuid4().hex[:12]}"

        # Bind to async context variable
        token = _trace_id_ctx.set(trace_id)

        # Bind to request state
        request.state.request_id = trace_id
        request.state.trace_id = trace_id

        try:
            response: Response = await call_next(request)
        finally:
            _trace_id_ctx.reset(token)

        # Echo back in response header
        response.headers["X-Request-ID"] = trace_id
        return response
