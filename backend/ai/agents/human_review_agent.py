"""Human Review Agent — auto-assigns review items based on expertise.

Automatically routes review items to appropriate reviewers based on
attribute type, product category, and historical review patterns.
"""

from typing import List, Dict, Any, Optional


# Expertise mapping: category -> recommended reviewer specialty
EXPERTISE_MAP = {
    "electric motors & drives": "electrical_engineer",
    "pumps & compressors": "mechanical_engineer",
    "hvac systems": "hvac_specialist",
    "industrial automation": "automation_engineer",
    "power distribution": "power_engineer",
    "sensors & instrumentation": "instrumentation_engineer",
}

# Attribute type -> required expertise
ATTRIBUTE_EXPERTISE = {
    "rated_power": "electrical_engineer",
    "supply_voltage": "electrical_engineer",
    "rated_current": "electrical_engineer",
    "efficiency_class": "electrical_engineer",
    "rated_speed": "mechanical_engineer",
    "max_temperature": "mechanical_engineer",
    "frame_size": "mechanical_engineer",
    "total_weight": "logistics",
    "protection_rating": "safety_engineer",
    "certification": "compliance_officer",
}


def assign_reviewer(
    review_item: Dict[str, Any],
    product: Dict[str, Any],
    available_reviewers: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Assign the most appropriate reviewer for a review item.

    Returns assignment with reviewer_id, reason, and priority.
    """
    category = (product.get("category") or "").lower()
    item_type = review_item.get("item_type", "")
    title = (review_item.get("title") or "").lower()

    # Determine required expertise
    required_expertise = _determine_expertise(category, title, item_type)

    # Priority based on item type and severity
    priority = _determine_priority(review_item)

    # Find best matching reviewer
    assigned_reviewer = None
    if available_reviewers:
        assigned_reviewer = _find_best_match(required_expertise, available_reviewers)

    return {
        "review_item_id": review_item.get("id"),
        "required_expertise": required_expertise,
        "priority": priority,
        "assigned_reviewer": assigned_reviewer,
        "reason": _build_assignment_reason(required_expertise, priority, item_type),
    }


def batch_assign_reviews(
    review_items: List[Dict[str, Any]],
    products: List[Dict[str, Any]],
    available_reviewers: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """Batch assign reviewers for multiple review items.

    Returns list of assignments sorted by priority.
    """
    assignments = []
    product_map = {p.get("id"): p for p in products}

    for item in review_items:
        product = product_map.get(item.get("product_id"), {})
        assignment = assign_reviewer(item, product, available_reviewers)
        assignments.append(assignment)

    # Sort by priority (high first)
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    assignments.sort(key=lambda a: priority_order.get(a.get("priority", "low"), 4))

    return assignments


def get_review_queue_stats(review_items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Get statistics about the current review queue."""
    total = len(review_items)
    pending = sum(1 for r in review_items if r.get("status") in ("PENDING", "pending"))
    approved = sum(1 for r in review_items if r.get("status") in ("APPROVED", "approved"))
    rejected = sum(1 for r in review_items if r.get("status") in ("REJECTED", "rejected"))

    # By type
    conflicts = sum(1 for r in review_items if r.get("item_type") == "conflict")
    missing = sum(1 for r in review_items if r.get("item_type") == "missing")

    return {
        "total_items": total,
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
        "by_type": {
            "conflicts": conflicts,
            "missing": missing,
        },
        "completion_rate": round(approved / total * 100, 1) if total > 0 else 0,
    }


def _determine_expertise(category: str, title: str, item_type: str) -> str:
    """Determine the required expertise for a review item."""
    # Check attribute-level expertise
    for attr_key, expertise in ATTRIBUTE_EXPERTISE.items():
        if attr_key in title:
            return expertise

    # Check category-level expertise
    for cat_key, expertise in EXPERTISE_MAP.items():
        if cat_key in category:
            return expertise

    # Default based on item type
    if item_type == "conflict":
        return "data_quality_specialist"
    elif item_type == "missing":
        return "catalog_manager"

    return "general_reviewer"


def _determine_priority(review_item: Dict[str, Any]) -> str:
    """Determine review priority based on item characteristics."""
    item_type = review_item.get("item_type", "")
    title = (review_item.get("title") or "").lower()

    # Critical: safety/certification conflicts
    if any(kw in title for kw in ["safety", "certification", "compliance", "regulation"]):
        return "critical"

    # High: data conflicts
    if item_type == "conflict":
        return "high"

    # Medium: missing critical attributes
    if item_type == "missing":
        critical_attrs = ["power", "voltage", "current", "temperature", "speed"]
        if any(attr in title for attr in critical_attrs):
            return "medium"

    return "low"


def _find_best_match(expertise: str, reviewers: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Find the best matching reviewer for the required expertise."""
    for reviewer in reviewers:
        specialties = reviewer.get("specialties", [])
        if expertise in specialties:
            return {"id": reviewer.get("id"), "name": reviewer.get("name"), "match_reason": "exact_expertise_match"}

    # Fall back to any available reviewer
    if reviewers:
        return {"id": reviewers[0].get("id"), "name": reviewers[0].get("name"), "match_reason": "general_assignment"}

    return None


def _build_assignment_reason(expertise: str, priority: str, item_type: str) -> str:
    """Build a human-readable reason for the assignment."""
    return (
        f"Review item classified as '{item_type}' requiring '{expertise}' expertise. "
        f"Priority: {priority}. Auto-assigned based on content analysis."
    )
