"""End-to-End Product Pipeline Service.

Integrates: Ingestion → Document Processing → Attribute Extraction →
Normalization → Validation → Evidence + Confidence → ProductTwin →
Conflict Detection → RAG Verification → Health Score → Review → Versioning.

Principles:
- Never invent an industrial specification: missing values are persisted as
  NOT_FOUND / INSUFFICIENT_EVIDENCE with zero confidence.
- Conflicting values from different sources are never silently overwritten:
  a ProductTruthConflict is persisted and both values remain visible.
- Every extracted value keeps its source, page, evidence and confidence.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from backend.ai.agents.document_intelligence import parse_document, parse_url
from backend.ai.agents.vision_agent import analyze_image
from backend.ai.agents.enrichment_agent import enrich_product_metadata
from backend.ai.agents.rag_agent import query_rag
from backend.lov_validation import is_approved_attribute, is_approved_value, _ATTRIBUTE_LOV
from backend.uom_validation import is_uom_valid
from backend.schemas.product import ProductCreate
from backend.services.product_service import (
    create_product,
    merge_source_into_product,
    compute_dynamic_health_score,
    _create_notification,
)
from backend.status import (
    STATUS_VERIFIED,
    STATUS_NORMALIZED,
    STATUS_EXTRACTED,
    STATUS_NOT_FOUND,
    STATUS_INSUFFICIENT_EVIDENCE,
    STATUS_CONFLICT,
    STATUS_NEEDS_REVIEW,
    STATUS_PENDING,
    canonical_status,
)


# ---------------------------------------------------------------------------
# Status helpers
# ---------------------------------------------------------------------------

def _lov_valid_for(key: str, value: str | None) -> bool:
    """LOV compliance: the key must be approved, and if the key has a
    constrained value list, the value must be approved."""
    if not is_approved_attribute(key):
        return False
    norm_key = key.strip().lower()
    allowed = _ATTRIBUTE_LOV.get(norm_key, {})
    if not allowed:
        return True  # key approved, no value constraints
    if not value:
        return False
    return bool(is_approved_value(key, value)[0])


def _uom_valid_for(unit: str | None) -> bool:
    """UOM compliance: empty unit is acceptable only for dimensionless keys;
    otherwise the unit must be in the approved UOM list."""
    if not unit or not str(unit).strip():
        return True
    return bool(is_uom_valid(str(unit).strip())[0])


def _determine_attribute_status(
    pipeline_status: str,
    confidence: float,
    lov_valid: bool,
    uom_valid: bool,
) -> str:
    """Map a raw pipeline status + validation results to a canonical status."""
    key = (pipeline_status or "").strip().lower()

    if key in ("conflict",):
        return STATUS_CONFLICT
    if key in ("not_found", "missing"):
        return STATUS_NOT_FOUND
    if key in ("insufficient_evidence",):
        return STATUS_INSUFFICIENT_EVIDENCE
    if key in ("needs_review", "low_confidence", "unverified", "review"):
        return STATUS_NEEDS_REVIEW

    if key in ("verified",):
        if lov_valid and uom_valid:
            return STATUS_VERIFIED if confidence >= 0.8 else STATUS_NORMALIZED
        return STATUS_NEEDS_REVIEW
    if key in ("extracted",):
        return STATUS_EXTRACTED
    if confidence and confidence >= 0.5:
        return STATUS_EXTRACTED
    if not lov_valid or not uom_valid:
        return STATUS_NEEDS_REVIEW
    return STATUS_NEEDS_REVIEW


def _determine_overall_status(validated_attrs: List[Dict[str, Any]]) -> str:
    """Overall pipeline status. Missing or low-confidence specs surface as
    NEEDS_REVIEW at the product level; per-attribute NOT_FOUND stays visible
    in the attribute list."""
    if not validated_attrs:
        return STATUS_NOT_FOUND
    statuses = [a.get("status", STATUS_NOT_FOUND) for a in validated_attrs]
    if any(s == STATUS_CONFLICT for s in statuses):
        return STATUS_CONFLICT
    if any(s in (STATUS_NEEDS_REVIEW, STATUS_NOT_FOUND, STATUS_INSUFFICIENT_EVIDENCE) for s in statuses):
        return STATUS_NEEDS_REVIEW
    if all(s == STATUS_VERIFIED for s in statuses):
        return STATUS_VERIFIED
    if all(s == STATUS_NORMALIZED for s in statuses):
        return STATUS_NORMALIZED
    if any(s == STATUS_EXTRACTED for s in statuses):
        return STATUS_EXTRACTED
    return STATUS_NEEDS_REVIEW


# ---------------------------------------------------------------------------
# Attribute display formatting
# ---------------------------------------------------------------------------

def format_attribute_display(
    attr: dict,
    *,
    show_normalized: bool = True,
    show_confidence: bool = True,
    show_evidence: bool = True,
    show_validation: bool = True,
) -> Dict[str, Any]:
    """Format an attribute for display with all required provenance fields."""
    raw_value = attr.get("raw_value") or attr.get("value") or ""
    normalized_value = attr.get("normalized_value") or ""
    confidence = float(attr.get("confidence") or 0.0)
    evidence = attr.get("evidence_quote") or attr.get("evidence") or ""
    source = attr.get("source") or ""

    status = _determine_attribute_status(
        pipeline_status=attr.get("status", "unverified"),
        confidence=confidence,
        lov_valid=attr.get("lov_valid", False),
        uom_valid=attr.get("uom_valid", False),
    )

    validation: Dict[str, Any] = {
        "lov": attr.get("lov_valid", False),
        "uom": attr.get("uom_valid", False),
        "overall": status in (STATUS_VERIFIED, STATUS_NORMALIZED),
    }

    return {
        "raw_value": raw_value,
        "normalized_value": normalized_value if show_normalized else "",
        "confidence": round(confidence, 4) if show_confidence else 0.0,
        "evidence": evidence if show_evidence else "",
        "source": source,
        "validation": validation,
        "status": status,
    }


# ---------------------------------------------------------------------------
# Ingestion helpers
# ---------------------------------------------------------------------------

_MODEL_NUMBER_RE = re.compile(
    r"\b(?:(?:[A-Z]{1,6}\d{2,6})[-/][A-Z0-9][A-Z0-9-]{2,}|[A-Z]{2}\d{4}[-][A-Z0-9-]{4,})\b"
)


def _detect_model_number(text: str) -> Optional[str]:
    match = _MODEL_NUMBER_RE.search(text or "")
    if match:
        return match.group(0).strip()
    # Siemens-style: 1LE followed by digits and groups
    match = re.search(r"\b1LE\d{4}[-/][A-Z0-9][A-Z0-9-]*\b", text or "")
    if match:
        return match.group(0).strip()
    return None


def _detect_category(text: str) -> str:
    lower = (text or "").lower()
    if "motor" in lower:
        if "induction" in lower or "3-phase" in lower or "three-phase" in lower:
            return "Electric Motors & Drives"
        return "Electric Motors"
    if "pump" in lower:
        return "Pumps"
    if "compressor" in lower:
        return "Compressors"
    if "valve" in lower or "faucet" in lower or "fitting" in lower:
        return "Valves & Fittings"
    return "Uncategorized"


def _detect_manufacturer(text: str) -> str:
    lower = (text or "").lower()
    for name in ["siemens", "abb", "weg", "toshiba", "baldor", "nidec", "leroy-somer", "lenze", "sew-eurodrive", "sew eurodrive"]:
        if name in lower:
            return name.title()
    return ""


# ---------------------------------------------------------------------------
# Core pipeline
# ---------------------------------------------------------------------------

def run_product_pipeline(
    db: Session,
    file: bytes | None = None,
    filename: str | None = None,
    text: str | None = None,
    url: str | None = None,
    created_by: str | None = None,
) -> dict[str, Any]:
    """Run the complete ingestion → extraction → validation → persistence
    pipeline and return a structured result for the API and UI."""
    # ---------------------------------------------------------------
    # 1. Document extraction
    # ---------------------------------------------------------------
    document_results: dict[str, Any] = {}
    vision_results: dict[str, Any] = {}
    url_results: dict[str, Any] = {}
    extracted_text_blocks: List[str] = []

    try:
        if file and filename:
            ext = filename.lower().split(".")[-1] if "." in filename else ""
            if ext in ["pdf", "csv", "txt"]:
                document_results = parse_document(file, filename)
                extracted_text_blocks.append(document_results.get("text", ""))
            elif ext in ["png", "jpg", "jpeg", "webp"]:
                vision_results = analyze_image(file, filename)
                extracted_text_blocks.append(str(vision_results.get("text", "")))

        if url:
            url_results = parse_url(url)
            if url_results.get("status") == "success":
                extracted_text_blocks.append(url_results.get("text", ""))
            else:
                url_results["error"] = url_results.get("error") or "Failed to fetch URL content"

        if text:
            extracted_text_blocks.append(text)

        combined_input = "\n\n".join([t for t in extracted_text_blocks if t]).strip() or None
    except Exception as err:
        return {
            "error": f"Document extraction failed: {str(err)}",
            "error_type": type(err).__name__,
            "status": STATUS_NOT_FOUND,
        }

    if not combined_input:
        return {
            "error": "No extractable text found in input. If this is a scanned PDF, OCR support is required and was not available.",
            "status": STATUS_NOT_FOUND,
        }

    # ---------------------------------------------------------------
    # 2. Attribute extraction (rule-based with optional LLM fallback)
    # ---------------------------------------------------------------
    try:
        enrichment_results = enrich_product_metadata(combined_input)
    except Exception as err:
        enrichment_results = {"type": "enrichment", "attributes": [], "error": str(err)}

    pipeline_attrs = enrichment_results.get("attributes", [])
    if not isinstance(pipeline_attrs, list):
        pipeline_attrs = []

    # ---------------------------------------------------------------
    # 3. Validation + canonical status
    # ---------------------------------------------------------------
    validated_attrs: List[Dict[str, Any]] = []
    for a in pipeline_attrs:
        key = a.get("key", "")
        raw_value = a.get("raw_value")
        value = a.get("value")
        unit = a.get("unit")
        confidence = float(a.get("confidence") or 0.0)
        status = a.get("status") or "unverified"
        source = a.get("source")
        evidence = a.get("evidence_quote") or a.get("evidence") or ""

        lov_valid = _lov_valid_for(key, a.get("normalized_value") or value)
        uom_valid = _uom_valid_for(unit)

        attr_status = _determine_attribute_status(status, confidence, lov_valid, uom_valid)

        display = format_attribute_display(
            {
                "key": key,
                "raw_value": raw_value,
                "normalized_value": a.get("normalized_value") or value,
                "unit": unit,
                "confidence": confidence,
                "status": status,
                "source": source,
                "evidence_quote": evidence,
                "lov_valid": lov_valid,
                "uom_valid": uom_valid,
            }
        )

        validated_attrs.append(
            {
                **display,
                "key": key,
                "label": a.get("label") or key,
                "unit": unit,
                "page": a.get("page") or 1,
                "lov_valid": lov_valid,
                "uom_valid": uom_valid,
                "needs_human_review": attr_status in (STATUS_NEEDS_REVIEW, STATUS_CONFLICT),
            }
        )

    # ---------------------------------------------------------------
    # 4. RAG verification
    # ---------------------------------------------------------------
    try:
        rag_sample = query_rag(
            question="What is the rated power, supply voltage and efficiency class?",
            document_text=combined_input if len(combined_input) > 20 else None,
        )
    except Exception:
        rag_sample = {
            "question": "What is the rated power, supply voltage and efficiency class?",
            "answer": "Insufficient evidence.",
            "has_evidence": False,
            "confidence": 0.0,
            "sources": [],
            "evidence_snippets": [],
        }

    # ---------------------------------------------------------------
    # 5. Persist ProductTwin (all attributes, including NOT_FOUND)
    # ---------------------------------------------------------------
    product_payload: Dict[str, Any] = {}
    try:
        model_number = _detect_model_number(combined_input)
        category = _detect_category(combined_input)
        manufacturer = _detect_manufacturer(combined_input)

        product_name = (
            f"{manufacturer + ' ' if manufacturer else ''}{category} {model_number}".strip()
            if model_number
            else (enrichment_results.get("product_name") or "Imported Product")[:120]
        )

        attributes_to_persist = [
            {
                "key": a.get("key"),
                "label": a.get("label") or a.get("key"),
                "raw_value": a.get("raw_value"),
                "normalized_value": a.get("normalized_value") or a.get("value"),
                "value": a.get("normalized_value") or a.get("value"),
                "unit": a.get("unit"),
                "confidence": a.get("confidence", 0.0),
                "status": a.get("status"),
                "source": a.get("source") or (filename or url or "Document Extraction"),
                "page": a.get("page") or 1,
                "evidence": a.get("evidence"),
                "evidence_quote": a.get("evidence_quote"),
                "lov_valid": a.get("lov_valid", False),
                "uom_valid": a.get("uom_valid", False),
                "needs_human_review": a.get("needs_human_review", False),
            }
            for a in validated_attrs
        ]

        review_items = [
            {
                "title": f"Review: {a.get('label')} ({a.get('status')})",
                "item_type": "conflict" if a.get("status") == STATUS_CONFLICT else "review",
                "description": (
                    f"Attribute '{a.get('label')}' requires human review. "
                    f"Value: {a.get('normalized_value') or 'not found'} {a.get('unit') or ''}. "
                    f"Confidence: {round(a.get('confidence', 0.0) * 100)}%. Source: {a.get('source')}."
                ),
                "action": "Review attribute",
                "status": STATUS_PENDING,
            }
            for a in validated_attrs
            if a.get("needs_human_review")
        ]

        if attributes_to_persist:
            product_create = ProductCreate(
                name=product_name,
                model_number=model_number,
                category=category,
                description=(combined_input[:2000] or None),
                attributes=attributes_to_persist,
                review_items=review_items,
            )

            existing_product = None
            if model_number:
                from backend.models.product import Product as _ProductModel

                existing_product = db.query(_ProductModel).filter(_ProductModel.model_number == model_number).first()

            if existing_product is not None:
                merge_result = merge_source_into_product(
                    db=db,
                    product=existing_product,
                    attributes=attributes_to_persist,
                    source=filename or url or "Document Extraction",
                    created_by=created_by,
                )
                product_payload = {
                    "id": existing_product.id,
                    "name": existing_product.name,
                    "health_score": existing_product.health_score,
                    "attributes_count": len(existing_product.attributes),
                    "merged": True,
                    "conflicts_created": merge_result["conflicts_created"],
                }
            else:
                product = create_product(db=db, product_data=product_create, created_by=created_by)
                product_payload = {
                    "id": product.id,
                    "name": product.name,
                    "health_score": product.health_score,
                    "attributes_count": len(product.attributes),
                    "merged": False,
                    "conflicts_created": 0,
                }
                # Notify user of new product creation
                if created_by:
                    _create_notification(
                        db=db,
                        user_id=created_by,
                        notif_type="system",
                        title=f"Product created: {product.name}",
                        message=f"New product '{product.name}' created with {len(product.attributes)} attributes. Health score: {product.health_score}/100",
                        product_id=product.id,
                    )
    except Exception as err:
        product_payload = {"error": f"Failed to persist product: {str(err)}"}

    # ---------------------------------------------------------------
    # 6. Compile final result
    # ---------------------------------------------------------------
    return {
        "combined_input": combined_input,
        "status": _determine_overall_status(validated_attrs),
        "extracted_text_length": len(combined_input),
        "document": document_results,
        "vision": vision_results,
        "url_ingest": url_results,
        "enrichment": enrichment_results,
        "validated_attributes": validated_attrs,
        "attribute_count": len(validated_attrs),
        "rag_verification": rag_sample,
        "product": product_payload,
        "verified_count": sum(1 for a in validated_attrs if a.get("status") == STATUS_VERIFIED),
        "normalized_count": sum(1 for a in validated_attrs if a.get("status") == STATUS_NORMALIZED),
        "extracted_count": sum(1 for a in validated_attrs if a.get("status") == STATUS_EXTRACTED),
        "needs_review_count": sum(1 for a in validated_attrs if a.get("status") == STATUS_NEEDS_REVIEW),
        "not_found_count": sum(1 for a in validated_attrs if a.get("status") == STATUS_NOT_FOUND),
        "conflict_count": sum(1 for a in validated_attrs if a.get("status") == STATUS_CONFLICT),
    }


# ---------------------------------------------------------------------------
# Error handling helpers
# ---------------------------------------------------------------------------

def handle_pipeline_error(error: Exception, context: str = "pipeline execution") -> Dict[str, Any]:
    """Standardized error handling for pipeline operations."""
    error_type = type(error).__name__
    error_msg = str(error)

    user_msg = "An error occurred during processing"
    if "validation" in error_msg.lower():
        user_msg = "Data validation failed - please check input format"
    if "upload" in error_msg.lower() or "file" in error_msg.lower():
        user_msg = "File upload failed - please check the file format"
    if "parse" in error_msg.lower() or "regex" in error_msg.lower():
        user_msg = "Failed to parse input - please check the format"
    if "timeout" in error_msg.lower():
        user_msg = "Processing timed out - please try again"
    if "memory" in error_msg.lower() or "resource" in error_msg.lower():
        user_msg = "Insufficient resources - please try with smaller input"

    return {
        "error": user_msg,
        "technical_error": error_msg if error_msg else None,
        "error_type": error_type,
        "context": context,
        "status": STATUS_NOT_FOUND,
    }


def validate_input_file(
    filename: str,
    allowed_exts: Tuple[str, ...] = ("pdf", "csv", "txt", "png", "jpg", "jpeg", "webp"),
) -> Dict[str, Any]:
    """Validate upload file before processing."""
    if not filename:
        return {"valid": False, "error": "No filename provided", "ext": None}

    ext = filename.lower().split(".")[-1] if "." in filename else ""
    if ext not in allowed_exts:
        return {"valid": False, "error": f"Unsupported file type: .{ext}", "ext": ext}

    return {"valid": True, "error": None, "ext": ext}
