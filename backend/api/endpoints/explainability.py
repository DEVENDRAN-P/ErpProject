"""Team 2: Explainability API endpoints."""

import json
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.dependencies import get_current_user, get_db, AuthenticatedUser
from backend.models.product import Product, ExplanationLog
from backend.schemas.product import ExplainabilityResponse, AttributeExplanation
from backend.ai.agents.explainability_agent import explain_product, explain_attribute

router = APIRouter()


def _product_to_dict(product: Product) -> Dict[str, Any]:
    """Convert a Product ORM model to a dict for the agent."""
    return {
        "id": product.id,
        "name": product.name,
        "model_number": product.model_number,
        "category": product.category,
        "health_score": product.health_score,
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
    }


@router.get("/{product_id}/explainability", response_model=ExplainabilityResponse)
def get_product_explainability(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ExplainabilityResponse:
    """Get full explainability report for a product."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product_dict = _product_to_dict(product)
    result = explain_product(product_dict)

    # Store explanation logs for audit
    for explanation in result.get("explanations", []):
        existing = (
            db.query(ExplanationLog)
            .filter(
                ExplanationLog.product_id == product_id,
                ExplanationLog.attribute_key == explanation["attribute_key"],
            )
            .first()
        )
        if not existing:
            log = ExplanationLog(
                product_id=product_id,
                attribute_key=explanation["attribute_key"],
                attribute_label=explanation.get("attribute_label"),
                source_document=explanation.get("source_document"),
                source_page=explanation.get("source_page"),
                extraction_method=explanation.get("extraction_method"),
                confidence_score=explanation.get("confidence_score", 0.0),
                confidence_breakdown=json.dumps(explanation.get("confidence_breakdown", {})),
                chosen_value=explanation.get("chosen_value"),
                alternative_values=json.dumps(explanation.get("alternative_values", [])),
                evidence_quote=explanation.get("evidence_quote"),
                reasoning_chain=json.dumps(explanation.get("reasoning_chain", [])),
            )
            db.add(log)

    db.commit()

    return ExplainabilityResponse(**result)


@router.get("/{product_id}/explainability/{attr_key}")
def get_attribute_explanation(
    product_id: int,
    attr_key: str,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get detailed explanation for a single attribute."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Find the attribute
    attr = None
    for a in product.attributes:
        if a.key == attr_key:
            attr = a
            break

    if not attr:
        raise HTTPException(status_code=404, detail=f"Attribute '{attr_key}' not found")

    attr_dict = {
        "key": attr.key,
        "label": attr.label,
        "value": attr.value,
        "normalized_value": attr.normalized_value,
        "raw_value": attr.raw_value,
        "unit": attr.unit,
        "confidence": attr.confidence,
        "source": attr.source,
        "page": attr.page,
        "status": attr.status,
        "evidence": attr.evidence,
        "evidence_quote": attr.evidence_quote,
    }

    explanation = explain_attribute(attr_dict)

    # Store in audit log
    existing = (
        db.query(ExplanationLog)
        .filter(
            ExplanationLog.product_id == product_id,
            ExplanationLog.attribute_key == attr_key,
        )
        .first()
    )
    if not existing:
        log = ExplanationLog(
            product_id=product_id,
            attribute_key=attr_key,
            attribute_label=explanation.get("attribute_label"),
            source_document=explanation.get("source_document"),
            source_page=explanation.get("source_page"),
            extraction_method=explanation.get("extraction_method"),
            confidence_score=explanation.get("confidence_score", 0.0),
            confidence_breakdown=json.dumps(explanation.get("confidence_breakdown", {})),
            chosen_value=explanation.get("chosen_value"),
            alternative_values=json.dumps(explanation.get("alternative_values", [])),
            evidence_quote=explanation.get("evidence_quote"),
            reasoning_chain=json.dumps(explanation.get("reasoning_chain", [])),
        )
        db.add(log)
        db.commit()

    return explanation


@router.get("/{product_id}/explainability/audit-trail")
def get_explainability_audit_trail(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> list:
    """Get the explanation audit trail for a product."""
    logs = (
        db.query(ExplanationLog)
        .filter(ExplanationLog.product_id == product_id)
        .order_by(ExplanationLog.created_at.desc())
        .all()
    )

    return [
        {
            "id": log.id,
            "attribute_key": log.attribute_key,
            "attribute_label": log.attribute_label,
            "extraction_method": log.extraction_method,
            "confidence_score": log.confidence_score,
            "chosen_value": log.chosen_value,
            "source_document": log.source_document,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]
