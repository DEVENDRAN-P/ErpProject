"""Manufacturer and Brand Canonical Resolution Module.

Resolves messy manufacturer/brand names to canonical entries using the
UniCat master brand list. Handles placeholders like "-- Unbranded --",
"-- No Unilog Brand --", and "-- No DIB Brand --" as EMPTY values.
"""

import re
from typing import Optional, Tuple, Dict, List


# Canonical manufacturer map - populated from UniCat_Manufacturer_and_Brand_List.xlsx
# Key -> canonical name (lowercase for matching)
_MANUFACTURER_CANONICAL: Dict[str, str] = {}
_BRAND_CANONICAL: Dict[str, str] = {}

# Known placeholder patterns to treat as EMPTY (all lowercase for case-insensitive matching)
_EMPTY_PLACEHOLDERS = {
    "-- unbranded --",
    "-- unbranded",
    "-- unbranded ",
    "-- no brand --",
    "-- no brand",
    "-- no unilog brand --",
    "-- no unilog brand--",
    "-- no dib brand --",
    "-- no dib brand--",
    "-- n/a --",
    "-- not specified --",
    "-- not specified",
}


def _is_placeholder(value: Optional[str]) -> bool:
    """Check if a value is an empty placeholder."""
    if not value:
        return True
    v = value.strip().lower()
    return v in _EMPTY_PLACEHOLDERS


def _normalize_name(name: str) -> str:
    """Normalize a name for matching: lowercase, strip, remove extra spaces."""
    if not name:
        return ""
    s = name.strip().lower()
    # Remove non-alphanumeric chars except spaces and hyphens
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    # Collapse multiple spaces
    s = re.sub(r"\s+", " ", s)
    return s


def load_manufacturer_canonical(manufacturer_data: Dict[str, str]) -> None:
    """Load manufacturer/brand canonical mapping data.

    Args:
        manufacturer_data: Dict mapping manufacturer name -> canonical name
    """
    global _MANUFACTURER_CANONICAL, _BRAND_CANONICAL
    _MANUFACTURER_CANONICAL = {}
    _BRAND_CANONICAL = {}

    for raw, canonical in manufacturer_data.items():
        if _is_placeholder(raw):
            continue
        norm_raw = _normalize_name(raw)
        norm_canonical = _normalize_name(canonical) if canonical else ""
        # Store the display form (original casing) while matching on the
        # normalized (lowercase) form.
        display = (canonical or raw).strip()
        if norm_raw and norm_canonical:
            _MANUFACTURER_CANONICAL[norm_raw] = display
        if norm_raw:
            _BRAND_CANONICAL[norm_raw] = display


def resolve_manufacturer(raw_name: Optional[str]) -> Tuple[Optional[str], str, str]:
    """Resolve a raw manufacturer name to canonical form.

    Returns:
        (canonical_name, status, evidence)
        - canonical_name: resolved canonical manufacturer or None
        - status: "VERIFIED" | "EXTRACTED" | "NOT_FOUND" | "CONFLICT"
        - evidence: description of resolution
    """
    if _is_placeholder(raw_name):
        return None, "NOT_FOUND", "Manufacturer placeholder treated as empty"

    raw_norm = _normalize_name(raw_name)
    if not raw_norm:
        return None, "NOT_FOUND", "Empty manufacturer name after normalization"

    # Try exact match in canonical map
    if raw_norm in _MANUFACTURER_CANONICAL:
        canonical = _MANUFACTURER_CANONICAL[raw_norm]
        return canonical, "VERIFIED", f"Canonical manufacturer resolved: '{raw_name}' -> '{canonical}'"

    # Fuzzy: check if raw name is a substring of any canonical or vice versa
    for canon_norm, canon_name in _MANUFACTURER_CANONICAL.items():
        if raw_norm in canon_norm or canon_norm in raw_norm:
            return canon_name, "EXTRACTED", f"Fuzzy match: '{raw_name}' -> '{canon_name}'"

    # Check if any canonical name contains the raw name
    for canon_norm, canon_name in _MANUFACTURER_CANONICAL.items():
        if raw_norm in canon_name.lower():
            return canon_name, "EXTRACTED", f"Partial match: '{raw_name}' -> '{canon_name}'"

    return None, "NOT_FOUND", f"Manufacturer '{raw_name}' not found in canonical list"


def resolve_brand(raw_brand: Optional[str]) -> Tuple[Optional[str], str, str]:
    """Resolve a raw brand name to canonical form.

    Returns:
        (canonical_name, status, evidence)
    """
    if _is_placeholder(raw_brand):
        return None, "NOT_FOUND", "Brand placeholder treated as empty"

    raw_norm = _normalize_name(raw_brand)
    if not raw_norm:
        return None, "NOT_FOUND", "Empty brand name after normalization"

    # Try exact match in brand canonical map
    if raw_norm in _BRAND_CANONICAL:
        canonical = _BRAND_CANONICAL[raw_norm]
        return canonical, "VERIFIED", f"Canonical brand resolved: '{raw_brand}' -> '{canonical}'"

    # Fuzzy match
    for canon_norm, canon_name in _BRAND_CANONICAL.items():
        if raw_norm in canon_norm or canon_norm in raw_norm:
            return canon_name, "EXTRACTED", f"Fuzzy brand match: '{raw_brand}' -> '{canon_name}'"

    for canon_norm, canon_name in _BRAND_CANONICAL.items():
        if raw_norm in canon_name.lower():
            return canon_name, "EXTRACTED", f"Partial brand match: '{raw_brand}' -> '{canon_name}'"

    return None, "NOT_FOUND", f"Brand '{raw_brand}' not found in canonical list"


def is_empty_placeholder(value: Optional[str]) -> bool:
    """Check if a manufacturer/brand value is an empty placeholder."""
    return _is_placeholder(value)