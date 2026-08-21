"""LOV Normalization Module.

Maps extracted attributes and values to approved Lists of Values from:
- Unicat_Lov_v1_0_Updated_With_Remarks.xlsx
- FAUCETS_LOV.xlsx
- Fittings_LOV.xlsx

Ensures only approved attribute names and value entries are accepted.
Rejects values not supported by the applicable LOV.
Keeps raw and normalized values separate.
"""

import re
from typing import Optional, Tuple, Dict, List, Any, Set

# Import LOV validation from Step 1
from backend.lov_validation import (
    load_attribute_lov,
    load_faucets_lov,
    load_fittings_lov,
    is_approved_attribute,
    is_approved_value,
    validate_against_lov,
    _APPROVED_ATTRIBUTE_KEYS,
    _ATTRIBUTE_LOV,
)


# Cache for category-specific LOV data
_faucets_loaded = False
_fittings_loaded = False
_faucets_lov: Dict[str, Set[str]] = {}
_fittings_lov: Dict[str, Set[str]] = {}


def set_attribute_lov(data: Dict[str, Dict[str, str]]) -> None:
    """Set the attribute LOV data from the approved list."""
    from backend.lov_validation import load_attribute_lov
    load_attribute_lov(data)


def _load_faucets_lov(data: Dict[str, List[str]]) -> None:
    """Load Faucets LOV data."""
    global _faucets_loaded, _faucets_lov
    if _faucets_loaded:
        return
    from backend.lov_validation import load_faucets_lov as _load_orig
    _load_orig(data)
    # Extract the faucet values from the loaded data
    # The lov_validation module sets _FAUCETS_LOV globally, but we use our own
    # In our implementation, data directly maps category -> list of approved values
    _faucets_lov = {}
    for category, values in data.items():
        if not values:
            continue
        normalized = set()
        for v in values:
            v_norm = v.strip().lower()
            normalized.add(v_norm)
        _faucets_lov[category.lower()] = normalized
    _faucets_loaded = True


def _load_fittings_lov(data: Dict[str, List[str]]) -> None:
    """Load Fittings LOV data."""
    global _fittings_loaded, _fittings_lov
    if _fittings_loaded:
        return
    from backend.lov_validation import load_fittings_lov as _load_orig
    _load_orig(data)
    _fittings_lov = {}
    for category, values in data.items():
        if not values:
            continue
        normalized = set()
        for v in values:
            v_norm = v.strip().lower()
            normalized.add(v_norm)
        _fittings_lov[category.lower()] = normalized
    _fittings_loaded = True


def set_faucets_lov(data: Dict[str, List[str]]) -> None:
    """Set Faucets LOV data from the approved list."""
    _load_faucets_lov(data)


def set_fittings_lov(data: Dict[str, List[str]]) -> None:
    """Set Fittings LOV data from the approved list."""
    _load_fittings_lov(data)


def normalize_attribute_key(
    raw_key: str,
    attribute_lov_data: Dict[str, Dict[str, str]] | None = None,
) -> Dict[str, Any]:
    """Normalize an attribute key to approved LOV format.

    Maps extracted attribute keys to approved LOV attribute names.

    Returns dict with:
        - raw_value: the original input key
        - normalized_value: approved key or None
        - normalization_type: "ATTRIBUTE_KEY"
        - confidence: float 0.0-1.0
        - matched_reference: str
        - validation_status: "VERIFIED" | "EXTRACTED" | "NOT_FOUND" | "CONFLICT"
        - needs_human_review: bool
    """
    result = {
        "raw_value": raw_key,
        "normalized_value": None,
        "normalization_type": "ATTRIBUTE_KEY",
        "confidence": 0.0,
        "matched_reference": "",
        "validation_status": "NOT_FOUND",
        "needs_human_review": False,
    }

    if not raw_key or not raw_key.strip():
        result["validation_status"] = "NOT_FOUND"
        result["matched_reference"] = "Empty attribute key"
        result["needs_human_review"] = True
        return result

    # Step 1: Try exact match in attribute LOV
    if attribute_lov_data:
        from backend.lov_validation import load_attribute_lov
        load_attribute_lov(attribute_lov_data)

    if raw_key in _APPROVED_ATTRIBUTE_KEYS:
        result["normalized_value"] = raw_key
        result["validation_status"] = "VERIFIED"
        result["confidence"] = 1.0
        result["matched_reference"] = f"Exact attribute key match: '{raw_key}'"
        result["needs_human_review"] = False
        return result

    # Step 2: Fuzzy match - generate candidates only
    norm_key = raw_key.lower().strip()
    best_match = None
    best_score = 0

    for approved_key in _APPROVED_ATTRIBUTE_KEYS:
        approved_norm = approved_key.lower()
        # Substring match
        if norm_key in approved_norm or approved_norm in norm_key:
            score = min(len(norm_key), len(approved_norm))
            if score > best_score:
                best_match = approved_key
                best_score = score

        # Character overlap
        common = set(norm_key) & set(approved_norm)
        if len(common) > best_score and len(common) >= 2:
            best_match = approved_key
            best_score = len(common)

    if best_match and best_score >= 3:
        result["normalized_value"] = best_match
        result["validation_status"] = "EXTRACTED"
        result["confidence"] = 0.6
        result["matched_reference"] = f"Fuzzy attribute key match: '{raw_key}' -> '{best_match}' (candidate only, verify)"
        result["needs_human_review"] = True
        return result

    # Step 3: No match
    result["validation_status"] = "NOT_FOUND"
    result["matched_reference"] = f"Attribute key '{raw_key}' not in approved LOV"
    result["needs_human_review"] = True
    return result


def normalize_attribute_value(
    attr_key: str,
    raw_value: str,
    category: str = "",
    faucets_data: Dict[str, List[str]] | None = None,
    fittings_data: Dict[str, List[str]] | None = None,
    attribute_lov_data: Dict[str, Dict[str, str]] | None = None,
) -> Dict[str, Any]:
    """Normalize an attribute value to approved LOV format.

    Maps extracted attribute values to approved normalized values using:
    - Attribute LOV (key -> allowed values)
    - Category-specific LOV (Faucets_LOV, Fittings_LOV)

    Returns dict with same structure as normalize_attribute_key()

    Important rules:
    * Never invent values
    * Never create new LOV values
    * Reject values not supported by the applicable LOV
    * Keep raw and normalized values separate
    """
    result = {
        "raw_value": raw_value,
        "normalized_value": None,
        "normalization_type": "ATTRIBUTE_VALUE",
        "confidence": 0.0,
        "matched_reference": "",
        "validation_status": "NOT_FOUND",
        "needs_human_review": False,
    }

    if not raw_value or not raw_value.strip():
        result["validation_status"] = "NOT_FOUND"
        result["matched_reference"] = "Empty attribute value"
        result["needs_human_review"] = True
        return result

    # Step 1: Check attribute LOV first
    if attribute_lov_data:
        from backend.lov_validation import load_attribute_lov
        load_attribute_lov(attribute_lov_data)

    # Normalize the value for comparison
    norm_val = raw_value.strip()

    # Check if key is approved
    key_norm = attr_key.lower().strip() if attr_key else ""

    # Check attribute LOV for this key
    if key_norm in _ATTRIBUTE_LOV and norm_val in _ATTRIBUTE_LOV[key_norm]:
        entry = _ATTRIBUTE_LOV[key_norm][norm_val]
        result["normalized_value"] = entry["raw"]
        result["validation_status"] = "VERIFIED"
        result["confidence"] = 1.0
        result["matched_reference"] = f"Attribute LOV approved: '{raw_value}' -> '{entry['raw']}'"
        result["needs_human_review"] = False
        return result

    # Step 2: Check category-specific LOV (Faucets or Fittings)
    cat_lower = category.lower().strip() if category else ""

    # Try Faucets LOV
    if faucets_data:
        _load_faucets_lov(faucets_data)

    if cat_lower and cat_lower in _faucets_lov:
        if norm_val in _faucets_lov[cat_lower]:
            result["normalized_value"] = raw_value  # Keep original if it matches
            result["validation_status"] = "VERIFIED"
            result["confidence"] = 1.0
            result["matched_reference"] = f"Faucets LOV approved for category '{category}': '{raw_value}'"
            result["needs_human_review"] = False
            return result

    # Try Fittings LOV
    if fittings_data:
        _load_fittings_lov(fittings_data)

    if cat_lower and cat_lower in _fittings_lov:
        if norm_val in _fittings_lov[cat_lower]:
            result["normalized_value"] = raw_value
            result["validation_status"] = "VERIFIED"
            result["confidence"] = 1.0
            result["matched_reference"] = f"Fittings LOV approved for category '{category}': '{raw_value}'"
            result["needs_human_review"] = False
            return result

    # Step 3: Partial/ fuzzy match in attribute LOV
    if key_norm in _ATTRIBUTE_LOV:
        # Check for partial startswith/contains matches
        for valid_val in _ATTRIBUTE_LOV[key_norm]:
            if valid_val.startswith(norm_val) or norm_val.startswith(valid_val):
                entry = _ATTRIBUTE_LOV[key_norm][valid_val]
                result["normalized_value"] = entry["raw"]
                result["validation_status"] = "EXTRACTED"
                result["confidence"] = 0.65
                result["matched_reference"] = f"Partial attribute LOV match: '{raw_value}' -> '{entry['raw']}' (candidate only, verify)"
                result["needs_human_review"] = True
                return result

    # Step 4: No match found
    result["validation_status"] = "NOT_FOUND"
    result["matched_reference"] = f"Value '{raw_value}' not LOV-approved for key '{attr_key}'"
    result["needs_human_review"] = True
    return result


def normalize_against_lov(
    attr_key: str,
    raw_value: str,
    category: str = "",
    faucets_data: Dict[str, List[str]] | None = None,
    fittings_data: Dict[str, List[str]] | None = None,
    attribute_lov_data: Dict[str, Dict[str, str]] | None = None,
) -> Dict[str, Any]:
    """Unified LOV normalization entry point. Checks both attribute key and value against the appropriate LOVs."""
    # Always normalize both key and value for a complete result
    key_result = normalize_attribute_key(attr_key, attribute_lov_data)
    val_result = normalize_attribute_value(
        attr_key, raw_value, category, faucets_data, fittings_data, attribute_lov_data
    )

    if key_result["validation_status"] == "NOT_FOUND":
        # Key not found — value result takes precedence
        if val_result["validation_status"] == "VERIFIED":
            result = {
                "raw_value": val_result["raw_value"],
                "normalized_value": val_result["normalized_value"],
                "normalization_type": "ATTRIBUTE_VALUE",
                "confidence": min(0.6, val_result["confidence"]),
                "matched_reference": val_result["matched_reference"],
                "validation_status": "EXTRACTED",
                "needs_human_review": True,
            }
        else:
            result = {
                "raw_value": val_result["raw_value"],
                "normalized_value": val_result["normalized_value"],
                "normalization_type": "ATTRIBUTE_VALUE",
                "confidence": 0.0,
                "matched_reference": val_result["matched_reference"],
                "validation_status": "NOT_FOUND",
                "needs_human_review": True,
            }
    else:
        # Key was found — use key result as primary, merge value if available
        result = {
            "raw_value": raw_value,
            "normalized_value": key_result.get("normalized_value") or val_result.get("normalized_value"),
            "normalization_type": "ATTRIBUTE_KEY_VALUE",
            "confidence": key_result["confidence"],
            "matched_reference": key_result["matched_reference"],
            "validation_status": key_result["validation_status"],
            "needs_human_review": key_result["needs_human_review"],
        }

    return result