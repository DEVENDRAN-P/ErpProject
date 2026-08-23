"""Team 3: Batch Operations & Data Quality Reports API endpoints."""

import csv
import io
import json
from typing import List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session

from backend.api.dependencies import get_current_user, get_db, AuthenticatedUser
from backend.models.product import Product, ProductAttribute
from backend.schemas.product import (
    BatchImportInput, BatchImportItem, BatchImportResponse,
    DataQualityResponse, ComplianceReportResponse, AuditTrailEntry,
)
from backend.services.product_service import create_product
from backend.ai.agents.export_agent import (
    export_products_csv,
    export_products_json,
    compute_data_quality_metrics,
    compute_compliance_report,
    compute_audit_trail,
)

router = APIRouter()


def _product_to_dict(product: Product) -> Dict[str, Any]:
    """Convert a Product ORM model to a dict."""
    return {
        "id": product.id,
        "name": product.name,
        "model_number": product.model_number,
        "category": product.category,
        "description": product.description,
        "health_score": product.health_score,
        "created_at": product.created_at.isoformat() if product.created_at else None,
        "updated_at": product.updated_at.isoformat() if product.updated_at else None,
        "attributes": [
            {
                "key": a.key,
                "label": a.label,
                "value": a.value,
                "normalized_value": a.normalized_value,
                "raw_value": a.raw_value,
                "unit": a.unit,
                "confidence": a.confidence,
                "source": a.source,
                "page": a.page,
                "status": a.status,
                "evidence": a.evidence,
                "evidence_quote": a.evidence_quote,
            }
            for a in product.attributes
        ],
        "conflicts": [
            {
                "id": c.id,
                "attribute_key": c.attribute_key,
                "label": c.label,
                "status": c.status,
                "recommended_value": c.recommended_value,
            }
            for c in product.conflicts
        ],
        "versions": [
            {
                "id": v.id,
                "version_number": v.version_number,
                "changes_json": v.changes_json,
                "created_at": v.created_at.isoformat() if v.created_at else None,
            }
            for v in product.versions
        ],
        "review_items": [
            {
                "id": r.id,
                "title": r.title,
                "item_type": r.item_type,
                "status": r.status,
                "reviewer": r.reviewer,
                "previous_value": r.previous_value,
                "new_value": r.new_value,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
            }
            for r in product.review_items
        ],
    }


# ─── Batch Import ────────────────────────────────────────────────────────

@router.post("/batch/import", response_model=BatchImportResponse)
def batch_import_products(
    import_data: BatchImportInput,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> BatchImportResponse:
    """Import multiple products from structured data."""
    succeeded = 0
    failed = 0
    errors = []
    product_ids = []

    for idx, item in enumerate(import_data.products):
        try:
            from backend.schemas.product import ProductCreate, ProductAttributeCreate

            attrs = []
            for a in item.attributes:
                attrs.append(ProductAttributeCreate(
                    key=a.get("key", ""),
                    label=a.get("label", a.get("key", "")),
                    value=a.get("value"),
                    confidence=a.get("confidence", 0.5),
                    source=a.get("source"),
                    evidence=a.get("evidence"),
                    status=a.get("status", "verified"),
                ))

            product_create = ProductCreate(
                name=item.name,
                model_number=item.model_number,
                category=item.category,
                description=item.description,
                attributes=attrs,
            )

            product = create_product(db=db, product_data=product_create, created_by=current_user.email)
            product_ids.append(product.id)
            succeeded += 1
        except Exception as e:
            failed += 1
            errors.append({"index": idx, "name": item.name, "error": str(e)})

    return BatchImportResponse(
        total=len(import_data.products),
        succeeded=succeeded,
        failed=failed,
        errors=errors,
        product_ids=product_ids,
    )


@router.post("/batch/import/csv")
def batch_import_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> BatchImportResponse:
    """Import products from a CSV file.
    
    Each valid row becomes an individual product. Uses the CSV-specific
    pipeline for proper column mapping and per-row processing.
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")

    contents = file.file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    from backend.services.csv_pipeline_service import process_csv_rows
    
    result = process_csv_rows(
        csv_content=contents,
        db=db,
        created_by=current_user.email if current_user else None,
    )
    
    # Map to BatchImportResponse format
    return BatchImportResponse(
        total=result.get("total_rows", 0),
        succeeded=result.get("products_created", 0),
        failed=result.get("invalid_rows", 0),
        errors=result.get("errors", []),
        product_ids=[p["id"] for p in result.get("products", [])],
    )


# ─── Batch Export ─────────────────────────────────────────────────────────

@router.get("/batch/export")
def batch_export_products(
    format: str = "json",
    category: str | None = None,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Export all products as CSV or JSON with full provenance."""
    query = db.query(Product).filter(Product.created_by == current_user.email)
    if category:
        query = query.filter(Product.category == category)
    products = query.all()
    product_dicts = [_product_to_dict(p) for p in products]

    if format == "csv":
        csv_content = export_products_csv(product_dicts)
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=nexgen_batch_export.csv"},
        )
    else:
        json_data = export_products_json(product_dicts)
        return Response(
            content=json.dumps(json_data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=nexgen_batch_export.json"},
        )


# ─── Reports ─────────────────────────────────────────────────────────────

@router.get("/reports/data-quality")
def get_data_quality_report(
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get aggregate data quality metrics across all products."""
    products = db.query(Product).filter(Product.created_by == current_user.email).all()
    product_dicts = [_product_to_dict(p) for p in products]
    return compute_data_quality_metrics(product_dicts)


@router.get("/reports/compliance")
def get_compliance_report(
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get compliance status by category."""
    products = db.query(Product).filter(Product.created_by == current_user.email).all()
    product_dicts = [_product_to_dict(p) for p in products]
    return compute_compliance_report(product_dicts)


@router.get("/reports/audit-trail")
def get_audit_trail(
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Get all review actions with timestamps."""
    products = db.query(Product).filter(Product.created_by == current_user.email).all()
    product_dicts = [_product_to_dict(p) for p in products]
    return compute_audit_trail(product_dicts)
