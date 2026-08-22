"""Authentication dependencies for FastAPI.

Firebase Authentication is the ONLY authentication mechanism.
Tokens are verified cryptographically via Firebase Admin SDK.

If Firebase Admin SDK credentials are not configured, the backend
REJECTS all requests with 401 — no insecure fallback is allowed.
"""

import os
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.db.session import get_db

_fb_admin_available: Optional[bool] = None


def _is_fb_admin_configured() -> bool:
    """Check once whether Firebase Admin SDK credentials are present."""
    global _fb_admin_available
    if _fb_admin_available is not None:
        return _fb_admin_available
    _fb_admin_available = bool(
        os.environ.get("FIREBASE_CLIENT_EMAIL")
        and os.environ.get("FIREBASE_PRIVATE_KEY")
    ) or bool(os.environ.get("FIREBASE_SERVICE_ACCOUNT"))
    return _fb_admin_available


@dataclass
class AuthenticatedUser:
    """A simplified representation of the authenticated user."""
    uid: str
    email: str
    display_name: Optional[str] = None


security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db=Depends(get_db),
) -> AuthenticatedUser:
    """Verify the request's Bearer token using Firebase Admin SDK ONLY.

    No unsigned JWT decoding, no legacy JWT, no fallback users.
    If Firebase Admin SDK is not configured, all requests are rejected.
    """
    token = credentials.credentials if credentials else None

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Require Firebase Admin SDK — no insecure fallbacks
    if not _is_fb_admin_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase Admin SDK is not configured. Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY environment variables.",
        )

    # Verify the token cryptographically using Firebase Admin SDK
    try:
        from backend.core.firebase import get_firebase_app
        from firebase_admin import auth as fb_auth

        firebase_app = get_firebase_app()
        if firebase_app is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Firebase Admin SDK failed to initialize.",
            )

        decoded = fb_auth.verify_id_token(token)

        return AuthenticatedUser(
            uid=decoded["uid"],
            email=decoded.get("email", ""),
            display_name=decoded.get("name") or decoded.get("display_name"),
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
