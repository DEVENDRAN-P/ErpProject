"""UOM (Unit of Measure) Normalization Module.

Validates and normalizes units against the approved Unilog master UOM standards.
Also handles decimal/fraction conversion.
"""

import re
from typing import Optional, Dict, List, Any

# Import UOM validation from Step 1
from backend.uom_validation import (
    load_uom_standards,
    is_uom_valid,
    normalize_uom as _normalize_uom_func,
    convert_decimal_to_fraction as _convert_dec_to_frac,
    convert_fraction_to_decimal as _convert_frac_to_dec,
    _APPROVED_UOMS,
    _UOM_ALIASES,
)


# Cache for UOM data
_uom_loaded = False


def _load_uom_standards(data):
    """Load UOM standards data from the master list."""
    global _uom_loaded
    if _uom_loaded:
        return
    load_uom_standards(data)
    _uom_loaded = True


def set_uom_standards(uom_data):
    """Set the approved UOM standards from the master list."""
    _load_uom_standards(uom_data)


def normalize_uom_value(raw_unit):
    """Normalize a unit string to approved canonical form."""
    result = {
        "raw_value": raw_unit if raw_unit else "",
        "normalized_value": None,
        "normalization_type": "UOM",
        "confidence": 0.0,
        "matched_reference": "",
        "validation_status": "NOT_FOUND",
        "needs_human_review": False,
    }

    if not raw_unit:
        result["validation_status"] = "NOT_FOUND"
        result["matched_reference"] = "Empty unit field"
        result["needs_human_review"] = True
        return result

    valid, canonical = is_uom_valid(raw_unit)

    if valid and canonical:
        result["normalized_value"] = canonical
        result["validation_status"] = "VERIFIED"
        result["confidence"] = 1.0
        result["matched_reference"] = "UOM validated: {} -> {}".format(raw_unit, canonical)
        result["needs_human_review"] = False
        return result

    # Check aliases
    unit_upper = raw_unit.strip().upper()
    if unit_upper in _UOM_ALIASES:
        alias_canonical = _UOM_ALIASES[unit_upper]
        result["normalized_value"] = alias_canonical
        result["validation_status"] = "VERIFIED"
        result["confidence"] = 1.0
        result["matched_reference"] = "UOM alias: {} -> {}".format(raw_unit, alias_canonical)
        result["needs_human_review"] = False
        return result

    # Fuzzy match - candidates only
    best_match = None
    best_score = 0
    for approved in _APPROVED_UOMS:
        if unit_upper in approved or approved in unit_upper:
            score = min(len(unit_upper), len(approved))
            if score > best_score:
                best_match = approved
                best_score = score

    if best_match and best_score >= 3:
        result["normalized_value"] = best_match
        result["validation_status"] = "EXTRACTED"
        result["confidence"] = 0.6
        result["matched_reference"] = "Fuzzy UOM: {} -> {} (candidate)".format(raw_unit, best_match)
        result["needs_human_review"] = True
        return result

    result["matched_reference"] = "Unit {} not in approved UOM list".format(raw_unit)
    return result


def convert_decimal_to_fraction(decimal_val):
    """Convert decimal value to its closest fractional representation."""
    result = {
        "raw_value": str(decimal_val) if decimal_val is not None else "",
        "normalized_value": None,
        "normalization_type": "DECIMAL_TO_FRACTION",
        "confidence": 0.0,
        "matched_reference": "",
        "validation_status": "NOT_FOUND",
        "needs_human_review": False,
    }

    if decimal_val is None or decimal_val == 0:
        result["validation_status"] = "NOT_FOUND"
        result["matched_reference"] = "Zero or None value"
        result["needs_human_review"] = True
        return result

    # Common fractions
    fractions = [
        (0.5, "1/2"),
        (0.75, "3/4"),
        (0.25, "1/4"),
        (0.375, "3/8"),
        (0.625, "5/8"),
        (0.875, "7/8"),
        (0.125, "1/8"),
        (0.333, "1/3"),
        (0.667, "2/3"),
    ]

    decimal_val_abs = abs(decimal_val)
    best_frac = None
    best_diff = float("inf")

    for f_val, f_str in fractions:
        diff = abs(decimal_val_abs - f_val)
        if diff < best_diff and diff < 0.01:
            best_diff = diff
            best_frac = f_str

    if best_frac:
        result["normalized_value"] = best_frac
        result["confidence"] = 0.9
        result["validation_status"] = "VERIFIED"
        result["matched_reference"] = "Decimal {} -> {}".format(decimal_val, best_frac)
    else:
        # Return decimal string fallback
        result["normalized_value"] = "{}".format(format(decimal_val, ".4f").rstrip("0").rstrip("."))
        result["confidence"] = 0.5
        result["validation_status"] = "EXTRACTED"
        result["matched_reference"] = "Decimal preserved: {}".format(decimal_val)

    result["needs_human_review"] = result["validation_status"] != "VERIFIED"
    return result


def convert_fraction_to_decimal(fraction_str):
    """Convert fractional string to its decimal equivalent."""
    result = {
        "raw_value": fraction_str,
        "normalized_value": None,
        "normalization_type": "FRACTION_TO_DECIMAL",
        "confidence": 0.0,
        "matched_reference": "",
        "validation_status": "NOT_FOUND",
        "needs_human_review": False,
    }

    if not fraction_str:
        result["validation_status"] = "NOT_FOUND"
        result["matched_reference"] = "Empty fraction"
        result["needs_human_review"] = True
        return result

    # Simple fraction n/d
    simple_match = re.match(r"^(-?\d+)/(\d+)$", fraction_str.strip())
    if simple_match:
        sign = -1 if simple_match.group(1).startswith("-") else 1
        numerator = abs(float(simple_match.group(1)))
        denominator = float(simple_match.group(2))
        if denominator == 0:
            result["matched_reference"] = "Denominator is zero"
            return result
        dec_result = sign * (numerator / denominator)
        formatted = "{}".format(format(dec_result, ".4f").rstrip("0").rstrip("."))
        result["normalized_value"] = formatted
        result["confidence"] = 0.95
        result["validation_status"] = "VERIFIED"
        result["matched_reference"] = "Fraction {} -> {}".format(fraction_str, formatted)
    else:
        # Mixed number 2 1/2
        mixed_match = re.match(r"^(-?\d+)\s+(\d+)/(\d+)$", fraction_str.strip())
        if mixed_match:
            sign = -1 if mixed_match.group(1).startswith("-") else 1
            whole = abs(float(mixed_match.group(1)))
            numerator = float(mixed_match.group(2))
            denominator = float(mixed_match.group(3))
            if denominator == 0:
                result["matched_reference"] = "Denominator is zero"
                return result
            dec_result = sign * (whole + numerator / denominator)
            formatted = "{}".format(format(dec_result, ".4f").rstrip("0").rstrip("."))
            result["normalized_value"] = formatted
            result["confidence"] = 0.8
            result["validation_status"] = "EXTRACTED"
            result["matched_reference"] = "Mixed fraction {} -> {}".format(fraction_str, formatted)
        else:
            result["matched_reference"] = "Could not parse fraction: {}".format(fraction_str)

    result["needs_human_review"] = result["validation_status"] != "VERIFIED"
    return result


def normalize_number_with_unit(number, raw_unit):
    """Normalize a number+unit combination."""
    result = {
        "raw_value": "{} {}".format(number, raw_unit) if raw_unit else str(number),
        "normalized_value": None,
        "normalization_type": "NUMBER_WITH_UNIT",
        "confidence": 0.0,
        "matched_reference": "",
        "validation_status": "NOT_FOUND",
        "needs_human_review": False,
    }

    if raw_unit is None:
        result["validation_status"] = "NOT_FOUND"
        result["matched_reference"] = "No unit provided"
        result["needs_human_review"] = True
        return result

    # Normalize UOM
    uom_result = normalize_uom_value(raw_unit)

    if uom_result["validation_status"] == "VERIFIED":
        result["normalized_value"] = "{} {}".format(number, uom_result["normalized_value"])
        result["confidence"] = uom_result["confidence"]
        result["validation_status"] = "VERIFIED"
        result["matched_reference"] = "Number+UOM normalized: '{}' -> '{}'".format(
            result["raw_value"], result["normalized_value"])
        result["needs_human_review"] = False
    elif uom_result["validation_status"] == "EXTRACTED":
        result["normalized_value"] = "{} {}".format(number, uom_result["normalized_value"])
        result["confidence"] = uom_result["confidence"]
        result["validation_status"] = "EXTRACTED"
        result["matched_reference"] = "Number+UOM extracted (fuzzy): '{}' -> '{}'".format(
            result["raw_value"], result["normalized_value"])
        result["needs_human_review"] = True
    else:
        result["validation_status"] = "NOT_FOUND"
        result["matched_reference"] = "Unit {} not approved for number {}".format(
            raw_unit, number)
        result["needs_human_review"] = True

    return result