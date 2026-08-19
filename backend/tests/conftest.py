"""Pytest fixtures for ProductPilot AI backend tests.

Uses an isolated temporary SQLite database so tests never touch the
development database and work from a clean environment.
"""

import os
import sys
import tempfile

# Must be set before any backend import so db/session.py binds the test DB.
_TMP_DB_FD, _TMP_DB_PATH = tempfile.mkstemp(suffix=".db", prefix="productpilot_test_")
os.close(_TMP_DB_FD)
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP_DB_PATH.replace(os.sep, '/')}"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-not-for-production"

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.core.security import get_password_hash
from backend.db.session import SessionLocal
from backend.models.user import User


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:  # triggers lifespan: tables + reference data + demo seed
        yield c


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
    """Register + login a test user and return Authorization headers."""
    email = "tester@productpilot.ai"
    password = "testpass123"

    # Create the user directly (fast, deterministic)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                hashed_password=get_password_hash(password),
                full_name="Test Engineer",
                is_active=True,
            )
            db.add(user)
            db.commit()
    finally:
        db.close()

    resp = client.post(
        "/api/auth/token",
        data={"username": email, "password": password},
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
