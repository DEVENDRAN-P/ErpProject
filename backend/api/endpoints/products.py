import io
import csv
import json
import ipaddress
import socket
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query, Body
from fastapi.responses import Response
from sqlalchemy.orm import Session

from backend.api.dependencies import get_current_user, get_db, AuthenticatedUser
from backend.models.product import Product
from backend.schemas.product import ProductRead, ProductCreate

from backend.services.product_service import (
    create_product,
    update_product_health_score,
    process_human_review_action,
    compute_dynamic_health_score,
    health_score_breakdown,
)
from backend.ai.agents.document_intelligence import parse_document, parse_url
from backend.validation import validate_product_twin
from backend.schemas.product import ProductTwinAttribute
from backend.status import canonical_status, STATUS_PENDING, STATUS_OPEN


router = APIRouter()


@router.get("", response_model=List[ProductRead])
@router.get("/", response_model=List[ProductRead])
def list_products(
    q: str | None = Query(None, description="Search query"),
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> List[ProductRead]:
    query = db.query(Product).filter(Product.created_by == current_user.email)
    if q:
        query = query.filter(
            (Product.name.ilike(f"%{q}%"))
            | (Product.category.ilike(f"%{q}%"))
            | (Product.model_number.ilike(f"%{q}%"))
        )
    return query.order_by(Product.created_at.desc()).all()


@router.get("/stats")
def dashboard_stats(db: Session = Depends(get_db), current_user: AuthenticatedUser = Depends(get_current_user)) -> Dict[str, Any]:
    """Aggregate dashboard statistics computed from real product data."""
    products = db.query(Product).filter(Product.created_by == current_user.email).all()
    total = len(products)

    pending_reviews = 0
    missing_attributes = 0
    open_conflicts = 0
    total_attributes = 0
    health_scores = []

    for p in products:
        health_scores.append(p.health_score or 0)
        total_attributes += len(p.attributes)
        missing_attributes += sum(1 for a in p.attributes if canonical_status(a.status) == "NOT_FOUND")
        open_conflicts += sum(1 for c in p.conflicts if canonical_status(c.status) == STATUS_OPEN)
        pending_reviews += sum(1 for r in p.review_items if canonical_status(r.status) == STATUS_PENDING)

    recent_changes = []
    for p in products:
        for v in p.versions:
            try:
                changes = json.loads(v.changes_json or "[]")
            except (TypeError, ValueError):
                changes = []
            for ch in changes:
                recent_changes.append({
                    "product_id": p.id,
                    "product_name": p.name,
                    "field": ch.get("field", ""),
                    "old": ch.get("old"),
                    "new": ch.get("new"),
                    "source": ch.get("source"),
                    "timestamp": ch.get("timestamp") or (v.created_at.isoformat() if v.created_at else None),
                })
    recent_changes.sort(key=lambda c: c.get("timestamp") or "", reverse=True)

    return {
        "total_products": total,
        "average_health_score": round(sum(health_scores) / total, 1) if total else 0,
        "products_requiring_review": sum(1 for p in products if p.review_items and any(canonical_status(r.status) == STATUS_PENDING for r in p.review_items)),
        "missing_attributes": missing_attributes,
        "open_conflicts": open_conflicts,
        "total_attributes": total_attributes,
        "pending_reviews": pending_reviews,
        "recent_changes": recent_changes[:10],
        "quality_overview": {
            "excellent": sum(1 for s in health_scores if s >= 80),
            "attention": sum(1 for s in health_scores if 60 <= s < 80),
            "needs_review": sum(1 for s in health_scores if s < 60),
        },
    }


@router.get("/{product_id}/health")
def product_health_breakdown(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    product = db.query(Product).filter(Product.id == product_id, Product.created_by == current_user.email).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return health_score_breakdown(product.attributes, product.conflicts)


@router.post("/ingest", response_model=ProductRead)
def ingest_product_endpoint(
    product_data: ProductCreate,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ProductRead:
    return create_product(db=db, product_data=product_data, created_by=current_user.email)


@router.get("/me")
def get_profile(current_user: AuthenticatedUser = Depends(get_current_user)):
    return {"uid": current_user.uid, "email": current_user.email, "display_name": current_user.display_name}


@router.get("/{product_id}", response_model=ProductRead)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ProductRead:
    product = db.query(Product).filter(Product.id == product_id, Product.created_by == current_user.email).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found or access denied")
    return product


@router.post("/upload")
def upload_product_document(
    file: UploadFile = File(...),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required.")

    # ── File type validation ──
    allowed_extensions = {"pdf", "csv", "txt", "png", "jpg", "jpeg", "webp"}
    ext = file.filename.lower().split(".")[-1] if "." in file.filename else ""
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: .{ext}. Allowed: {', '.join(allowed_extensions)}")

    # ── Read contents with size limit ──
    max_size = 10 * 1024 * 1024  # 10 MB
    contents = file.file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(contents) > max_size:
        raise HTTPException(status_code=413, detail="Uploaded file exceeds the maximum allowed size of 10 MB.")

    # ── Path traversal protection: reject filenames with separators ──
    if any(c in file.filename for c in ("/", "\\", "..")):
        raise HTTPException(status_code=400, detail="Invalid filename.")

    extracted = parse_document(contents, file.filename)
    text_content = extracted.get("text", "").lower()
    if not text_content.strip():
        raise HTTPException(
            status_code=422,
            detail="No text could be extracted from the document. Scanned PDFs require OCR, which is not available for this file.",
        )

    product_keywords = ["product", "model", "category", "spec", "voltage", "power", "weight", "dimen", "part", "brand", "manufacturer", "sku", "attr", "catalog", "rating", "unit", "item", "input", "output"]
    if not any(kw in text_content for kw in product_keywords) and len(text_content) > 50:
        raise HTTPException(
            status_code=422,
            detail="Unrelated upload rejected. The document does not appear to contain product catalog or specification data.",
        )
    return {
        "message": "Upload and extraction successful.",
        "filename": file.filename,
        "extraction": extracted,
    }


@router.post("/url-ingest")
def ingest_url_endpoint(
    payload: Dict[str, str] = Body(...),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> dict[str, Any]:
    url = (payload.get("url") or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="Please provide a valid website URL.")

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise HTTPException(status_code=422, detail="Invalid URL. Must start with http:// or https:// and include a host.")

    # ── SSRF Protection: block private/internal IPs ──
    hostname = parsed.hostname or ""
    if hostname in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
        raise HTTPException(status_code=422, detail="Access to localhost/internal URLs is not allowed.")
    try:
        resolved = socket.getaddrinfo(hostname, None)
        for info in resolved:
            addr = info[4][0]
            try:
                ip = ipaddress.ip_address(addr)
                if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                    raise HTTPException(status_code=422, detail="Access to private/internal network addresses is not allowed.")
            except ValueError:
                pass
    except socket.gaierror:
        raise HTTPException(status_code=422, detail="Could not resolve hostname.")
    except HTTPException:
        raise
    except Exception:
        pass

    result = parse_url(url)
    if result.get("status") == "error" or not result.get("text", "").strip():
        detail = result.get("error") or "Website returned no extractable content."
        raise HTTPException(status_code=422, detail=f"Unable to ingest URL: {detail}")

    return {
        "message": "Website content fetched.",
        "url": url,
        "result": result,
    }


def _export_row(attr) -> Dict[str, Any]:
    return {
        "key": attr.key,
        "label": attr.label,
        "raw_value": attr.raw_value,
        "value": attr.value,
        "normalized_value": attr.normalized_value,
        "unit": attr.unit,
        "confidence": attr.confidence,
        "status": canonical_status(attr.status),
        "source": attr.source,
        "page": attr.page,
        "evidence": attr.evidence,
        "evidence_quote": attr.evidence_quote,
        "lov_valid": attr.lov_valid,
        "uom_valid": attr.uom_valid,
    }


@router.get("/{product_id}/export/json")
def export_product_json(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id, Product.created_by == current_user.email).first()
    if not product:
        # Firestore fallback: product may have been saved only to Firestore
        try:
            from backend.core.firebase import firebase_app
            from firebase_admin import firestore
            fs = firestore.client(firebase_app)
            doc = fs.collection("users").document(current_user.uid).collection("products").document(str(product_id)).get()
            if doc.exists:
                data = doc.to_dict()
                export_payload = {
                    "product": {
                        "id": product_id,
                        "name": data.get("name", "Unknown"),
                        "model_number": data.get("model_number", ""),
                        "category": data.get("category", ""),
                        "description": data.get("description", ""),
                        "health_score": data.get("health_score", 0),
                    },
                    "attributes": data.get("attributes", []),
                    "conflicts": data.get("conflicts", []),
                    "exported_at": data.get("updated_at"),
                    "format": "commerce-ready",
                    "source": "firestore",
                }
                return Response(content=json.dumps(export_payload, indent=2), media_type="application/json")
        except Exception:
            pass
        raise HTTPException(status_code=404, detail="Product not found or access denied")

    export_payload = {
        "product": {
            "id": product.id,
            "name": product.name,
            "model_number": product.model_number,
            "category": product.category,
            "description": product.description,
            "health_score": product.health_score,
        },
        "attributes": [_export_row(attr) for attr in product.attributes],
        "conflicts": [
            {
                "attribute_key": c.attribute_key,
                "label": c.label,
                "sources": json.loads(c.sources_json or "[]"),
                "recommended_value": c.recommended_value,
                "reasoning": c.reasoning,
                "status": canonical_status(c.status),
            }
            for c in product.conflicts
        ],
        "exported_at": (product.updated_at or product.created_at).isoformat() if (product.updated_at or product.created_at) else None,
        "format": "commerce-ready",
        "provenance_note": "Every attribute row carries its source, page, evidence and confidence.",
    }
    return Response(content=json.dumps(export_payload, indent=2), media_type="application/json")


@router.get("/{product_id}/export/csv")
def export_product_csv(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id, Product.created_by == current_user.email).first()
    if not product:
        product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found or access denied")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Key", "Label", "Value", "Normalized Value", "Unit", "Confidence", "Status",
        "Source", "Page", "Evidence", "Evidence Quote", "LOV Valid", "UOM Valid",
    ])

    for attr in product.attributes:
        writer.writerow([
            attr.key,
            attr.label,
            attr.value or "",
            attr.normalized_value or "",
            attr.unit or "",
            attr.confidence,
            canonical_status(attr.status),
            attr.source or "",
            attr.page or 1,
            attr.evidence or "",
            attr.evidence_quote or "",
            attr.lov_valid,
            attr.uom_valid,
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=product_{product.model_number or product.id}_export.csv"},
    )


@router.post("/{product_id}/validate", response_model=Dict[str, Any])
def validate_product_endpoint(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Validate a product's attributes with the Product Data Validation Engine.

    Returns per-attribute and overall results including LOV, UOM, manufacturer,
    required-field, description, evidence, and conflict checks.
    """
    product = db.query(Product).filter(Product.id == product_id, Product.created_by == current_user.email).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found or access denied")

    all_errors: List[str] = []
    all_warnings: List[str] = []
    checks: Dict[str, bool] = {}
    attributes_validated: List[Dict[str, Any]] = []

    for attr in product.attributes:
        twin_attr = ProductTwinAttribute(
            attribute=attr.key,
            raw_value=attr.raw_value or attr.value,
            normalized_value=attr.normalized_value or attr.value,
            unit=attr.unit,
            confidence=attr.confidence or 0.0,
            status=canonical_status(attr.status),
            source=attr.source,
            source_page=attr.page,
            evidence=attr.evidence,
            lov_valid=attr.lov_valid,
            uom_valid=attr.uom_valid,
            needs_human_review=attr.needs_human_review,
        )
        result = validate_product_twin(twin_attr)
        attributes_validated.append(
            {
                "attribute": attr.key,
                "label": attr.label,
                "valid": result["valid"],
                "errors": result["errors"],
                "warnings": result["warnings"],
                "checks": result["checks"],
                "needs_human_review": result["needs_human_review"],
                "severity": result["severity"],
            }
        )
        if not result["valid"]:
            all_errors.extend(result["errors"])
        all_warnings.extend(result["warnings"])
        for check_name, check_valid in result["checks"].items():
            if check_name not in checks:
                checks[check_name] = check_valid
            else:
                checks[check_name] = checks[check_name] and check_valid

    all_valid = all(checks.values()) if checks else True
    needs_review = not all_valid or any(a["needs_human_review"] for a in attributes_validated)
    severity = "ERROR" if not all_valid else ("WARNING" if all_warnings else "PASS")

    return {
        "valid": all_valid,
        "errors": all_errors,
        "warnings": all_warnings,
        "checks": checks,
        "needs_human_review": needs_review,
        "attributes_validated": attributes_validated,
        "severity": severity,
    }
