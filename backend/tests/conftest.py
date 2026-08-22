"""Pytest fixtures for NexGen backend tests.

Uses an isolated temporary SQLite database so tests never touch the
development database and work from a clean environment.

Firebase Admin SDK is mocked for testing — no real Firebase credentials needed.
"""

import os
import sys
import tempfile
import time

# Must be set before any backend import so db/session.py binds the test DB.
_TMP_DB_FD, _TMP_DB_PATH = tempfile.mkstemp(suffix=".db", prefix="nexgen_test_")
os.close(_TMP_DB_FD)
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP_DB_PATH.replace(os.sep, '/')}"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-not-for-production"

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from backend.main import app
from backend.db.session import SessionLocal
from backend.models.user import User


# ── Mock Firebase Admin SDK for testing ────────────────────────────────────
def _mock_verify_id_token(token: str):
    """Mock Firebase token verification for testing."""
    # Token format: "test-token-{uid}-{email}"
    if not token.startswith("test-token-"):
        raise Exception("Invalid mock token format")

    parts = token.split("-", 3)
    if len(parts) < 4:
        raise Exception("Invalid mock token format")

    return {
        "uid": parts[2],
        "email": parts[3],
        "name": "Test User",
    }


@pytest.fixture(scope="session")
def client():
    import backend.api.dependencies as deps

    # Override the token verification function for testing
    original_verify_fn = deps._verify_token_fn
    original_fb_available = deps._fb_admin_available

    deps._verify_token_fn = _mock_verify_id_token
    deps._fb_admin_available = True

    try:
        with TestClient(app) as c:
            yield c
    finally:
        deps._verify_token_fn = original_verify_fn
        deps._fb_admin_available = original_fb_available


@pytest.fixture()
def db_session():
    """A fresh DB session bound to the isolated test database."""
    from backend.db.session import SessionLocal

    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


@pytest.fixture(scope="session")
def auth_headers(client):
    """Create a test user and return Authorization headers with a mock Firebase token."""
    email = "tester@nexgen.ai"
    uid = "test-uid-tester-123"

    # Create the user directly in the database
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                hashed_password="not-used-firebase-auth",
                full_name="Test Engineer",
                is_active=True,
            )
            db.add(user)
            db.commit()
    finally:
        db.close()

    # Create a mock Firebase token
    token = f"test-token-{uid}-{email}"
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def second_user_headers(client):
    """Create a second test user for cross-user isolation tests."""
    email = "second@nexgen.ai"
    uid = "test-uid-second-456"

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                hashed_password="not-used-firebase-auth",
                full_name="Second User",
                is_active=True,
            )
            db.add(user)
            db.commit()
    finally:
        db.close()

    token = f"test-token-{uid}-{email}"
    return {"Authorization": f"Bearer {token}"}
