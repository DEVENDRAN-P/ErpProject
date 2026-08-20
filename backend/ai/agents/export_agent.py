"""Export Agent — rich export with metadata, timestamps, provenance.

Handles batch CSV/JSON export with full product data lineage.
"""

import csv
import io
import json
from datetime import datetime
from typing import List, Dict, Any, Optional


def export_products_csv(products: List[Dict[str, Any]]) -> str:
    """Export multiple products as a CSV string with full provenance metadata."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([
        "Product ID", "Name", "Model Number", "Category", "Health Score",
        "Attribute Key", "Attribute Label", "Value", "Unit", "Confidence",
        "Source", "Page", "Status", "Evidence", "Exported At",
    ])

    now = datetime.utcnow().isoformat()

    for product in products:
        pid = product.get("id", "")
        name = product.get("name", "")
        model = product.get("model_number", "")
        category = product.get("category", "")
        health = product.get("health_score", 0)
        attributes = product.get("attributes", [])

        if not attributes:
            # Write a row with just product info
            writer.writerow([pid, name, model, category, health, "", "", "", "", "", "", "", "", "", now])
        else:
            for attr in attributes:
                writer.writerow([
                    pid, name, model, category, health,
                    attr.get("key", ""),
                    attr.get("label", ""),
                    attr.get("value") or "",
                    attr.get("unit") or "",
                    attr.get("confidence", 0),
                    attr.get("source") or "",
                    attr.get("page") or "",
                    attr.get("status") or "",
                    attr.get("evidence") or "",
                    now,
                ])

    return output.getvalue()


def export_products_json(products: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Export multiple products as a structured JSON object with metadata."""
    now = datetime.utcnow().isoformat()

    export_data = {
        "metadata": {
            "exported_at": now,
            "format": "productpilot-batch-export",
            "version": "1.0",
            "total_products": len(products),
            "provenance_note": "Every attribute carries source, page, evidence, and confidence for full auditability.",
        },
        "products": [],
    }

    for product in products:
        product_entry = {
            "id": product.get("id"),
            "name": product.get("name"),
            "model_number": product.get("model_number"),
            "category": product.get("category"),
            "description": product.get("description"),
            "health_score": product.get("health_score"),
            "created_at": product.get("created_at"),
            "updated_at": product.get("updated_at"),
            "attributes": [
                {
                    "key": attr.get("key"),
                    "label": attr.get("label"),
                    "value": attr.get("value"),
                    "normalized_value": attr.get("normalized_value"),
                    "unit": attr.get("unit"),
                    "confidence": attr.get("confidence"),
                    "source": attr.get("source"),
                    "page": attr.get("page"),
                    "status": attr.get("status"),
                    "evidence": attr.get("evidence"),
                    "evidence_quote": attr.get("evidence_quote"),
                }
                for attr in product.get("attributes", [])
            ],
            "conflicts": product.get("conflicts", []),
        }
        export_data["products"].append(product_entry)

    return export_data


def compute_data_quality_metrics(products: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compute aggregate data quality metrics across all products."""
    total = len(products)
    if total == 0:
        return {
            "total_products": 0,
            "overall_quality_score": 0,
            "completeness_by_category": {},
            "missing_by_attribute": {},
            "conflict_rate": 0,
            "resolution_rate": 0,
        }

    total_attributes = 0
    total_filled = 0
    total_conflicts = 0
    resolved_conflicts = 0
    missing_by_attribute: Dict[str, int] = {}
    completeness_by_category: Dict[str, Dict[str, int]] = {}
    health_scores = []

    for product in products:
        category = product.get("category", "Uncategorized")
        if category not in completeness_by_category:
            completeness_by_category[category] = {"total": 0, "filled": 0}

        health_scores.append(product.get("health_score", 0))

        for attr in product.get("attributes", []):
            total_attributes += 1
            completeness_by_category[category]["total"] += 1
            value = attr.get("value")
            if value:
                total_filled += 1
                completeness_by_category[category]["filled"] += 1
            else:
                key = attr.get("label") or attr.get("key") or "unknown"
                missing_by_attribute[key] = missing_by_attribute.get(key, 0) + 1

        for conflict in product.get("conflicts", []):
            total_conflicts += 1
            if conflict.get("status") in ("RESOLVED", "resolved", "APPROVED", "approved"):
                resolved_conflicts += 1

    overall_quality = round(sum(health_scores) / total, 1) if health_scores else 0

    # Calculate completeness percentages by category
    for cat, data in completeness_by_category.items():
        data["completeness_pct"] = round((data["filled"] / data["total"] * 100), 1) if data["total"] > 0 else 0

    return {
        "total_products": total,
        "overall_quality_score": overall_quality,
        "total_attributes": total_attributes,
        "filled_attributes": total_filled,
        "completeness_rate": round(total_filled / total_attributes * 100, 1) if total_attributes > 0 else 0,
        "total_conflicts": total_conflicts,
        "resolved_conflicts": resolved_conflicts,
        "conflict_rate": round(total_conflicts / total * 100, 1) if total > 0 else 0,
        "resolution_rate": round(resolved_conflicts / total_conflicts * 100, 1) if total_conflicts > 0 else 100,
        "completeness_by_category": completeness_by_category,
        "missing_by_attribute": missing_by_attribute,
        "health_distribution": {
            "excellent": sum(1 for s in health_scores if s >= 80),
            "attention": sum(1 for s in health_scores if 60 <= s < 80),
            "needs_review": sum(1 for s in health_scores if s < 60),
        },
    }


def compute_compliance_report(products: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compute compliance status by category."""
    compliance_by_category: Dict[str, Dict[str, Any]] = {}

    for product in products:
        category = product.get("category", "Uncategorized")
        if category not in compliance_by_category:
            compliance_by_category[category] = {
                "total_products": 0,
                "compliant": 0,
                "non_compliant": 0,
                "pending": 0,
            }

        compliance_by_category[category]["total_products"] += 1
        health = product.get("health_score", 0)

        if health >= 80:
            compliance_by_category[category]["compliant"] += 1
        elif health >= 60:
            compliance_by_category[category]["pending"] += 1
        else:
            compliance_by_category[category]["non_compliant"] += 1

    total_products = len(products)
    total_compliant = sum(c["compliant"] for c in compliance_by_category.values())

    return {
        "total_products": total_products,
        "overall_compliance_rate": round(total_compliant / total_products * 100, 1) if total_products > 0 else 0,
        "by_category": compliance_by_category,
    }


def compute_audit_trail(products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Compute audit trail from product versions and review actions."""
    trail = []

    for product in products:
        for version in product.get("versions", []):
            changes = []
            try:
                changes = json.loads(version.get("changes_json") or "[]")
            except (json.JSONDecodeError, TypeError):
                pass

            for change in changes:
                trail.append({
                    "product_id": product.get("id"),
                    "product_name": product.get("name"),
                    "action": "version_update",
                    "field": change.get("field", ""),
                    "old_value": change.get("old"),
                    "new_value": change.get("new"),
                    "source": change.get("source"),
                    "reviewer": change.get("reviewer"),
                    "timestamp": change.get("timestamp") or version.get("created_at"),
                })

        for review in product.get("review_items", []):
            if review.get("status") not in ("PENDING", "pending", None):
                trail.append({
                    "product_id": product.get("id"),
                    "product_name": product.get("name"),
                    "action": f"review_{review.get('status', 'unknown').lower()}",
                    "field": review.get("title", ""),
                    "old_value": review.get("previous_value"),
                    "new_value": review.get("new_value"),
                    "source": "Human Review",
                    "reviewer": review.get("reviewer"),
                    "timestamp": review.get("reviewed_at"),
                })

    trail.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    return trail
