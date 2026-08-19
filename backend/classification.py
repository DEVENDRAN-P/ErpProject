"""Classification Module.

Maps raw classification strings to approved classpaths.
Populated from the Unilog classification system / approved classpaths.
"""

import re
from typing import Optional, Tuple, Dict, Set, List, Any


# Approved classpaths - populated from classification source data
_APPROVED_CLASSPATHS: Set[str] = set()
_CLASSPATH_PREFIX_MAP: Dict[str, Set[str]] = {}

# Category -> approved classpaths
_CATEGORY_CLASSPATHS: Dict[str, Set[str]] = {}


def load_classpaths(classpath_data: Dict[str, List[str]]) -> None:
    """Load approved classpaths from the classification system.

    Args:
        classpath_data: Dict mapping category -> list of approved classpaths
    """
    global _APPROVED_CLASSPATHS, _CLASSPATH_PREFIX_MAP, _CATEGORY_CLASSPATHS
    _APPROVED_CLASSPATHS = set()
    _CLASSPATH_PREFIX_MAP = {}
    _CATEGORY_CLASSPATHS = {}

    for category, classpaths in classpath_data.items():
        if not classpaths:
            continue
        normalized = set()
        prefix_map = {}
        for cp in classpaths:
            cp_stripped = cp.strip()
            if not cp_stripped:
                continue
            norm = cp_stripped.lower()
            normalized.add(norm)
            # Extract prefix (everything up to and including the last number period segment)
            # e.g., "Unilog.Fittings.G1/4" -> prefix "unilog.fittings"
            parts = norm.split(".")
            if len(parts) >= 2:
                prefix = ".".join(parts[:-1])
                suffix = parts[-1]
                if prefix not in prefix_map:
                    prefix_map[prefix] = set()
                prefix_map[prefix].add(suffix)
            _APPROVED_CLASSPATHS.add(norm)
        _CATEGORY_CLASSPATHS[category.lower()] = normalized
        _CLASSPATH_PREFIX_MAP[category.lower()] = prefix_map


def classify(raw_classification: Optional[str], category: Optional[str] = None) -> Tuple[Optional[str], str, str]:
    """Resolve a raw classification to an approved classpath.

    Returns:
        (canonical_classpath, status, evidence)
    """
    if not raw_classification:
        return None, "NOT_FOUND", "No classification provided"

    raw_norm = raw_classification.strip().lower()
    if not raw_norm:
        return None, "NOT_FOUND", "Empty classification after normalization"

    # Check exact match
    if raw_norm in _APPROVED_CLASSPATHS:
        return raw_norm, "VERIFIED", f"Classpath verified: '{raw_classification}' -> '{raw_norm}'"

    # Check by category
    cat_classpaths = _CATEGORY_CLASSPATHS.get(category.lower() if category else "", set())
    if raw_norm in cat_classpaths:
        return raw_norm, "VERIFIED", f"Classpath verified for category: '{raw_classification}'"

    # Check prefix matches
    for approved in _APPROVED_CLASSPATHS:
        if approved.startswith(raw_norm) or raw_norm in approved:
            return approved, "EXTRACTED", f"Classpath extracted via prefix: '{raw_classification}' -> '{approved}'"

    # Try prefix-based lookup
    prefixes = raw_norm.split(".")
    if len(prefixes) > 1:
        prefix = ".".join(prefixes[:-1])
        suffix = prefixes[-1]
        cat_prefixes = _CLASSPATH_PREFIX_MAP.get(category.lower() if category else "", {})
        if prefix in cat_prefixes:
            candidates = cat_prefixes[prefix]
            if suffix in candidates:
                candidate = prefix + "." + suffix
                if candidate in _APPROVED_CLASSPATHS:
                    return candidate, "EXTRACTED", f"Classpath extracted via prefix/suffix: '{raw_classification}' -> '{candidate}'"

    return None, "NOT_FOUND", f"Classification '{raw_classification}' not found in approved classpaths"


def is_approved_classpath(cp: str) -> bool:
    """Check if a classpath is in the approved set."""
    if not cp:
        return False
    return cp.strip().lower() in _APPROVED_CLASSPATHS


def validate_classification(raw_cp: Optional[str], category: Optional[str] = None) -> Dict[str, Any]:
    """Validate and classify a raw classification string.

    Returns dict with:
        - status: "VERIFIED" | "EXTRACTED" | "NOT_FOUND" | "CONFLICT"
        - canonical_classpath: str or None
        - evidence: str
    """
    result = {
        "status": "NOT_FOUND",
        "canonical_classpath": None,
        "evidence": "",
    }

    if not raw_cp:
        result["evidence"] = "No classification provided"
        return result

    canonical, status, evidence = classify(raw_cp, category)
    result["status"] = status
    result["canonical_classpath"] = canonical
    result["evidence"] = evidence

    return result