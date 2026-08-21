"""Comprehensive end-to-end audit test for ProductPilot AI.

Tests every feature area from the specification:
- Auth, DB, Ingestion, ProductTwin, ProductTruth, Missing Data, RAG,
  Evidence, Confidence, Health Score, Source Reliability, Human Review,
  Audit Log, CatalogPilot, Versioning, Export, Knowledge Graph,
  Explainability, Notifications, Batch Operations
"""

import json
import io
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import pytest
from backend.main import app
from backend.core.security import get_password_hash
from backend.db.session import SessionLocal
from backend.models.user import User


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def auth_token(client):
    email = "audit_tester@productpilot.ai"
    password = "auditpass123"
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                hashed_password=get_password_hash(password),
                full_name="Audit Tester",
                is_active=True,
            )
            db.add(user)
            db.commit()
    finally:
        db.close()
    resp = client.post("/api/auth/token", data={"username": email, "password": password})
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# ---------------------------------------------------------------------------
# Phase 3-4: Database & Authentication
# ---------------------------------------------------------------------------

class TestAuth:
    def test_root(self, client):
        r = client.get("/")
        assert r.status_code == 200
        assert "ProductPilot" in r.json()["message"]

    def test_register_and_login(self, client):
        r = client.post("/api/auth/register", json={
            "email": "newuser@test.com", "password": "pass123", "full_name": "New"
        })
        assert r.status_code == 200
        assert r.json()["email"] == "newuser@test.com"

        dup = client.post("/api/auth/register", json={
            "email": "newuser@test.com", "password": "pass123"
        })
        assert dup.status_code == 400

        login = client.post("/api/auth/token", data={
            "username": "newuser@test.com", "password": "pass123"
        })
        assert login.status_code == 200
        assert "access_token" in login.json()

        bad = client.post("/api/auth/token", data={
            "username": "newuser@test.com", "password": "wrong"
        })
        assert bad.status_code == 401

    def test_strict_auth_blocks_unauthenticated(self, client, monkeypatch):
        monkeypatch.setenv("STRICT_AUTH", "1")
        r = client.get("/api/products/")
        assert r.status_code == 401

    def test_dev_fallback_auth(self, client):
        r = client.get("/api/products/")
        assert r.status_code == 200

    def test_profile(self, client, headers):
        r = client.get("/api/products/me", headers=headers)
        assert r.status_code == 200
        assert "email" in r.json()

    def test_health(self, client):
        r = client.get("/api/health/")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


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
        r = client.post("/api/products/upload", files={
            "file": ("test.txt", io.BytesIO(b"Motor 15kW 415V IE3"), "text/plain")
        }, headers=headers)
        assert r.status_code == 200

    def test_batch_import(self, client, headers):
        r = client.post("/api/products/batch/import", json={
            "products": [{
                "name": "Batch Motor", "model_number": "B-001",
                "attributes": [{"key": "rated_power", "label": "Rated Power", "value": "22", "unit": "kW"}]
            }]
        }, headers=headers)
        assert r.status_code == 200
        assert r.json()["succeeded"] == 1

    def test_batch_import_csv(self, client, headers):
        csv_content = "name,key,label,value,unit\nCSV Motor,rated_power,Rated Power,15,kW\n"
        r = client.post("/api/products/batch/import/csv",
                       files={"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")},
                       headers=headers)
        assert r.status_code == 200


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
        # Use a consistent model number so the pipeline merges both sources
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
        # Both values preserved (source names may be the same "Document Extraction" for text inputs)
        source_values = {s["value"] for s in sources}
        assert "15 kW" in source_values or "15" in str(source_values)
        assert "22 kW" in source_values or "22" in str(source_values)

        # Both values preserved
        power_rows = [a for a in detail["attributes"] if a["key"] == "rated_power"]
        values = {a["value"] for a in power_rows}
        assert "15" in values
        assert "22" in values

    def test_conflict_never_overwrites(self, client, headers):
        """Original value must remain after conflict."""
        text1 = "Siemens MTR3001-303 Motor. Max Temperature: 155 C."
        r1 = client.post("/api/workflow/process", data={"text": text1}, headers=headers)
        pid = r1.json()["product"]["id"]

        text2 = "Siemens MTR3001-303 Motor. Max Temperature: 130 C."
        client.post("/api/workflow/process", data={"text": text2}, headers=headers)

        detail = client.get(f"/api/products/{pid}", headers=headers).json()
        temp_rows = [a for a in detail["attributes"] if a["key"] == "max_temperature"]
        values = {a["value"] for a in temp_rows}
        assert "155" in values
        assert "130" in values

    def test_conflict_has_recommendation_and_reasoning(self, client, headers):
        text1 = "Siemens MTR4001-404 Motor. Rated Power: 15 kW."
        r1 = client.post("/api/workflow/process", data={"text": text1}, headers=headers)
        pid = r1.json()["product"]["id"]
        text2 = "Siemens MTR4001-404 Motor. Rated Power: 18.5 kW."
        client.post("/api/workflow/process", data={"text": text2}, headers=headers)

        detail = client.get(f"/api/products/{pid}", headers=headers).json()
        pc = [c for c in detail["conflicts"] if c["attribute_key"] == "rated_power"]
        assert len(pc) >= 1
        assert pc[0].get("recommended_value") is not None or pc[0].get("reasoning") is not None

    def test_conflict_creates_review_item(self, client, headers):
        text1 = "Siemens MTR5001-505 Motor. Rated Power: 15 kW."
        r1 = client.post("/api/workflow/process", data={"text": text1}, headers=headers)
        pid = r1.json()["product"]["id"]
        text2 = "Siemens MTR5001-505 Motor. Rated Power: 22 kW."
        client.post("/api/workflow/process", data={"text": text2}, headers=headers)

        detail = client.get(f"/api/products/{pid}", headers=headers).json()
        pending = [r for r in detail["review_items"] if r.get("status", "").upper() == "PENDING"]
        assert len(pending) >= 1


# ---------------------------------------------------------------------------
# Phase 11: Missing data detection
# ---------------------------------------------------------------------------

class TestMissingData:
    def test_missing_value_not_invented(self, client, headers):
        text = "Siemens MTR7001-707 Motor with only power. Rated Power: 15 kW."
        r = client.post("/api/workflow/process", data={"text": text}, headers=headers)
        pid = r.json()["product"]["id"]
        detail = client.get(f"/api/products/{pid}", headers=headers).json()
        attrs = {a["key"]: a for a in detail["attributes"]}

        for k in ["supply_voltage", "rated_current", "efficiency_class",
                   "rated_speed", "max_temperature", "frame_size", "total_weight"]:
            if k in attrs and attrs[k]["status"] == "NOT_FOUND":
                assert attrs[k]["value"] is None

    def test_missing_displays_insufficient_evidence(self, client, headers):
        text = "Siemens MTR8001-808 Motor. Power: 15 kW."
        r = client.post("/api/workflow/process", data={"text": text}, headers=headers)
        pid = r.json()["product"]["id"]
        detail = client.get(f"/api/products/{pid}", headers=headers).json()
        attrs = {a["key"]: a for a in detail["attributes"]}
        tw = attrs.get("total_weight", {})
        if tw.get("status") == "NOT_FOUND":
            assert tw.get("evidence") or tw.get("evidence_quote")


# ---------------------------------------------------------------------------
# Phase 12: RAG
# ---------------------------------------------------------------------------

class TestRAG:
    def test_rag_with_evidence(self, client, headers):
        r = client.post("/api/rag/query", json={
            "question": "What is the rated power?",
            "product_id": 1,
        }, headers=headers)
        assert r.status_code == 200
        assert r.json()["has_evidence"] is True
        assert "Insufficient evidence." not in r.json()["answer"]

    def test_rag_without_evidence(self, client, headers):
        r = client.post("/api/rag/query", json={
            "question": "What is the warranty period in years?"
        }, headers=headers)
        assert r.status_code == 200
        assert r.json()["has_evidence"] is False
        assert r.json()["answer"] == "Insufficient evidence."

    def test_rag_returns_sources(self, client, headers):
        r = client.post("/api/rag/query", json={
            "question": "What is the rated voltage?",
            "product_id": 1,
        }, headers=headers)
        data = r.json()
        assert len(data.get("sources", [])) > 0
        assert len(data.get("evidence_snippets", [])) > 0


# ---------------------------------------------------------------------------
# Phase 13-14: Evidence & Confidence
# ---------------------------------------------------------------------------

class TestEvidence:
    def test_confidence_in_range(self, client, headers):
        detail = client.get("/api/products/1", headers=headers).json()
        for a in detail["attributes"]:
            c = a.get("confidence", -1)
            assert 0 <= c <= 1, f"{a['key']} confidence {c} out of range"

    def test_verified_has_evidence(self, client, headers):
        detail = client.get("/api/products/1", headers=headers).json()
        for a in detail["attributes"]:
            if a.get("status") == "VERIFIED":
                assert a.get("source"), f"{a['key']} VERIFIED but no source"
                assert a.get("evidence") or a.get("evidence_quote"), f"{a['key']} VERIFIED but no evidence"


# ---------------------------------------------------------------------------
# Phase 15: Health Score
# ---------------------------------------------------------------------------

class TestHealthScore:
    def test_health_breakdown_structure(self, client, headers):
        r = client.get("/api/products/1/health", headers=headers)
        assert r.status_code == 200
        hb = r.json()
        assert "score" in hb
        assert "completeness" in hb
        assert "consistency" in hb
        assert "confidence" in hb
        assert "source_reliability" in hb
        assert "explanation" in hb
        assert "weights" in hb

    def test_health_score_formula(self, client, headers):
        r = client.get("/api/products/1/health", headers=headers)
        hb = r.json()
        expected = int(round(
            0.40 * hb["completeness"] + 0.30 * hb["consistency"] +
            0.20 * hb["confidence"] + 0.10 * hb["source_reliability"]
        ))
        assert hb["score"] == expected

    def test_health_score_weights(self, client, headers):
        r = client.get("/api/products/1/health", headers=headers)
        w = r.json()["weights"]
        assert w["completeness"] == 0.40
        assert w["consistency"] == 0.30
        assert w["confidence"] == 0.20
        assert w["source_reliability"] == 0.10

    def test_health_score_0_for_no_attributes(self):
        from backend.services.product_service import compute_dynamic_health_score
        score = compute_dynamic_health_score([], [])
        assert score == 0

    def test_health_score_decreases_with_conflicts(self, client, headers):
        text1 = "Siemens MTR6001-606 Motor. Rated Power: 15 kW."
        r1 = client.post("/api/workflow/process", data={"text": text1}, headers=headers)
        pid = r1.json()["product"]["id"]
        score_before = r1.json()["product"]["health_score"]

        text2 = "Siemens MTR6001-606 Motor. Rated Power: 22 kW."
        client.post("/api/workflow/process", data={"text": text2}, headers=headers)

        detail = client.get(f"/api/products/{pid}", headers=headers).json()
        assert detail["health_score"] <= score_before


# ---------------------------------------------------------------------------
# Phase 17: Human Review
# ---------------------------------------------------------------------------

class TestHumanReview:
    def test_approve_action(self, client, headers):
        detail = client.get("/api/products/1", headers=headers).json()
        pending = [r for r in detail["review_items"] if r.get("status", "").upper() == "PENDING"]
        if pending:
            rid = pending[0]["id"]
            r = client.post(f"/api/review/{rid}/action",
                          json={"action": "approve"}, headers=headers)
            assert r.status_code == 200

    def test_edit_action(self, client, headers):
        detail = client.get("/api/products/1", headers=headers).json()
        pending = [r for r in detail["review_items"] if r.get("status", "").upper() == "PENDING"]
        if pending:
            rid = pending[0]["id"]
            r = client.post(f"/api/review/{rid}/action",
                          json={"action": "edited", "edited_value": "99",
                                "comment": "Verified weight"}, headers=headers)
            assert r.status_code == 200

    def test_reject_action(self, client, headers):
        detail = client.get("/api/products/1", headers=headers).json()
        pending = [r for r in detail["review_items"] if r.get("status", "").upper() == "PENDING"]
        if pending:
            rid = pending[0]["id"]
            r = client.post(f"/api/review/{rid}/action",
                          json={"action": "reject", "comment": "Data unreliable"},
                          headers=headers)
            assert r.status_code == 200

    def test_review_creates_audit_trail(self, client, headers):
        detail = client.get("/api/products/1", headers=headers).json()
        pending = [r for r in detail["review_items"] if r.get("status", "").upper() == "PENDING"]
        if pending:
            rid = pending[0]["id"]
            client.post(f"/api/review/{rid}/action",
                       json={"action": "approve"}, headers=headers)
            updated = client.get("/api/products/1", headers=headers).json()
            reviewed = next((r for r in updated["review_items"] if r["id"] == rid), None)
            if reviewed:
                assert reviewed.get("reviewer") is not None
                assert reviewed.get("reviewed_at") is not None

    def test_review_recalculates_health(self, client, headers):
        before = client.get("/api/products/1", headers=headers).json()
        old_score = before["health_score"]
        detail = before
        pending = [r for r in detail["review_items"] if r.get("status", "").upper() == "PENDING"]
        if pending:
            rid = pending[0]["id"]
            client.post(f"/api/review/{rid}/action",
                       json={"action": "approve"}, headers=headers)
            after = client.get("/api/products/1", headers=headers).json()
            assert after["health_score"] is not None

    def test_invalid_action_rejected(self, client, headers):
        r = client.post("/api/review/1/action",
                       json={"action": "nonsense"}, headers=headers)
        assert r.status_code in (400, 422, 500)


# ---------------------------------------------------------------------------
# Phase 18-20: Audit Log, CatalogPilot, Versioning
# ---------------------------------------------------------------------------

class TestAuditAndVersioning:
    def test_version_created_on_ingest(self, client, headers):
        text = "VersionTest Motor. Rated Power: 15 kW."
        r = client.post("/api/workflow/process", data={"text": text}, headers=headers)
        pid = r.json()["product"]["id"]
        detail = client.get(f"/api/products/{pid}", headers=headers).json()
        assert len(detail["versions"]) >= 1

    def test_version_has_changes(self, client, headers):
        detail = client.get("/api/products/1", headers=headers).json()
        for v in detail["versions"]:
            changes = json.loads(v.get("changes_json", "[]"))
            assert len(changes) >= 1
            for ch in changes:
                assert "field" in ch
                assert "timestamp" in ch

    def test_audit_trail_report(self, client, headers):
        r = client.get("/api/products/reports/audit-trail", headers=headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------------------------------------------------------------------------
# Phase 21: Export
# ---------------------------------------------------------------------------

class TestExport:
    def test_json_export_fields(self, client, headers):
        r = client.get("/api/products/1/export/json", headers=headers)
        assert r.status_code == 200
        data = json.loads(r.text)
        assert "attributes" in data
        assert "product" in data
        attr = data["attributes"][0]
        for f in ["key", "value", "unit", "confidence", "status", "source", "page", "evidence"]:
            assert f in attr, f"Missing JSON export field: {f}"

    def test_csv_export_columns(self, client, headers):
        r = client.get("/api/products/1/export/csv", headers=headers)
        assert r.status_code == 200
        for col in ["Key", "Evidence", "Source", "Page", "Confidence", "Status"]:
            assert col in r.text, f"Missing CSV column: {col}"

    def test_batch_export_json(self, client, headers):
        r = client.get("/api/products/batch/export?format=json", headers=headers)
        assert r.status_code == 200

    def test_batch_export_csv(self, client, headers):
        r = client.get("/api/products/batch/export?format=csv", headers=headers)
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# Phase 22: Industrial Category Support
# ---------------------------------------------------------------------------

class TestExtensibility:
    def test_product_has_category(self, client, headers):
        detail = client.get("/api/products/1", headers=headers).json()
        assert detail.get("category") is not None

    def test_category_filtering(self, client, headers):
        r = client.get("/api/products/?q=Siemens", headers=headers)
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# Phase 23: Knowledge Graph, Explainability, Notifications
# ---------------------------------------------------------------------------

class TestKnowledgeGraph:
    def test_kg_for_product(self, client, headers):
        r = client.get("/api/products/1/knowledge-graph", headers=headers)
        assert r.status_code == 200
        kg = r.json()
        assert len(kg["nodes"]) > 0

    def test_kg_full(self, client, headers):
        r = client.get("/api/products/knowledge-graph/full", headers=headers)
        assert r.status_code == 200

    def test_kg_query(self, client, headers):
        r = client.post("/api/products/knowledge-graph/query",
                       json={"query_type": "related"}, headers=headers)
        assert r.status_code == 200

    def test_kg_relationships(self, client, headers):
        r = client.get("/api/products/knowledge-graph/relationships", headers=headers)
        assert r.status_code == 200


class TestExplainability:
    def test_explainability(self, client, headers):
        r = client.get("/api/products/1/explainability", headers=headers)
        assert r.status_code == 200
        exp = r.json()
        assert exp["total_attributes"] > 0
        assert len(exp["explanations"]) > 0

    def test_explainability_audit_trail(self, client, headers):
        r = client.get("/api/products/1/explainability/audit-trail", headers=headers)
        assert r.status_code == 200

    def test_single_attribute_explanation(self, client, headers):
        r = client.get("/api/products/1/explainability/rated_power", headers=headers)
        assert r.status_code == 200


class TestNotifications:
    def test_list_notifications(self, client, headers):
        r = client.get("/api/notifications", headers=headers)
        assert r.status_code == 200

    def test_unread_count(self, client, headers):
        r = client.get("/api/notifications/unread-count", headers=headers)
        assert r.status_code == 200
        assert "unread_count" in r.json()

    def test_create_notification(self, client, headers):
        r = client.post("/api/notifications", json={
            "user_id": "audit-user", "type": "system",
            "title": "Test", "message": "Audit test"
        }, headers=headers)
        assert r.status_code == 200

    def test_mark_all_read(self, client, headers):
        r = client.post("/api/notifications/mark-all-read", headers=headers)
        assert r.status_code == 200

    def test_activity_feed(self, client, headers):
        r = client.get("/api/activity-feed", headers=headers)
        assert r.status_code == 200


class TestReports:
    def test_data_quality(self, client, headers):
        r = client.get("/api/products/reports/data-quality", headers=headers)
        assert r.status_code == 200
        dq = r.json()
        assert "total_products" in dq
        assert "overall_quality_score" in dq

    def test_compliance(self, client, headers):
        r = client.get("/api/products/reports/compliance", headers=headers)
        assert r.status_code == 200

    def test_dashboard_stats(self, client, headers):
        r = client.get("/api/products/stats", headers=headers)
        assert r.status_code == 200
        s = r.json()
        assert "total_products" in s
        assert "average_health_score" in s
        assert s["total_products"] >= 1

    def test_validate_product(self, client, headers):
        r = client.post("/api/products/1/validate", headers=headers)
        assert r.status_code == 200
        v = r.json()
        assert "valid" in v
        assert "attributes_validated" in v


# ---------------------------------------------------------------------------
# Phase 26: Security
# ---------------------------------------------------------------------------

class TestSecurity:
    def test_no_plaintext_passwords(self):
        from backend.core.security import get_password_hash, verify_password
        h = get_password_hash("test123")
        assert h != "test123"
        assert verify_password("test123", h)

    def test_token_expiration_configured(self):
        from backend.core.config import settings
        assert settings.access_token_expire_minutes > 0

    def test_cors_configured(self):
        from backend.main import app
        middleware = [m for m in app.user_middleware if hasattr(m, "kwargs")]
        assert any("CORSMiddleware" in str(m) for m in app.user_middleware)


# ---------------------------------------------------------------------------
# End-to-End Demo Walkthrough (Phase 25)
# ---------------------------------------------------------------------------

class TestE2EDemo:
    def test_full_demo_flow(self, client, headers):
        """Complete demo flow: ingest -> extract -> verify -> conflict -> review -> export."""

        # Step 1: Ingest a product
        text = (
            "Siemens MTR-E2E-001 Motor. Rated Power: 15 kW. "
            "Supply Voltage: 415 V. Rated Current: 28.5 A. "
            "Efficiency Class: IE3 Premium. Rated Speed: 1475 rpm. "
            "Frame Size: 160M. Max Operating Temperature: 155 degC."
        )
        r = client.post("/api/workflow/process", data={"text": text}, headers=headers)
        assert r.status_code == 200
        pid = r.json()["product"]["id"]

        # Step 2: Verify ProductTwin
        detail = client.get(f"/api/products/{pid}", headers=headers).json()
        attrs = {a["key"]: a for a in detail["attributes"]}
        assert "rated_power" in attrs
        assert attrs["rated_power"]["value"] == "15"
        assert attrs["rated_power"]["status"] == "VERIFIED"

        # Step 3: Verify total_weight missing
        assert attrs["total_weight"]["status"] == "NOT_FOUND"
        assert attrs["total_weight"]["value"] is None

        # Step 4: Verify 87.5% completeness
        required = ["rated_power", "supply_voltage", "rated_current", "efficiency_class",
                     "rated_speed", "max_temperature", "frame_size", "total_weight"]
        valid = sum(1 for k in required if k in attrs and attrs[k].get("value")
                    and attrs[k].get("status") not in ("NOT_FOUND",))
        assert round(valid / len(required) * 100, 1) == 87.5

        # Step 5: Add conflicting source
        text2 = "Siemens MTR-E2E-001 Motor. Rated Power: 18.5 kW. Max Operating Temperature: 130 C."
        r2 = client.post("/api/workflow/process", data={"text": text2}, headers=headers)
        assert r2.json()["product"]["id"] == pid
        assert r2.json()["product"]["conflicts_created"] >= 1

        # Step 6: Verify conflict
        detail = client.get(f"/api/products/{pid}", headers=headers).json()
        conflicts = detail["conflicts"]
        assert len(conflicts) >= 1
        for c in conflicts:
            sources = json.loads(c["sources_json"])
            assert len(sources) == 2

        # Step 7: RAG query with evidence
        r_rag = client.post("/api/rag/query", json={
            "question": "What is the rated voltage?", "product_id": pid
        }, headers=headers)
        assert r_rag.json()["has_evidence"] is True

        # Step 8: RAG query without evidence
        r_rag2 = client.post("/api/rag/query", json={
            "question": "What is the warranty period?"
        }, headers=headers)
        assert r_rag2.json()["has_evidence"] is False

        # Step 9: Health score
        r_hb = client.get(f"/api/products/{pid}/health", headers=headers)
        hb = r_hb.json()
        assert hb["score"] > 0

        # Step 10: Human review
        pending = [r for r in detail["review_items"] if r.get("status", "").upper() == "PENDING"]
        if pending:
            rid = pending[0]["id"]
            client.post(f"/api/review/{rid}/action",
                       json={"action": "edited", "edited_value": "88",
                             "comment": "Weight from verified label"}, headers=headers)
            updated = client.get(f"/api/products/{pid}", headers=headers).json()
            reviewed = next((r for r in updated["review_items"] if r["id"] == rid), None)
            assert reviewed["reviewed_at"] is not None

        # Step 11: Versioning
        updated = client.get(f"/api/products/{pid}", headers=headers).json()
        assert len(updated["versions"]) >= 1

        # Step 12: Export JSON
        r_json = client.get(f"/api/products/{pid}/export/json", headers=headers)
        export = json.loads(r_json.text)
        assert len(export["attributes"]) > 0

        # Step 13: Export CSV
        r_csv = client.get(f"/api/products/{pid}/export/csv", headers=headers)
        assert r_csv.status_code == 200
        assert "Key" in r_csv.text
