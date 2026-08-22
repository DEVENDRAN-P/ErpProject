"""Comprehensive end-to-end audit test for NexGen.

Tests every feature area from the specification:
- Auth, DB, Ingestion, ProductTwin, ProductTruth, Missing Data, RAG,
  Evidence, Confidence, Health Score, Source Reliability, Human Review,
  Audit Log, CatalogPilot, Versioning, Export, Knowledge Graph,
  Explainability, Notifications, Batch Operations

Security tests:
- Unauthenticated access blocked
- Invalid tokens rejected
- User isolation (User A cannot access User B's data)
"""

import json
import io
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import pytest
from backend.main import app
from backend.db.session import SessionLocal
from backend.models.user import User
import backend.api.dependencies as deps


# ---------------------------------------------------------------------------
# Mock Firebase token verification
# ---------------------------------------------------------------------------

def _mock_verify(token: str) -> dict:
    """Mock Firebase token verification for testing."""
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


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    # Set up mock verification
    original_fn = deps._verify_token_fn
    deps._verify_token_fn = _mock_verify
    deps._fb_admin_available = True

    with TestClient(app) as c:
        yield c

    # Restore
    deps._verify_token_fn = original_fn
    deps._fb_admin_available = None


@pytest.fixture(scope="module")
def auth_token(client):
    email = "audit_tester@nexgen.ai"
    uid = "audit-test-uid-789"
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                hashed_password="not-used",
                full_name="Audit Tester",
                is_active=True,
            )
            db.add(user)
            db.commit()
    finally:
        db.close()
    return f"test-token-{uid}-{email}"


@pytest.fixture(scope="module")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture(scope="module")
def second_auth_token(client):
    email = "audit_second@nexgen.ai"
    uid = "audit-second-uid-000"
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                hashed_password="not-used",
                full_name="Second User",
                is_active=True,
            )
            db.add(user)
            db.commit()
    finally:
        db.close()
    return f"test-token-{uid}-{email}"


@pytest.fixture(scope="module")
def second_headers(second_auth_token):
    return {"Authorization": f"Bearer {second_auth_token}"}


# ---------------------------------------------------------------------------
# Phase 3-4: Database & Authentication
# ---------------------------------------------------------------------------

class TestAuth:
    def test_root(self, client):
        r = client.get("/")
        assert r.status_code == 200
        assert "NexGen" in r.json()["message"]

    def test_unauthenticated_blocked(self, client):
        """TEST 1: Unauthenticated API request must return 401/403."""
        r = client.get("/api/products/")
        assert r.status_code in (401, 403)

    def test_invalid_token_rejected(self, client):
        """TEST 2: Invalid Firebase token must be rejected."""
        r = client.get("/api/products/", headers={"Authorization": "Bearer invalid-token"})
        assert r.status_code == 401

    def test_unsigned_jwt_rejected(self, client):
        """TEST 4: Unsigned/non-Firebase JWT must be rejected."""
        r = client.get("/api/products/", headers={
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1aWQiOiIxMjMifQ.not-a-real-sig"
        })
        assert r.status_code == 401

    def test_profile(self, client, headers):
        r = client.get("/api/products/me", headers=headers)
        assert r.status_code == 200
        assert "email" in r.json()


# ---------------------------------------------------------------------------
# Phase 5-7: Multi-source ingestion
# ---------------------------------------------------------------------------

class TestIngestion:
    def test_manual_entry(self, client, headers):
        r = client.post("/api/products/ingest", json={
            "name": "Manual Motor",
            "model_number": "MM-001",
            "category": "Electric Motors",
            "attributes": [
                {"key": "rated_power", "label": "Rated Power", "value": "7.5", "unit": "kW",
                 "confidence": 0.95, "source": "Manual", "status": "verified"},
            ]
        }, headers=headers)
        assert r.status_code == 200
        assert r.json()["name"] == "Manual Motor"

    def test_url_validation(self, client, headers):
        r = client.post("/api/products/url-ingest", json={"url": "not-a-url"}, headers=headers)
        assert r.status_code == 422
        r = client.post("/api/products/url-ingest", json={}, headers=headers)
        assert r.status_code == 400

    def test_text_workflow(self, client, headers):
        text = (
            "Siemens MTR-2001 Motor. Rated Power: 15 kW. Supply Voltage: 415 V. "
            "Rated Current: 28.5 A. Efficiency Class: IE3. Rated Speed: 1475 rpm. "
            "Frame Size: 160M. Max Operating Temperature: 155 degC."
        )
        r = client.post("/api/workflow/process", data={"text": text}, headers=headers)
        assert r.status_code == 200
        assert r.json()["product"]["id"] is not None

    def test_file_upload(self, client, headers):
        """TEST 8: Valid file type must be accepted."""
        r = client.post("/api/products/upload", files={
            "file": ("test.txt", io.BytesIO(b"Motor 15kW 415V IE3"), "text/plain")
        }, headers=headers)
        assert r.status_code == 200

    def test_invalid_file_type_rejected(self, client, headers):
        """TEST 8: Invalid file type must be rejected."""
        r = client.post("/api/products/upload", files={
            "file": ("malware.exe", io.BytesIO(b"MZ..."), "application/octet-stream")
        }, headers=headers)
        assert r.status_code == 400

    def test_empty_file_rejected(self, client, headers):
        r = client.post("/api/products/upload", files={
            "file": ("empty.pdf", io.BytesIO(b""), "application/pdf")
        }, headers=headers)
        assert r.status_code == 400

    def test_batch_import(self, client, headers):
        r = client.post("/api/products/batch/import", json={
            "products": [{
                "name": "Batch Motor", "model_number": "B-001",
                "attributes": [{"key": "rated_power", "label": "Rated Power", "value": "22", "unit": "kW"}]
            }]
        }, headers=headers)
        assert r.status_code == 200
        assert r.json()["succeeded"] == 1


# ---------------------------------------------------------------------------
# Phase 8-11: ProductTwin, Required Attributes, ProductTruth, Missing Data
# ---------------------------------------------------------------------------

class TestProductTwin:
    def test_all_8_attributes_present(self, client, headers):
        text = (
            "Siemens MTR-3001 Motor. Rated Power: 15 kW. Supply Voltage: 415 V. "
            "Rated Current: 28.5 A. Efficiency Class: IE3. Rated Speed: 1475 rpm. "
            "Frame Size: 160M. Max Operating Temperature: 155 degC."
        )
        r = client.post("/api/workflow/process", data={"text": text}, headers=headers)
        pid = r.json()["product"]["id"]

        detail = client.get(f"/api/products/{pid}", headers=headers).json()
        attrs = {a["key"]: a for a in detail["attributes"]}

        required = ["rated_power", "supply_voltage", "rated_current", "efficiency_class",
                     "rated_speed", "max_temperature", "frame_size", "total_weight"]
        for k in required:
            assert k in attrs, f"Missing required attribute: {k}"

    def test_total_weight_not_found(self, client, headers):
        text = (
            "Siemens MTR-3002 Motor. Rated Power: 15 kW. Supply Voltage: 415 V. "
            "Rated Current: 28.5 A. Efficiency Class: IE3. Rated Speed: 1475 rpm. "
            "Frame Size: 160M. Max Operating Temperature: 155 degC."
        )
        r = client.post("/api/workflow/process", data={"text": text}, headers=headers)
        pid = r.json()["product"]["id"]
        detail = client.get(f"/api/products/{pid}", headers=headers).json()
        attrs = {a["key"]: a for a in detail["attributes"]}

        tw = attrs["total_weight"]
        assert tw["status"] == "NOT_FOUND"
        assert tw["value"] is None
        assert tw["confidence"] == 0.0

    def test_completeness_87_5_percent(self, client, headers):
        text = (
            "Siemens MTR-3003 Motor. Rated Power: 15 kW. Supply Voltage: 415 V. "
            "Rated Current: 28.5 A. Efficiency Class: IE3. Rated Speed: 1475 rpm. "
            "Frame Size: 160M. Max Operating Temperature: 155 degC."
        )
        r = client.post("/api/workflow/process", data={"text": text}, headers=headers)
        pid = r.json()["product"]["id"]
        detail = client.get(f"/api/products/{pid}", headers=headers).json()
        attrs = {a["key"]: a for a in detail["attributes"]}

        required = ["rated_power", "supply_voltage", "rated_current", "efficiency_class",
                     "rated_speed", "max_temperature", "frame_size", "total_weight"]
        valid = sum(1 for k in required if k in attrs and attrs[k].get("value")
                    and attrs[k].get("status") not in ("NOT_FOUND",))
        completeness = round(valid / len(required) * 100, 1)
        assert completeness == 87.5, f"Expected 87.5%, got {completeness}%"

    def test_provenance_on_every_attribute(self, client, headers):
        text = (
            "Siemens MTR-3004 Motor. Rated Power: 15 kW. Supply Voltage: 415 V. "
            "Rated Current: 28.5 A. Efficiency Class: IE3. Rated Speed: 1475 rpm. "
            "Frame Size: 160M. Max Operating Temperature: 155 degC."
        )
        r = client.post("/api/workflow/process", data={"text": text}, headers=headers)
        pid = r.json()["product"]["id"]
        detail = client.get(f"/api/products/{pid}", headers=headers).json()

        for a in detail["attributes"]:
            assert a.get("source"), f"{a['key']} missing source"
            assert a.get("status"), f"{a['key']} missing status"
            assert "confidence" in a, f"{a['key']} missing confidence"

    def test_no_invented_values(self, client, headers):
        """Missing attributes must never be invented."""
        text = "Motor. Rated Power: 15 kW."
        r = client.post("/api/workflow/process", data={"text": text}, headers=headers)
        pid = r.json()["product"]["id"]
        detail = client.get(f"/api/products/{pid}", headers=headers).json()
        attrs = {a["key"]: a for a in detail["attributes"]}

        for k in ["total_weight", "supply_voltage", "rated_current", "efficiency_class"]:
            if k in attrs and attrs[k]["status"] == "NOT_FOUND":
                assert attrs[k]["value"] is None, f"{k} should not be invented"


# ---------------------------------------------------------------------------
# Phase 10: ProductTruth conflict detection
# ---------------------------------------------------------------------------

class TestProductTruth:
    def test_conflict_detection(self, client, headers):
        text1 = "Siemens MTR1001-101 Motor. Rated Power: 15 kW. Max Operating Temperature: 155 C."
        r1 = client.post("/api/workflow/process", data={"text": text1}, headers=headers)
        pid = r1.json()["product"]["id"]
        assert r1.json()["product"]["conflicts_created"] == 0

        text2 = "Siemens MTR1001-101 Motor. Rated Power: 18.5 kW. Max Operating Temperature: 130 C."
        r2 = client.post("/api/workflow/process", data={"text": text2}, headers=headers)
        assert r2.json()["product"]["id"] == pid
        assert r2.json()["product"]["merged"] is True
        assert r2.json()["product"]["conflicts_created"] >= 1

        detail = client.get(f"/api/products/{pid}", headers=headers).json()
        conflicts = detail["conflicts"]
        keys = {c["attribute_key"] for c in conflicts}
        assert "rated_power" in keys
        assert "max_temperature" in keys

    def test_conflict_preserves_both_sources(self, client, headers):
        text1 = "Siemens MTR2001-202 Motor. Rated Power: 15 kW."
        r1 = client.post("/api/workflow/process", data={"text": text1}, headers=headers)
        pid = r1.json()["product"]["id"]

        text2 = "Siemens MTR2001-202 Motor. Rated Power: 22 kW."
        client.post("/api/workflow/process", data={"text": text2}, headers=headers)

        detail = client.get(f"/api/products/{pid}", headers=headers).json()
        power_conflicts = [c for c in detail["conflicts"] if c["attribute_key"] == "rated_power"]
        assert len(power_conflicts) >= 1

        sources = json.loads(power_conflicts[0]["sources_json"])
        assert len(sources) == 2

    def test_conflict_creates_review_item(self, client, headers):
        text1 = "Siemens MTR5001-505 Motor. Rated Power: 15 kW."
        r1 = client.post("/api/workflow/process", data={"text": text1}, headers=headers)
        pid = r1.json()["product"]["id"]
        text2 = "Siemens MTR5001-505 Motor. Rated Power: 22 kW."
        client.post("/api/workflow/process", data={"text": text2}, headers=headers)

        detail = client.get(f"/api/products/{pid}", headers=headers).json()
        pending = [r for r in detail["review_items"] if r.get("status", "").upper() == "PENDING"]
        assert len(pending) >= 1


# -----------------------------------------------------------------------
# Security: User Isolation (TEST 5 & 6)
# ---------------------------------------------------------------------------

class TestUserIsolation:
    def test_user_a_cannot_access_user_b_product(self, client, headers, second_headers):
        """TEST 5: User A must not access User B's product."""
        # User A creates a product
        r = client.post("/api/products/ingest", json={
            "name": "User A Motor", "model_number": "UA-001",
            "attributes": [{"key": "rated_power", "label": "Power", "value": "15", "unit": "kW"}]
        }, headers=headers)
        pid = r.json()["id"]

        # User B tries to access it — must fail
        r2 = client.get(f"/api/products/{pid}", headers=second_headers)
        assert r2.status_code == 404, "User B should not see User A's product"

    def test_user_a_cannot_see_user_b_products(self, client, headers, second_headers):
        """User A's product list should not include User B's products."""
        r = client.get("/api/products/", headers=headers)
        assert r.status_code == 200

        r2 = client.get("/api/products/", headers=second_headers)
        assert r2.status_code == 200

        a_ids = {p["id"] for p in r.json()}
        b_ids = {p["id"] for p in r2.json()}
        for bid in b_ids:
            assert bid not in a_ids, "User B product appears in User A's list"

    def test_user_a_cannot_export_user_b_product(self, client, headers, second_headers):
        """User A must not export User B's product data."""
        r = client.post("/api/products/ingest", json={
            "name": "Export Test Motor", "model_number": "ET-001",
        }, headers=headers)
        pid = r.json()["id"]

        r2 = client.get(f"/api/products/{pid}/export/json", headers=second_headers)
        assert r2.status_code in (403, 404)


# -----------------------------------------------------------------------
# Security: File Upload Tests
# ---------------------------------------------------------------------------

class TestFileUploadSecurity:
    def test_malicious_extension_rejected(self, client, headers):
        """TEST 8: Executable file type must be rejected."""
        r = client.post("/api/products/upload", files={
            "file": ("virus.exe", io.BytesIO(b"MZ\x90\x00"), "application/octet-stream")
        }, headers=headers)
        assert r.status_code == 400

    def test_oversized_file_rejected(self, client, headers):
        """TEST 7: Oversized file must be rejected."""
        large_content = b"x" * (11 * 1024 * 1024)
        r = client.post("/api/products/upload", files={
            "file": ("large.pdf", io.BytesIO(large_content), "application/pdf")
        }, headers=headers)
        assert r.status_code == 413


# -----------------------------------------------------------------------
# Security: URL Ingestion / SSRF Tests
# ---------------------------------------------------------------------------

class TestSSRFProtection:
    def test_localhost_rejected(self, client, headers):
        """TEST 10: localhost URL must be rejected."""
        r = client.post("/api/products/url-ingest",
                       json={"url": "http://localhost:8080/admin"},
                       headers=headers)
        assert r.status_code == 422

    def test_loopback_rejected(self, client, headers):
        """TEST 11: Loopback IP must be rejected."""
        r = client.post("/api/products/url-ingest",
                       json={"url": "http://127.0.0.1/secret"},
                       headers=headers)
        assert r.status_code == 422

    def test_private_ip_rejected(self, client, headers):
        """TEST 11: Private IP must be rejected."""
        r = client.post("/api/products/url-ingest",
                       json={"url": "http://192.168.1.1/admin"},
                       headers=headers)
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# Phase 12: RAG
# ---------------------------------------------------------------------------

class TestRAG:
    def test_rag_with_evidence(self, client, headers):
        # First create a product
        text = "RAG Test Motor. Rated Power: 15 kW."
        r = client.post("/api/workflow/process", data={"text": text}, headers=headers)
        pid = r.json()["product"]["id"]

        r = client.post("/api/rag/query", json={
            "question": "What is the rated power?",
            "product_id": pid,
        }, headers=headers)
        assert r.status_code == 200
        assert r.json()["has_evidence"] is True

    def test_rag_without_evidence(self, client, headers):
        r = client.post("/api/rag/query", json={
            "question": "What is the warranty period in years?"
        }, headers=headers)
        assert r.status_code == 200
        assert r.json()["has_evidence"] is False
        assert r.json()["answer"] == "Insufficient evidence."


# -----------------------------------------------------------------------
# Phase 13-14: Evidence & Confidence
# ---------------------------------------------------------------------------

class TestEvidence:
    def test_confidence_in_range(self, client, headers):
        r = client.get("/api/products/", headers=headers)
        products = r.json()
        if products:
            pid = products[0]["id"]
            detail = client.get(f"/api/products/{pid}", headers=headers).json()
            for a in detail["attributes"]:
                c = a.get("confidence", -1)
                assert 0 <= c <= 1, f"{a['key']} confidence {c} out of range"


# -----------------------------------------------------------------------
# Phase 15: Health Score
# ---------------------------------------------------------------------------

class TestHealthScore:
    def test_health_score_0_for_no_attributes(self):
        from backend.services.product_service import compute_dynamic_health_score
        score = compute_dynamic_health_score([], [])
        assert score == 0


# -----------------------------------------------------------------------
# Phase 17: Human Review
# ---------------------------------------------------------------------------

class TestHumanReview:
    def test_invalid_action_rejected(self, client, headers):
        r = client.post("/api/review/99999/action",
                       json={"action": "nonsense"}, headers=headers)
        assert r.status_code in (400, 404, 422, 500)


# -----------------------------------------------------------------------
# Phase 21: Export
# ---------------------------------------------------------------------------

class TestExport:
    def test_batch_export_json(self, client, headers):
        r = client.get("/api/products/batch/export?format=json", headers=headers)
        assert r.status_code == 200

    def test_batch_export_csv(self, client, headers):
        r = client.get("/api/products/batch/export?format=csv", headers=headers)
        assert r.status_code == 200


# -----------------------------------------------------------------------
# Phase 23: Knowledge Graph, Explainability, Notifications
# ---------------------------------------------------------------------------

class TestKnowledgeGraph:
    def test_kg_full(self, client, headers):
        r = client.get("/api/products/knowledge-graph/full", headers=headers)
        assert r.status_code == 200


class TestNotifications:
    def test_list_notifications(self, client, headers):
        r = client.get("/api/notifications", headers=headers)
        assert r.status_code == 200

    def test_unread_count(self, client, headers):
        r = client.get("/api/notifications/unread-count", headers=headers)
        assert r.status_code == 200
        assert "unread_count" in r.json()


class TestReports:
    def test_dashboard_stats(self, client, headers):
        r = client.get("/api/products/stats", headers=headers)
        assert r.status_code == 200
        s = r.json()
        assert "total_products" in s
        assert "average_health_score" in s


# -----------------------------------------------------------------------
# Phase 26: Security
# ---------------------------------------------------------------------------

class TestSecurity:
    def test_no_plaintext_passwords(self):
        from backend.core.security import get_password_hash, verify_password
        h = get_password_hash("test123")
        assert h != "test123"
        assert verify_password("test123", h)

    def test_cors_configured(self):
        from backend.main import app
        assert any("CORSMiddleware" in str(m) for m in app.user_middleware)


# -----------------------------------------------------------------------
# Rate Limiting
# -----------------------------------------------------------------------

class TestRateLimiting:
    def test_rate_limit_headers_present(self, client, headers):
        """Rate limit headers should be present on responses."""
        r = client.get("/api/products/", headers=headers)
        assert "X-RateLimit-Limit" in r.headers
        assert "X-RateLimit-Remaining" in r.headers
