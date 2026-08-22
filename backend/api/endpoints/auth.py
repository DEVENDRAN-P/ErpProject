"""Legacy authentication endpoints — DISABLED.

Firebase Authentication is the ONLY authentication mechanism for NexGen.
These endpoints are disabled to prevent bypassing Firebase Auth security.
"""

from fastapi import APIRouter

router = APIRouter()


@router.post("/token")
def login_disabled():
    """Disabled — use Firebase Authentication instead."""
    return {
        "detail": "Legacy authentication is disabled. Use Firebase Authentication via the frontend."
    }


@router.post("/register")
def register_disabled():
    """Disabled — use Firebase Authentication instead."""
    return {
        "detail": "Legacy registration is disabled. Use Firebase Authentication via the frontend."
    }
