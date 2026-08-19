"""Manufacturer Normalization Module.

Matches extracted manufacturer names against the approved manufacturer master
from UniCat_Manufacturer_and_Brand_List.xlsx. Uses fuzzy matching only as a
candidate generator; final values must be validated against the master data.

Treat placeholders such as '-- Unbranded --', '-- No Unilog Brand --', and
'-- No DIB Brand --' as EMPTY values.
"""

import re
from typing import Optional, Dict, List, Any, Tuple

# Import the manufacturer resolution module from Step 1
from backend.manufacturer_resolution import (
    _normalize_name,
    is_empty_placeholder,
)


# Canonical manufacturer map - loaded from UniCat_Manufacturer_and_Brand_List.xlsx
_MANUFACTURER_MASTER: Dict[str, str] = {}
_manufacturer_loaded = False


def _load_manufacturer_master(data: Dict[str, str]) -> None:
    """Load manufacturer master data."""
    global _MANUFACTURER_MASTER, _manufacturer_loaded
    if _manufacturer_loaded:
        return
    _MANUFACTURER_MASTER = {}
    for raw, canonical in data.items():
        if is_empty_placeholder(raw) or is_empty_placeholder(canonical):
            continue
        norm_raw = _normalize_name(raw)
        _MANUFACTURER_MASTER[norm_raw] = canonical
    _manufacturer_loaded = True


def set_manufacturer_master(manufacturer_data: Dict[str, str]) -> None:
    """Set the manufacturer master data from the UniCat list."""
    _load_manufacturer_master(manufacturer_data)


def normalize_manufacturer(raw_name, manufacturer_master=None):
    """Normalize manufacturer name to canonical form."""
    result = {
        "raw_value": raw_name if raw_name else "",
        "normalized_value": None,
        "normalization_type": "MANUFACTURER",
        "confidence": 0.0,
        "matched_reference": "",
        "validation_status": "NOT_FOUND",
        "needs_human_review": False,
    }

    if raw_name is None or is_empty_placeholder(raw_name):
        result["normalized_value"] = ""
        result["validation_status"] = "NOT_FOUND"
        result["needs_human_review"] = False
        result["matched_reference"] = "Placeholder treated as empty"
        result["confidence"] = 0.0
        return result

    if manufacturer_master:
        _load_manufacturer_master(manufacturer_master)

    norm_input = _normalize_name(raw_name)
    if norm_input in _MANUFACTURER_MASTER:
        canonical = _MANUFACTURER_MASTER[norm_input]
        result["normalized_value"] = canonical
        result["validation_status"] = "VERIFIED"
        result["confidence"] = 1.0
        result["matched_reference"] = "Exact match: {} -> {}".format(raw_name, canonical)
        result["needs_human_review"] = False
        return result

    # Fuzzy match - candidates only
    best_match = None
    best_score = 0.0
    for master_norm, master_canonical in _MANUFACTURER_MASTER.items():
        if norm_input in master_norm or master_norm in norm_input:
            if len(norm_input) > best_score:
                best_match = master_canonical
                best_score = len(norm_input)
        common = set(norm_input) & set(master_norm)
        if len(common) > best_score and len(common) > 2:
            best_match = master_canonical
            best_score = len(common)

    if best_match and best_score > 2:
        result["normalized_value"] = best_match
        result["validation_status"] = "EXTRACTED"
        result["confidence"] = 0.6
        result["matched_reference"] = "Fuzzy match: {} -> {} (candidate)".format(raw_name, best_match)
        result["needs_human_review"] = True
        return result

    result["matched_reference"] = "Manufacturer '{}' not in master list".format(raw_name)
    return result


def normalize_brand(raw_brand, manufacturer_master=None):
    """Normalize brand name to canonical form, preserving casing and ®/™."""
    result = {
        "raw_value": raw_brand if raw_brand else "",
        "normalized_value": None,
        "normalization_type": "BRAND",
        "confidence": 0.0,
        "matched_reference": "",
        "validation_status": "NOT_FOUND",
        "needs_human_review": False,
    }

    if raw_brand is None or is_empty_placeholder(raw_brand):
        result["normalized_value"] = ""
        result["validation_status"] = "NOT_FOUND"
        result["needs_human_review"] = False
        result["matched_reference"] = "Placeholder treated as empty"
        result["confidence"] = 0.0
        return result

    if manufacturer_master:
        _load_manufacturer_master(manufacturer_master)

    # Exact match preserving casing
    for master_raw, master_canonical in _MANUFACTURER_MASTER.items():
        if raw_brand.strip().lower() == master_raw.lower():
            result["normalized_value"] = master_canonical
            result["validation_status"] = "VERIFIED"
            result["confidence"] = 1.0
            result["matched_reference"] = "Exact brand: {} -> {} (master casing)".format(raw_brand, master_canonical)
            result["needs_human_review"] = False
            return result

    # Fuzzy match
    best_match = None
    best_score = 0
    for master_raw, master_canonical in _MANUFACTURER_MASTER.items():
        master_norm = master_raw.lower()
        input_norm = raw_brand.strip().lower()
        if input_norm in master_norm or master_norm in input_norm:
            score = min(len(input_norm), len(master_norm))
            if score > best_score:
                best_match = master_canonical
                best_score = score
        common = set(input_norm) & set(master_norm)
        if len(common) > best_score and len(common) >= 3:
            best_match = master_canonical
            best_score = len(common)

    if best_match and best_score >= 3:
        result["normalized_value"] = best_match
        result["validation_status"] = "EXTRACTED"
        result["confidence"] = 0.65
        result["matched_reference"] = "Fuzzy brand: {} -> {} (candidate)".format(raw_brand, best_match)
        result["needs_human_review"] = True
        return result

    result["matched_reference"] = "Brand '{}' not in master list".format(raw_brand)
    return result


def normalize_manufacturer_with_fallback(raw_name, manufacturer_master=None):
    """Legacy: returns (canonical_name, status, confidence)."""
    result = normalize_manufacturer(raw_name, manufacturer_master)
    return result["normalized_value"], result["validation_status"], result["confidence"]