"""Unit of Measure (UOM) Validation and Decimal/Fraction Conversion Module.

Validates units against the approved Unilog master UOM standards list
and converts between decimal and fraction representations.
"""

import re
from typing import Optional, Tuple, Dict, Set, Any, List


# --- Approved UOM Standards ---
# Populated from Unilog_Master_UOM_Standards_Abbreviations_and_Terms.xlsx
_APPROVED_UOMS: Set[str] = set()
# Alias mapping: alternative names -> canonical UOM
_UOM_ALIASES: Dict[str, str] = {}
# Decimal/fraction conversion references
_DECIMAL_FRACTION_MAP: Dict[float, str] = {}
# Rounding precision for fraction conversion
_FRACTION_TOLERANCE = 0.01  # 1% tolerance for fraction matching


def load_uom_standards(uom_data: Dict[str, List[str]]) -> None:
    """Load approved UOM standards from the master list.

    Args:
        uom_data: Dict mapping category -> list of approved UOM terms/abbreviations
    """
    global _APPROVED_UOMS, _UOM_ALIASES
    _APPROVED_UOMS = set()
    _UOM_ALIASES = {}

    for category, terms in uom_data.items():
        if not terms:
            continue
        for term in terms:
            term_stripped = term.strip()
            if not term_stripped:
                continue
            canon = term_stripped.upper()
            _APPROVED_UOMS.add(canon)
            # Also store lowercase for case-insensitive matching
            _APPROVED_UOMS.add(canon.lower())
            # Store common abbreviations as aliases
            _UOM_ALIASES[canon] = canon
            _UOM_ALIASES[canon.lower()] = canon


def load_decimal_fraction(frac_data: Dict[str, str]) -> None:
    """Load decimal/fraction conversion references.

    Args:
        frac_data: Dict mapping decimal -> fraction string or vice versa
    """
    global _DECIMAL_FRACTION_MAP
    _DECIMAL_FRACTION_MAP = {}

    for key, val in frac_data.items():
        key_upper = key.strip().upper()
        val_stripped = val.strip()
        # Store both directions
        _DECIMAL_FRACTION_MAP[key_upper] = val_stripped
        _DECIMAL_FRACTION_MAP[val_stripped] = key.strip()


def is_uom_valid(unit: Optional[str]) -> Tuple[bool, Optional[str]]:
    """Check if a unit is in the approved UOM list.

    Returns:
        (is_valid, canonical_uom)
    """
    if not unit:
        return False, None

    unit_upper = unit.strip().upper()

    # Direct match
    if unit_upper in _APPROVED_UOMS:
        return True, unit_upper

    # Check aliases
    if unit_upper in _UOM_ALIASES:
        canonical = _UOM_ALIASES[unit_upper]
        return True, canonical

    # Partial match: check if any approved UOM starts with or contains the input
    for approved in _APPROVED_UOMS:
        if approved.startswith(unit_upper) or unit_upper in approved:
            return True, approved
        if approved.startswith(unit_upper.replace(" ", "")) or unit_upper.replace(" ", "") in approved:
            return True, approved

    return False, None


def convert_decimal_to_fraction(decimal_val: float) -> Optional[str]:
    """Convert a decimal value to its closest fractional representation.

    Uses common engineering fractions: 1/2, 1/4, 3/4, 1/8, 3/8, 5/8, 7/8, 1/16, etc.
    """
    if decimal_val is None or decimal_val == 0:
        return None

    # Try to find close fraction match
    # Common fractions and their decimal values
    fractions = [
        (0.5, "1/2"),
        (0.75, "3/4"),
        (0.25, "1/4"),
        (0.375, "3/8"),
        (0.625, "5/8"),
        (0.875, "7/8"),
        (0.125, "1/8"),
        (0.25, "1/4"),
        (0.333, "1/3"),
        (0.667, "2/3"),
        (0.1, "1/10"),
        (0.2, "1/5"),
        (0.1667, "1/6"),
        (0.375, "3/8"),
        (0.625, "5/8"),
    ]

    decimal_val = abs(decimal_val)
    best_match = None
    best_diff = float("inf")

    for frac_val, frac_str in fractions:
        diff = abs(decimal_val - frac_val)
        if diff < best_diff and diff < _FRACTION_TOLERANCE:
            best_diff = diff
            best_match = frac_str

    if best_match:
        # Apply sign
        if decimal_val < 0:
            best_match = "-" + best_match
        return best_match

    # Fallback: format as decimal with appropriate precision
    return None


def convert_fraction_to_decimal(fraction_str: str) -> Optional[float]:
    """Convert a fractional string to its decimal equivalent.

    Supports formats: 1/2, 3/4, 5/8, 7/16, 2 1/2, etc.
    """
    if not fraction_str:
        return None

    s = fraction_str.strip()

    # Handle mixed numbers like "2 1/2"
    mixed_match = re.match(r"^(-?\d+)\s+(\d+)/(\d+)$", s)
    if mixed_match:
        sign = -1 if mixed_match.group(1).startswith("-") else 1
        whole = abs(float(mixed_match.group(1)))
        numerator = float(mixed_match.group(2))
        denominator = float(mixed_match.group(3))
        return sign * (whole + numerator / denominator)

    # Handle simple fraction n/d
    simple_match = re.match(r"^(-?\d+)/(\d+)$", s)
    if simple_match:
        sign = -1 if simple_match.group(1).startswith("-") else 1
        numerator = abs(float(simple_match.group(1)))
        denominator = float(simple_match.group(2))
        if denominator == 0:
            return None
        return sign * (numerator / denominator)

    # Handle plain decimal
    try:
        return float(s)
    except ValueError:
        return None


def normalize_uom(unit: str) -> Optional[str]:
    """Normalize a unit string to the canonical approved UOM.

    Returns the canonical UOM name or None if not recognized.
    """
    valid, canonical = is_uom_valid(unit)
    if valid:
        return canonical
    return None


def validate_and_normalize_unit(unit: Optional[str]) -> Dict[str, Any]:
    """Validate and normalize a unit string.

    Returns dict with:
        - uom_valid: bool
        - normalized_unit: str or None
        - evidence: str
    """
    result = {
        "uom_valid": False,
        "normalized_unit": None,
        "evidence": "",
    }

    if not unit:
        result["evidence"] = "Unit field is empty"
        return result

    valid, canonical = is_uom_valid(unit)
    result["uom_valid"] = valid
    result["normalized_unit"] = canonical

    if valid:
        result["evidence"] = f"Unit '{unit}' validated and normalized to '{canonical}'"
    else:
        result["evidence"] = f"Unit '{unit}' not in approved UOM list. Available: {sorted(_APPROVED_UOMS)[:10]}"

    return result