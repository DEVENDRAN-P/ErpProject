"""Unit tests for the extraction / validation / RAG / health pipeline."""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import pytest

from backend.ai.agents.document_intelligence import parse_pdf, parse_url, parse_csv_catalog
from backend.ai.agents.enrichment_agent import enrich_product_metadata
from backend.ai.agents.validation_agent import validate_product_data
from backend.ai.agents.rag_agent import query_rag
from backend.services.product_service import compute_dynamic_health_score, _values_conflict, merge_source_into_product
from backend.models.product import Product, ProductAttribute, ProductTruthConflict
from backend.reference_data import load_reference_data
from backend.status import canonical_status, STATUS_VERIFIED, STATUS_NOT_FOUND, STATUS_CONFLICT, STATUS_OPEN
from backend.uom_validation import is_uom_valid

load_reference_data()


# ---------------------------------------------------------------------------
# Document intelligence
# ---------------------------------------------------------------------------

def test_parse_csv_catalog():
    csv_bytes = b"model,power,voltage\n1LE1001,15kW,415V\n"
    res = parse_csv_catalog(csv_bytes, "motor_catalog.csv")
    assert res["type"] == "csv"
    assert res["row_count"] == 1
    assert "model" in res["columns"]


def test_parse_url_unreachable_returns_error():
    res = parse_url("https://this-domain-does-not-exist-12345.invalid/")
    assert res["status"] == "error"


def test_parse_pdf_demo_datasheet():
    """PDF ingestion: the generated demo datasheet must yield extractable text."""
    fitz = pytest.importorskip("fitz", reason="PyMuPDF not installed — PDF extraction test skipped")
    pdf_path = os.path.join(os.path.dirname(__file__), "../../demo_data/Siemens_1LE1001_Datasheet.pdf")
    with open(pdf_path, "rb") as f:
        content = f.read()
    res = parse_pdf(content, "Siemens_1LE1001_Datasheet.pdf")
    assert res["type"] == "document"
    assert res["page_count"] >= 1
    assert "Rated Output Power: 15 kW" in res["text"]
    assert "415 V" in res["text"]
    assert "IE3" in res["text"]


# ---------------------------------------------------------------------------
# Attribute extraction
# ---------------------------------------------------------------------------

def test_enrich_product_metadata_extracts_and_marks_missing():
    text = (
        "Siemens 1LE1001-1DB43-4AA4 Motor. Rated Power: 15 kW. Supply Voltage: 415 V, 50 Hz. "
        "Rated Current: 28.5 A. Efficiency Class: IE3 Premium. Rated Speed: 1475 rpm. "
        "Frame Size: 160M. Max Operating Temperature: 155 degC."
    )
    res = enrich_product_metadata(text)
    assert res["type"] == "enrichment"
    keys = {a["key"]: a for a in res["attributes"]}

    # Extracted specs
    assert keys["rated_power"]["value"] == "15.0"
    assert keys["supply_voltage"]["value"] == "415.0"
    assert keys["rated_current"]["value"] == "28.5"
    assert keys["efficiency_class"]["value"] == "IE3"
    assert keys["rated_speed"]["value"] == "1475.0"
    assert keys["frame_size"]["value"] == "160M"

    # Missing spec must be NOT_FOUND / no invented value
    assert keys["total_weight"]["value"] is None
    assert keys["total_weight"]["status"] == "not_found"
    assert keys["total_weight"]["confidence"] == 0.0


# ---------------------------------------------------------------------------
# Unit validation
# ---------------------------------------------------------------------------

def test_unit_validation_valid_and_invalid():
    for unit in ["kW", "W", "V", "A", "rpm", "kg", "°C", "Hz"]:
        valid, _ = is_uom_valid(unit)
        assert valid, f"expected '{unit}' to be a valid unit"
    valid, _ = is_uom_valid("bananas")
    assert not valid


# ---------------------------------------------------------------------------
# Consistency (voltage x current vs power)
# ---------------------------------------------------------------------------

def test_consistency_passing_combination():
    attrs = [
        {"key": "rated_power", "value": "15", "confidence": 0.98},
        {"key": "supply_voltage", "value": "415", "confidence": 0.96},
        {"key": "rated_current", "value": "36.1", "confidence": 0.96},  # 415 x 36.1 = ~15 kW
    ]
    res = validate_product_data({"attributes": attrs})
    assert res["type"] == "validation"
    # 15 kW vs 415*36.1 = 14.98 kW -> well within 20% tolerance
    power_conflicts = [c for c in res["conflicts"] if c["key"] == "power_consistency"]
    assert len(power_conflicts) == 0


def test_consistency_failing_combination():
    attrs = [
        {"key": "rated_power", "value": "5.5", "confidence": 0.98},
        {"key": "supply_voltage", "value": "415", "confidence": 0.96},
        {"key": "rated_current", "value": "28.5", "confidence": 0.96},  # 415 x 28.5 = 11.8 kW
    ]
    res = validate_product_data({"attributes": attrs})
    power_conflicts = [c for c in res["conflicts"] if c["key"] == "power_consistency"]
    assert len(power_conflicts) == 1
    assert "power_consistency" in [c["key"] for c in res["conflicts"]]


# ---------------------------------------------------------------------------
# RAG
# ---------------------------------------------------------------------------

def test_rag_unsupported_question_does_not_hallucinate():
    res = query_rag(
        "What is the nuclear payload capacity of this motor?",
        document_text="Siemens 15kW 415V Motor",
    )
    assert res["has_evidence"] is False
    assert res["answer"] == "Insufficient evidence."


def test_rag_supported_question_returns_evidence():
    text = "Siemens 1LE1001 15kW motor. Operating voltage: 415 V Delta / 690 V Star. Efficiency Class: IE3 Premium."
    res = query_rag("What is the operating voltage?", document_text=text)
    assert res["has_evidence"] is True
    assert "415 V" in res["answer"]


# ---------------------------------------------------------------------------
# Health score
# ---------------------------------------------------------------------------

def test_health_score_calculation():
    attrs = [
        ProductAttribute(key="rated_power", value="15", status="VERIFIED", confidence=0.95, source="datasheet.pdf"),
        ProductAttribute(key="supply_voltage", value="415", status="VERIFIED", confidence=0.95, source="datasheet.pdf"),
        ProductAttribute(key="rated_current", value="28.5", status="VERIFIED", confidence=0.95, source="datasheet.pdf"),
        ProductAttribute(key="efficiency_class", value="IE3", status="VERIFIED", confidence=0.95, source="datasheet.pdf"),
        ProductAttribute(key="rated_speed", value="1475", status="VERIFIED", confidence=0.95, source="datasheet.pdf"),
        ProductAttribute(key="max_temperature", value="155", status="VERIFIED", confidence=0.95, source="datasheet.pdf"),
        ProductAttribute(key="frame_size", value="160M", status="VERIFIED", confidence=0.95, source="datasheet.pdf"),
        ProductAttribute(key="total_weight", value="85", status="VERIFIED", confidence=0.95, source="datasheet.pdf"),
    ]
    score = compute_dynamic_health_score(attrs, [])
    assert score >= 90


def test_health_score_penalized_by_conflicts_and_missing():
    attrs = [
        ProductAttribute(key="rated_power", value="15", status="VERIFIED", confidence=0.95, source="datasheet.pdf"),
        ProductAttribute(key="total_weight", value=None, status="NOT_FOUND", confidence=0.0, source=""),
    ]
    conflicts = [ProductTruthConflict(attribute_key="rated_power", label="Rated Power", sources_json="[]", status="OPEN")]
    clean = compute_dynamic_health_score(attrs, [])
    dirty = compute_dynamic_health_score(attrs, conflicts)
    assert dirty < clean


# ---------------------------------------------------------------------------
# Status vocabulary
# ---------------------------------------------------------------------------

def test_canonical_status_mapping():
    assert canonical_status("verified") == STATUS_VERIFIED
    assert canonical_status("missing") == STATUS_NOT_FOUND
    assert canonical_status("conflict") == STATUS_CONFLICT
    assert canonical_status("low_confidence") == "NEEDS_REVIEW"
    assert canonical_status(None) == "NEEDS_REVIEW"


# ---------------------------------------------------------------------------
# Value comparison for conflict detection
# ---------------------------------------------------------------------------

def test_values_conflict_comparison():
    assert not _values_conflict("15 kW", "15.0")          # formatting noise
    assert not _values_conflict("415 V", "415V")
    assert _values_conflict("15 kW", "18.5 kW")           # real conflict
    assert not _values_conflict(None, "15 kW")            # missing value = no conflict


# ---------------------------------------------------------------------------
# Source merge persists conflicts (service level)
# ---------------------------------------------------------------------------

def test_merge_source_creates_conflict_record(db_session):
    product = Product(name="Test Motor", model_number="M1", category="Motors")
    db_session.add(product)
    db_session.flush()
    db_session.add(ProductAttribute(
        product_id=product.id, key="rated_power", label="Rated Power",
        value="15", unit="kW", confidence=0.95, source="datasheet.pdf", status="VERIFIED",
    ))
    db_session.commit()

    result = merge_source_into_product(
        db_session, product,
        attributes=[{
            "key": "rated_power", "label": "Rated Power", "value": "18.5", "unit": "kW",
            "confidence": 0.8, "source": "web catalog", "evidence": "Website listing",
        }],
        source="web catalog",
    )
    assert result["conflicts_created"] == 1

    db_session.refresh(product)
    conflicts = product.conflicts
    assert len(conflicts) == 1
    assert conflicts[0].status == STATUS_OPEN
    assert conflicts[0].attribute_key == "rated_power"

    # The conflicting value was preserved as a second attribute row (CONFLICT),
    # never silently overwritten.
    power_rows = [a for a in product.attributes if a.key == "rated_power"]
    assert len(power_rows) == 2
    assert {a.status for a in power_rows} == {STATUS_VERIFIED, STATUS_CONFLICT}
    # The merge logs a CatalogPilot version entry for the change
    assert len(product.versions) >= 1
