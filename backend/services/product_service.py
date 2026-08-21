import json
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.models.product import Product, ProductAttribute, ReviewItem, ProductVersion, ProductTruthConflict
from backend.reference_data import load_reference_data
from backend.schemas.product import ProductCreate
from backend.status import (
    STATUS_VERIFIED,
    STATUS_NORMALIZED,
    STATUS_NOT_FOUND,
    STATUS_CONFLICT,
    STATUS_NEEDS_REVIEW,
    STATUS_OPEN,
    STATUS_RESOLVED,
    STATUS_REJECTED,
    STATUS_APPROVED,
    STATUS_EDITED,
    STATUS_PENDING,
    canonical_status,
)

REQUIRED_KEYS = ["rated_power", "supply_voltage", "rated_current", "efficiency_class", "rated_speed", "max_temperature", "frame_size", "total_weight"]

# Ensure validation reference data (LOV / UOM / manufacturer) is always
# available, even when the pipeline is invoked outside the FastAPI lifespan.
load_reference_data()


def _parse_number(value: Any) -> Optional[float]:
    """Best-effort numeric parse for value comparison."""
    if value is None:
        return None
    s = str(value).strip()
    m = re.search(r"-?\d+(?:[.,]\d+)?", s)
    if not m:
        return None
    try:
        return float(m.group(0).replace(",", "."))
    except ValueError:
        return None


def _values_conflict(value_a: Any, value_b: Any) -> bool:
    """Compare two extracted values, tolerating formatting differences."""
    if value_a is None or value_b is None:
        return False
    a_str = str(value_a).strip().lower()
    b_str = str(value_b).strip().lower()
    if a_str == b_str:
        return False
    a_num = _parse_number(a_str)
    b_num = _parse_number(b_str)
    if a_num is not None and b_num is not None:
        # Numeric comparison with 5% tolerance for formatting noise
        if abs(a_num - b_num) / max(abs(a_num), abs(b_num), 1e-9) < 0.05:
            return False
    return True


def compute_dynamic_health_score(attributes: List[ProductAttribute], conflicts: List[ProductTruthConflict]) -> int:
    """Health score = 40% completeness + 30% consistency + 20% confidence + 10% source reliability."""
    if not attributes:
        return 0

    attr_map = {attr.key: attr for attr in attributes}

    # 1. Completeness (40% weight)
    valid_count = sum(
        1 for k in REQUIRED_KEYS
        if k in attr_map and attr_map[k].value and canonical_status(attr_map[k].status) not in (STATUS_NOT_FOUND,)
    )
    completeness = (valid_count / len(REQUIRED_KEYS)) * 100.0

    # 2. Consistency (30% weight)
    open_conflicts = (
        sum(1 for c in conflicts if canonical_status(c.status) == STATUS_OPEN)
        + sum(1 for a in attributes if canonical_status(a.status) == STATUS_CONFLICT)
    )
    consistency = max(0.0, 100.0 - (open_conflicts * 25.0))

    # 3. Confidence (20% weight)
    confidences = [a.confidence * 100.0 for a in attributes if a.confidence is not None]
    avg_confidence = (sum(confidences) / len(confidences)) if confidences else 75.0

    # 4. Source Reliability (10% weight)
    reliable_count = sum(
        1 for a in attributes
        if a.source and (".pdf" in a.source.lower() or "datasheet" in a.source.lower())
    )
    source_reliability = (reliable_count / max(1, len(attributes))) * 100.0

    weighted_score = (0.40 * completeness) + (0.30 * consistency) + (0.20 * avg_confidence) + (0.10 * source_reliability)
    return max(0, min(100, int(round(weighted_score))))


def health_score_breakdown(attributes: List[ProductAttribute], conflicts: List[ProductTruthConflict]) -> Dict[str, Any]:
    """Return the four weighted components of the health score with explanation."""
    if not attributes:
        return {
            "score": 0,
            "completeness": 0.0,
            "consistency": 100.0,
            "confidence": 0.0,
            "source_reliability": 0.0,
            "explanation": "No attributes to score.",
        }

    attr_map = {attr.key: attr for attr in attributes}

    valid_count = sum(
        1 for k in REQUIRED_KEYS
        if k in attr_map and attr_map[k].value and canonical_status(attr_map[k].status) not in (STATUS_NOT_FOUND,)
    )
    completeness = round((valid_count / len(REQUIRED_KEYS)) * 100.0, 1)

    open_conflicts = (
        sum(1 for c in conflicts if canonical_status(c.status) == STATUS_OPEN)
        + sum(1 for a in attributes if canonical_status(a.status) == STATUS_CONFLICT)
    )
    consistency = round(max(0.0, 100.0 - (open_conflicts * 25.0)), 1)

    confidences = [a.confidence * 100.0 for a in attributes if a.confidence is not None]
    avg_confidence = round((sum(confidences) / len(confidences)) if confidences else 75.0, 1)

    reliable_count = sum(
        1 for a in attributes
        if a.source and (".pdf" in a.source.lower() or "datasheet" in a.source.lower())
    )
    source_reliability = round((reliable_count / max(1, len(attributes))) * 100.0, 1)

    score = int(round(
        0.40 * completeness + 0.30 * consistency + 0.20 * avg_confidence + 0.10 * source_reliability
    ))

    return {
        "score": score,
        "completeness": completeness,
        "consistency": consistency,
        "confidence": avg_confidence,
        "source_reliability": source_reliability,
        "weights": {"completeness": 0.40, "consistency": 0.30, "confidence": 0.20, "source_reliability": 0.10},
        "explanation": (
            f"{valid_count}/{len(REQUIRED_KEYS)} required specs present ({completeness}%), "
            f"{open_conflicts} open conflict(s) (consistency {consistency}%), "
            f"avg confidence {avg_confidence}%, {reliable_count}/{len(attributes)} datasheet-backed sources ({source_reliability}%)"
        ),
    }


def create_product(db: Session, product_data: ProductCreate, created_by: str | None = None) -> Product:
    product = Product(
        name=product_data.name,
        model_number=product_data.model_number,
        category=product_data.category,
        description=product_data.description,
        created_by=created_by,
    )
    db.add(product)
    db.flush()

    for attribute in product_data.attributes:
        status = canonical_status(attribute.status or "verified")
        product_attribute = ProductAttribute(
            product_id=product.id,
            key=attribute.key,
            label=attribute.label,
            raw_value=attribute.raw_value,
            normalized_value=attribute.normalized_value,
            value=attribute.value,
            unit=attribute.unit,
            confidence=attribute.confidence,
            source=attribute.source,
            page=attribute.page or 1,
            evidence=attribute.evidence,
            evidence_quote=attribute.evidence_quote,
            status=status,
            lov_valid=attribute.lov_valid,
            uom_valid=attribute.uom_valid,
            needs_human_review=attribute.needs_human_review,
        )
        db.add(product_attribute)

    for review_item in product_data.review_items:
        db.add(
            ReviewItem(
                product_id=product.id,
                title=review_item.title,
                item_type=review_item.item_type,
                description=review_item.description,
                action=review_item.action,
                status=canonical_status(review_item.status or "pending"),
            )
        )

    db.flush()
    # Create initial version 1
    version_1 = ProductVersion(
        product_id=product.id,
        version_number=1,
        changes_json=json.dumps([
            {
                "field": "Product Ingested",
                "old": "None",
                "new": product.model_number or product.name,
                "source": "Catalog Ingest",
                "timestamp": datetime.utcnow().isoformat(),
            }
        ]),
    )
    db.add(version_1)

    product.health_score = compute_dynamic_health_score(product.attributes, product.conflicts)
    db.commit()
    db.refresh(product)
    return product


def merge_source_into_product(
    db: Session,
    product: Product,
    attributes: List[Dict[str, Any]],
    source: str,
    created_by: str | None = None,
) -> Dict[str, Any]:
    """Merge attributes extracted from a new source into an existing product.

    Values that already exist with a different value from another source are
    NOT silently overwritten — a ProductTruthConflict is created and both the
    existing and the new value are preserved (the new source gets its own
    attribute row marked CONFLICT).
    """
    changes: List[Dict[str, Any]] = []
    new_conflicts: List[ProductTruthConflict] = []
    new_reviews: List[ReviewItem] = []

    existing_map = {attr.key: attr for attr in product.attributes}

    for item in attributes:
        key = item.get("key")
        if not key:
            continue
        value = item.get("value")
        if value is None:
            continue

        existing = existing_map.get(key)

        if existing is not None and existing.value is not None and _values_conflict(existing.value, value):
            # Conflicting value from a second source — record it, never overwrite.
            label = existing.label or key
            existing_status = canonical_status(existing.status)

            new_attr = ProductAttribute(
                product_id=product.id,
                key=key,
                label=label,
                raw_value=item.get("raw_value"),
                normalized_value=item.get("normalized_value") or item.get("value"),
                value=str(value),
                unit=item.get("unit") or existing.unit,
                confidence=float(item.get("confidence") or 0.5),
                source=source,
                page=item.get("page") or 1,
                evidence=item.get("evidence") or f"Extracted from {source}",
                evidence_quote=item.get("evidence_quote"),
                status=STATUS_CONFLICT,
                lov_valid=bool(item.get("lov_valid", False)),
                uom_valid=bool(item.get("uom_valid", False)),
                needs_human_review=True,
            )
            db.add(new_attr)

            # Determine recommended value: prefer the higher-confidence source
            existing_conf = existing.confidence or 0.0
            new_conf = float(item.get("confidence") or 0.5)
            if existing_conf >= new_conf:
                rec_value = f"{existing.value} {existing.unit or ''}".strip()
                rec_source = existing.source or "existing"
            else:
                rec_value = f"{value} {item.get('unit') or existing.unit or ''}".strip()
                rec_source = source
            reasoning = (
                f"Source '{rec_source}' has higher confidence ({max(existing_conf, new_conf):.0%}) "
                f"than the alternative. A human review is recommended to confirm."
            )

            conflict = ProductTruthConflict(
                product_id=product.id,
                attribute_key=key,
                label=label,
                sources_json=json.dumps([
                    {
                        "source": existing.source or "existing",
                        "value": f"{existing.value} {existing.unit or ''}".strip(),
                        "confidence": existing.confidence or 0.0,
                        "evidence": existing.evidence or "",
                        "page": existing.page or 1,
                    },
                    {
                        "source": source,
                        "value": f"{value} {item.get('unit') or existing.unit or ''}".strip(),
                        "confidence": float(item.get("confidence") or 0.5),
                        "evidence": item.get("evidence") or "",
                        "page": item.get("page") or 1,
                    },
                ]),
                recommended_value=rec_value,
                reasoning=reasoning,
                status=STATUS_OPEN,
            )
            db.add(conflict)
            new_conflicts.append(conflict)

            new_reviews.append(
                ReviewItem(
                    product_id=product.id,
                    title=f"Conflict: {label} ({existing.value} vs {value})",
                    item_type="conflict",
                    description=(
                        f"Source '{existing.source}' reports {existing.value} {existing.unit or ''} while "
                        f"source '{source}' reports {value} {item.get('unit') or ''}. "
                        "A human decision is required; the system will not pick a winner automatically."
                    ),
                    action="Resolve conflict",
                    status=STATUS_PENDING,
                )
            )

            changes.append({
                "field": label,
                "old": f"{existing.value} {existing.unit or ''}".strip(),
                "new": f"{value} {item.get('unit') or ''}".strip(),
                "source": source,
                "evidence": "Conflicting value from additional source — conflict created",
                "timestamp": datetime.utcnow().isoformat(),
            })

        elif existing is None:
            # New attribute from this source
            status = STATUS_EXTRACTED if value else STATUS_NOT_FOUND
            new_attr = ProductAttribute(
                product_id=product.id,
                key=key,
                label=item.get("label") or key,
                raw_value=item.get("raw_value"),
                normalized_value=item.get("normalized_value") or item.get("value"),
                value=str(value) if value is not None else None,
                unit=item.get("unit"),
                confidence=float(item.get("confidence") or 0.0),
                source=source,
                page=item.get("page") or 1,
                evidence=item.get("evidence"),
                evidence_quote=item.get("evidence_quote"),
                status=status,
                lov_valid=bool(item.get("lov_valid", False)),
                uom_valid=bool(item.get("uom_valid", False)),
                needs_human_review=status == STATUS_NOT_FOUND,
            )
            db.add(new_attr)
            changes.append({
                "field": item.get("label") or key,
                "old": "N/A",
                "new": f"{value} {item.get('unit') or ''}".strip() if value is not None else "NOT_FOUND",
                "source": source,
                "evidence": item.get("evidence") or "New attribute extracted from additional source",
                "timestamp": datetime.utcnow().isoformat(),
            })
        # else: same value from multiple sources — no conflict, nothing to do

    db.flush()

    # Version bump if anything changed
    if changes:
        next_ver_num = max([v.version_number for v in product.versions] or [0]) + 1
        db.add(
            ProductVersion(
                product_id=product.id,
                version_number=next_ver_num,
                changes_json=json.dumps(changes),
            )
        )

    if new_reviews:
        db.add_all(new_reviews)

    product.health_score = compute_dynamic_health_score(product.attributes, product.conflicts)
    product.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(product)

    return {
        "product_id": product.id,
        "conflicts_created": len(new_conflicts),
        "changes_logged": len(changes),
    }


def update_product_health_score(db: Session, product_id: int) -> int:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return 0

    new_score = compute_dynamic_health_score(product.attributes, product.conflicts)
    product.health_score = new_score
    product.updated_at = datetime.utcnow()
    db.commit()
    return new_score


def log_catalogpilot_change(
    db: Session,
    product_id: int,
    field_name: str,
    old_val: str,
    new_val: str,
    source: str,
    evidence: str,
    reviewer: str | None = None,
) -> ProductVersion:
    product = db.query(Product).filter(Product.id == product_id).first()
    next_ver_num = max([v.version_number for v in product.versions] or [0]) + 1 if product else 1

    change_entry = {
        "field": field_name,
        "old": old_val or "N/A",
        "new": new_val,
        "source": source or "Human Review",
        "evidence": evidence or "Approved by Catalog Owner",
        "reviewer": reviewer or "system",
        "timestamp": datetime.utcnow().isoformat(),
    }

    new_ver = ProductVersion(
        product_id=product_id,
        version_number=next_ver_num,
        changes_json=json.dumps([change_entry]),
    )
    db.add(new_ver)
    db.commit()
    db.refresh(new_ver)
    return new_ver


def process_human_review_action(
    db: Session,
    review_id: int,
    action: str,
    edited_value: Optional[str] = None,
    comment: Optional[str] = None,
    reviewer: Optional[str] = None,
) -> Dict[str, Any]:
    item = db.query(ReviewItem).filter(ReviewItem.id == review_id).first()
    if not item:
        raise ValueError(f"Review item {review_id} not found.")

    product = item.product
    action_key = action.strip().lower()
    if action_key not in ("approved", "rejected", "edited"):
        raise ValueError(f"Unsupported review action: {action}")

    canonical_action = {
        "approved": STATUS_APPROVED,
        "rejected": STATUS_REJECTED,
        "edited": STATUS_EDITED,
    }[action_key]

    item.status = canonical_action
    item.reviewer = reviewer or "reviewer@productpilot.ai"
    item.reason = comment
    item.reviewed_at = datetime.utcnow()

    field_modified = item.title
    old_val = "Pending Review"
    new_val = edited_value or canonical_action.capitalize()

    # Search for associated attribute to mutate state
    matching_attr = None
    for attr in product.attributes:
        if attr.label.lower() in item.title.lower() or attr.key.lower() in item.title.lower():
            matching_attr = attr
            break

    if matching_attr:
        old_val = f"{matching_attr.value} {matching_attr.unit or ''}".strip() or "None"
        item.previous_value = old_val
        if action_key == "approved":
            matching_attr.status = STATUS_VERIFIED
            matching_attr.confidence = 1.0
            matching_attr.needs_human_review = False
            new_val = old_val
        elif action_key == "rejected":
            matching_attr.status = STATUS_NOT_FOUND
            matching_attr.value = None
            matching_attr.confidence = 0.0
            matching_attr.needs_human_review = False
            new_val = "REJECTED"
        elif action_key == "edited" and edited_value:
            matching_attr.value = edited_value
            matching_attr.status = STATUS_VERIFIED
            matching_attr.confidence = 1.0
            matching_attr.needs_human_review = False
            new_val = f"{edited_value} {matching_attr.unit or ''}".strip()
        item.new_value = new_val

    # Resolve associated conflicts
    for conflict in product.conflicts:
        if conflict.label.lower() in item.title.lower() or conflict.attribute_key.lower() in item.title.lower():
            if action_key in ("approved", "edited"):
                conflict.status = STATUS_RESOLVED
                conflict.reviewer = item.reviewer
                conflict.resolution = comment or f"Resolved via review action '{action_key}'"
                conflict.resolved_at = datetime.utcnow()
                if action_key == "edited" and edited_value:
                    conflict.recommended_value = f"{edited_value} {matching_attr.unit or ''}".strip() if matching_attr else edited_value
            elif action_key == "rejected":
                conflict.status = STATUS_REJECTED
                conflict.reviewer = item.reviewer
                conflict.resolution = comment or "Rejected during human review"
                conflict.resolved_at = datetime.utcnow()

    # Log line-by-line diff in CatalogPilot
    log_catalogpilot_change(
        db=db,
        product_id=product.id,
        field_name=field_modified,
        old_val=old_val,
        new_val=new_val,
        source="Human Reviewer Queue",
        evidence=comment or f"User marked item as {action_key}",
        reviewer=item.reviewer,
    )

    # Recalculate dynamic health score
    new_score = compute_dynamic_health_score(product.attributes, product.conflicts)
    product.health_score = new_score
    product.updated_at = datetime.utcnow()

    db.commit()

    return {
        "review_id": review_id,
        "status": item.status,
        "product_id": product.id,
        "new_health_score": new_score,
    }
