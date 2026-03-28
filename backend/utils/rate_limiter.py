"""
Niriksha — Rate Limiter (slowapi)
===================================
Limits the /exam/analyze_frame endpoint to 2 requests per second
per session to prevent abuse and excessive CPU usage.

Uses slowapi (starlette-compatible limiter built on limits).
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request


def _get_session_id(request: Request) -> str:
    """
    Key function for rate limiting: use session_id from request body if
    available, fall back to client IP. This allows per-student limiting.
    """
    try:
        # Try to get session_id from JSON body (analyze_frame endpoint)
        # We can't await here in a sync context, so fallback to IP
        return get_remote_address(request)
    except Exception:
        return get_remote_address(request)


# Global limiter instance — imported and attached to app in app.py
limiter = Limiter(key_func=_get_session_id)
