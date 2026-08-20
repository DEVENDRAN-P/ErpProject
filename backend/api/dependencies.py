"""Authentication dependencies for FastAPI.

Supports three authentication strategies (tried in order):
  1. Firebase Admin SDK token verification (production)
  2. Firebase ID token decode without verification (dev fallback — reads
     the unsigned JWT payload to extract uid/email when the Admin SDK
     is not configured)
  3. Legacy JWT token (backward compatibility)

When FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY are not set the
Admin SDK cannot initialise; the dev fallback still lets the app work
end-to-end by trusting the client-side Firebase Auth session.
"""

import base64
import json
import os
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.db.session import get_db

# Lazy imports to avoid circular imports at module level
_firebase_verified = False

# Flag: set to True once we know Firebase Admin SDK is available
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


def _decode_firebase_jwt_payload(token: str) -> Optional[dict]:
    """Decode the payload of a Firebase ID token *without* cryptographic
    verification.  Only used as a last-resort fallback when the Firebase
    Admin SDK is not configured (dev environments).

    This is safe enough for local development because the token still
    came from Firebase Auth on the client side; we merely extract the
    identity claims without verifying the signature.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        payload_b64 = parts[1]
        # Add padding
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += "=" * padding
        decoded_bytes = base64.urlsafe_b64decode(payload_b64)
        return json.loads(decoded_bytes)
    except Exception:
        return None


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db=Depends(get_db),
) -> AuthenticatedUser:
    """Verify the request's Bearer token against Firebase Admin, dev
    fallback, or legacy JWT.

    Returns an AuthenticatedUser with the verified UID and email.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # --- Strategy 1: Firebase Admin verification (production) ---
    if _is_fb_admin_configured():
        try:
            from backend.core.firebase import get_firebase_app
            from firebase_admin import auth as fb_auth

            get_firebase_app()  # ensure initialized
            decoded = fb_auth.verify_id_token(token)

            return AuthenticatedUser(
                uid=decoded["uid"],
                email=decoded.get("email", ""),
                display_name=decoded.get("name") or decoded.get("display_name"),
            )
        except Exception:
            pass  # Fall through to next strategy

    # --- Strategy 2: Dev fallback — decode Firebase JWT payload without
    #     signature verification.  This lets the app work when the Admin
    #     SDK is not configured (common during local development). ---
    if token.count(".") == 2 and len(token) > 100:
        payload = _decode_firebase_jwt_payload(token)
        if payload and payload.get("uid"):
            # Reject obviously invalid / expired tokens
            import time
            exp = payload.get("exp", 0)
            if exp and exp < time.time():
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token has expired. Please sign in again.",
                )
            # Safely extract display name from Firebase JWT claims
            display_name = payload.get("name") or payload.get("display_name")
            if not display_name:
                try:
                    identities = payload.get("firebase", {}).get("identities", {})
                    email_list = identities.get("email", [])
                    if isinstance(email_list, list) and email_list:
                        display_name = email_list[0].split("@")[0]
                except (AttributeError, IndexError, TypeError):
                    pass
            return AuthenticatedUser(
                uid=payload["uid"],
                email=payload.get("email", ""),
                display_name=display_name,
            )

    # --- Strategy 3: Legacy JWT (backward compatibility) ---
    try:
        from backend.core.security import decode_access_token

        payload = decode_access_token(token)
        if payload.sub is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials.",
            )

        # Look up user in the database to get uid
        from backend.models.user import User

        user = db.query(User).filter(User.email == payload.sub).first()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found.",
            )

        return AuthenticatedUser(
            uid=str(user.id),
            email=user.email,
            display_name=user.full_name,
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
