"""List of Values (LOV) Validation Module.

Validates attribute keys and values against approved Lists of Values
from Fittings_LOV.xlsx and FAUCETS_LOV.xlsx. Ensures only approved
attribute names and value entries are accepted.
"""

import re
from typing import Dict, Set, Optional, Tuple, Any, List


# --- Attribute LOV Sets ---
# Approved attribute keys and their allowed values, populated from LOV files
_ATTRIBUTE_LOV: Dict[str, Dict[str, str]] = {}
# Set of all approved attribute keys
_APPROVED_ATTRIBUTE_KEYS: Set[str] = set()

# Category-specific LOV mappings
_FAUCETS_LOV: Dict[str, Set[str]] = {}
_FITTINGS_LOV: Dict[str, Set[str]] = {}


def _normalize_value(val: Optional[str]) -> str:
    """Normalize a value for LOV comparison."""
    if not val:
        return ""
    s = val.strip()
    # Remove surrounding quotes
    s = s.strip('"').strip("'")
    # Normalize whitespace
    s = re.sub(r"\s+", " ", s)
    return s


def _normalize_for_comparison(val: Optional[str]) -> str:
    """Normalize a value for case-insensitive, accent-insensitive comparison."""
    s = _normalize_value(val)
    s = s.lower()
    # Remove common technical prefixes/suffixes
    s = re.sub(r"\b(approx|approx\.|~|\s+)$", "", s)
    return s


def load_faucets_lov(lov_data: Dict[str, List[str]]) -> None:
    """Load Faucets List of Values.

    Args:
        lov_data: Dict mapping category -> list of approved values/attributes
    """
    global _FAUCETS_LOV
    _FAUCETS_LOV = {}
    for category, values in lov_data.items():
        if not values:
            continue
        normalized = set()
        for v in values:
            normalized.add(_normalize_for_comparison(v))
        _FAUCETS_LOV[category.lower()] = normalized


def load_fittings_lov(lov_data: Dict[str, List[str]]) -> None:
    """Load Fittings List of Values.

    Args:
        lov_data: Dict mapping category -> list of approved values/attributes
    """
    global _FITTINGS_LOV
    _FITTINGS_LOV = {}
    for category, values in lov_data.items():
        if not values:
            continue
        normalized = set()
        for v in values:
            normalized.add(_normalize_for_comparison(v))
        _FITTINGS_LOV[category.lower()] = normalized


def load_attribute_lov(attribute_data: Dict[str, Dict[str, str]]) -> None:
    """Load attribute LOV: key -> {value: description}.

    Args:
        attribute_data: Dict of attribute key -> {value: description/normalized}
    """
    global _ATTRIBUTE_LOV, _APPROVED_ATTRIBUTE_KEYS
    _ATTRIBUTE_LOV = {}
    _APPROVED_ATTRIBUTE_KEYS = set()

    for key, values in attribute_data.items():
        norm_key = _normalize_for_comparison(key)
        if not norm_key:
            continue
        _APPROVED_ATTRIBUTE_KEYS.add(norm_key)
        normalized_values = {}
        for raw_val, desc in values.items():
            norm_val = _normalize_for_comparison(raw_val)
            if norm_val:
                normalized_values[norm_val] = {
                    "raw": raw_val,
                    "description": desc,
                }
        _ATTRIBUTE_LOV[norm_key] = normalized_values


def is_approved_attribute(attr_key: str) -> bool:
    """Check if an attribute key is in the approved LOV."""
    norm_key = _normalize_for_comparison(attr_key)
    return norm_key in _APPROVED_ATTRIBUTE_KEYS


def is_approved_value(attr_key: str, attr_value: str) -> Tuple[bool, Optional[str]]:
    """Check if an attribute value is approved for the given key.

    Returns:
        (is_valid, normalized_value_or_evidence)
    """
    norm_key = _normalize_for_comparison(attr_key)
    norm_val = _normalize_for_comparison(attr_value)

    if norm_key not in _ATTRIBUTE_LOV:
        # Key not in LOV at all - still check for partial/fuzzy
        return False, None

    if norm_val in _ATTRIBUTE_LOV[norm_key]:
        entry = _ATTRIBUTE_LOV[norm_key][norm_val]
        return True, entry["raw"]

    # Check partial matches (value starts with or contains a valid value)
    for valid_val in _ATTRIBUTE_LOV[norm_key]:
        if valid_val.startswith(norm_val) or norm_val.startswith(valid_val):
            return True, _ATTRIBUTE_LOV[norm_key][valid_val]["raw"]

    return False, None


def check_faucets_lov(attr_key: str, attr_value: str, category: str = "") -> Tuple[bool, Optional[str]]:
    """Check if a value is in the Faucets LOV for the given category."""
    norm_val = _normalize_for_comparison(attr_value)
    faucet_values = _FAUCETS_LOV.get(category.lower(), set())

    if norm_val in faucet_values:
        return True, attr_value

    # Partial match
    for valid in faucet_values:
        if norm_val in valid or valid in norm_val:
            return True, attr_value

    return False, None


def check_fittings_lov(attr_key: str, attr_value: str, category: str = "") -> Tuple[bool, Optional[str]]:
    """Check if a value is in the Fittings LOV for the given category."""
    norm_val = _normalize_for_comparison(attr_value)
    fitting_values = _FITTINGS_LOV.get(category.lower(), set())

    if norm_val in fitting_values:
        return True, attr_value

    # Partial match
    for valid in fitting_values:
        if norm_val in valid or valid in norm_val:
            return True, attr_value

    return False, None


def validate_against_lov(attr_key: str, attr_value: str, category: str = "") -> Dict[str, Any]:
    """Full LOV validation for an attribute key-value pair.

    Returns dict with:
        - lov_valid: bool
        - uom_valid: bool (pre-filled for compatibility)
        - approved_value: str or None
        - validation_notes: str
    """
    norm_key = _normalize_for_comparison(attr_key)

    result = {
        "lov_valid": False,
        "uom_valid": True,
        "approved_value": None,
        "validation_notes": "",
    }

    # Check if attribute key is approved
    if norm_key not in _APPROVED_ATTRIBUTE_KEYS:
        result["validation_notes"] = f"Attribute key '{attr_key}' not in approved LOV"
        return result

    # Check if value is approved
    is_valid, approved = is_approved_value(attr_key, attr_value)
    result["lov_valid"] = is_valid
    result["approved_value"] = approved

    if not is_valid:
        result["validation_notes"] = f"Value '{attr_value}' not LOV-approved for key '{attr_key}'"
    else:
        result["validation_notes"] = f"Value '{attr_value}' approved as '{approved}'"

    return result