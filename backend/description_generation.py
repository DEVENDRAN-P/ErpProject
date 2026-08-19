"""Unilog-Compliant Description Generation Module.

Generates commerce-ready product content from verified/normalized ProductTwin data,
following the Unilog Content Guidelines.

Generates:
  - Invoice Description
  - Mobile Description
  - Product Title
  - Short Description
  - Long Description

Never invents specifications. Only uses verified/normalized values.
"""
import re
from typing import Optional, Dict, List, Any

from backend.schemas.product import ProductTwinAttribute


DESCRIPTION_SPECS = {
    "invoice": {
        "name": "Invoice Description",
        "max_chars": 100,
        "purpose": "extremely concise / required format",
    },
    "mobile": {
        "name": "Mobile Description",
        "max_chars": 200,
        "purpose": "concise searchable description",
    },
    "title": {
        "name": "Product Title",
        "max_chars": 80,
        "purpose": "brand + series + MPN + item type + key attributes",
    },
    "short": {
        "name": "Short Description",
        "max_chars": 300,
        "purpose": "concise product summary",
    },
    "long": {
        "name": "Long Description",
        "max_chars": 2000,
        "purpose": "detailed verified product information",
    },
}


def _truncate(text: str, max_chars: int) -> str:
    if not text:
        return ""
    if len(text) <= max_chars:
        return text
    cut = text[:max_chars]
    last_space = cut.rfind(" ")
    if last_space > max_chars * 0.8:
        return cut[:last_space].strip()
    return cut + " "


def _format_value(val: Any, unit: Optional[str] = None) -> str:
    if val is None:
        return ""
    try:
        f = float(val)
        if f == int(f):
            s = str(int(f))
        else:
            s = "{:.2f}".format(f).rstrip("0").rstrip(".")
        if unit:
            return "{} {}".format(s, unit)
        return s
    except (ValueError, TypeError):
        return str(val) if val else ""


def generate_invoice_description(attr: ProductTwinAttribute) -> str:
    """Generate Invoice Description - extremely concise / required format."""
    values_parts = []
    if attr.status == "VERIFIED" and attr.normalized_value:
        val = attr.normalized_value
        if val and attr.unit:
            values_parts.append("{} {}".format(val, attr.unit))
        elif val:
            values_parts.append(val)
    result = " | ".join(values_parts) if values_parts else ""
    return _truncate(result, DESCRIPTION_SPECS["invoice"]["max_chars"])


def generate_mobile_description(attr: ProductTwinAttribute) -> str:
    """Generate Mobile Description - concise searchable description."""
    parts = []
    if attr.attribute and attr.status == "VERIFIED":
        parts.append(attr.attribute.upper())
    if attr.status == "VERIFIED" and attr.normalized_value:
        val = attr.normalized_value
        if attr.attribute == "rated_power":
            parts.append(_format_value(val, attr.unit))
        elif attr.attribute == "supply_voltage":
            parts.append(_format_value(val, attr.unit))
        elif attr.attribute == "rated_current":
            parts.append(_format_value(val, attr.unit))
        elif attr.attribute == "efficiency_class":
            parts.append(val)
        elif attr.attribute == "rated_speed":
            parts.append(_format_value(val, attr.unit))
        elif attr.attribute == "frame_size":
            parts.append(val)
    result = " ".join(parts) if parts else ""
    return _truncate(result, DESCRIPTION_SPECS["mobile"]["max_chars"])


def generate_product_title(
    attr: ProductTwinAttribute, brand: Optional[str] = None,
    model_number: Optional[str] = None,
) -> str:
    """Generate Product Title - brand + series + MPN + item type + key attributes."""
    parts = []
    # Brand first (if verified)
    if brand and attr.status == "VERIFIED":
        b = brand.strip()
        if b:
            parts.append(b)
    # Model number (if verified)
    if model_number and attr.status == "VERIFIED":
        mn = model_number.strip()
        if mn:
            parts.append(mn)
    # Attribute name uppercased (the "item type")
    if attr.attribute and attr.status == "VERIFIED":
        parts.append(attr.attribute.upper())
    # Key attribute value with unit (if available and verified)
    if attr.status == "VERIFIED" and attr.normalized_value:
        val = attr.normalized_value
        if attr.unit:
            val = "{} {}".format(val, attr.unit)
        if val and val not in parts:
            parts.append(val)
    # Raw value only if no normalized value available
    if attr.status == "VERIFIED" and not attr.normalized_value and attr.raw_value:
        rv = attr.raw_value.strip()
        if rv and rv not in parts:
            parts.append(rv)
    parts = [p for p in parts if p and p.strip()]
    result = " ".join(parts) if parts else ""
    return _truncate(result, DESCRIPTION_SPECS["title"]["max_chars"])


def generate_short_description(attr: ProductTwinAttribute) -> str:
    """Generate Short Description - concise product summary."""
    parts = []
    if attr.attribute and attr.status == "VERIFIED":
        parts.append(attr.attribute.upper())
    if attr.status == "VERIFIED" and attr.normalized_value:
        val = attr.normalized_value
        if attr.attribute in ("rated_power", "rated_current", "supply_voltage"):
            parts.append(_format_value(val, attr.unit))
        elif attr.attribute == "efficiency_class":
            parts.append(val)
        elif attr.attribute == "frame_size":
            parts.append(val)
    result = ", ".join(parts) if parts else ""
    return _truncate(result, DESCRIPTION_SPECS["short"]["max_chars"])


def generate_long_description(attr: ProductTwinAttribute) -> str:
    """Generate Long Description - detailed verified product information."""
    verified_fields = []
    if attr.status == "VERIFIED" and attr.normalized_value:
        nval = attr.normalized_value
        raw = attr.raw_value or ""
        u = attr.unit or ""
        field_parts = [p for p in [nval, u] if p and p.strip()]
        if field_parts:
            verified_fields.append(" ".join(field_parts))
    if attr.raw_value and attr.status == "VERIFIED":
        raw_stripped = attr.raw_value.strip()
        if raw_stripped and raw_stripped != (attr.normalized_value or ""):
            verified_fields.append("({})".format(raw_stripped))
    result = ". ".join(verified_fields) if verified_fields else ""
    return _truncate(result, DESCRIPTION_SPECS["long"]["max_chars"])


def validate_char_limits(descriptions: Dict[str, str]) -> Dict[str, bool]:
    """Validate that all descriptions are within character limits."""
    results = {}
    for field, desc in descriptions.items():
        max_chars = DESCRIPTION_SPECS[field]["max_chars"]
        results[field] = len(desc) <= max_chars if desc else True
    return results


def validate_no_unsupported_claims(long_desc: str, attr: ProductTwinAttribute) -> List[str]:
    """Validate no unsupported claims are in the long description."""
    unsupported = []
    lower = long_desc.lower()
    if "warranty" in lower and attr.status != "VERIFIED":
        unsupported.append("warranty claims require VERIFIED status")
    if "certified" in lower and attr.status != "VERIFIED":
        unsupported.append("certification claims require VERIFIED status")
    return unsupported


def generate_descriptions(
    attr: ProductTwinAttribute,
    brand: Optional[str] = None,
    model_number: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate all five descriptions from a ProductTwin attribute."""
    invoice = generate_invoice_description(attr)
    mobile = generate_mobile_description(attr)
    title = generate_product_title(attr, brand=brand, model_number=model_number)
    short = generate_short_description(attr)
    long_desc = generate_long_description(attr)

    char_valid = validate_char_limits(
        {"invoice": invoice, "mobile": mobile, "title": title,
         "short": short, "long": long_desc}
    )

    no_unsupported = validate_no_unsupported_claims(long_desc, attr)

    all_valid = all(char_valid.values()) and len(no_unsupported) == 0

    validation = {
        "invoice_valid": char_valid["invoice"],
        "mobile_valid": char_valid["mobile"],
        "title_valid": char_valid["title"],
        "short_valid": char_valid["short"],
        "long_valid": char_valid["long"],
        "character_limits_valid": all(char_valid.values()),
        "unsupported_claims": no_unsupported,
    }

    return {
        "invoice_description": invoice,
        "mobile_description": mobile,
        "product_title": title,
        "short_description": short,
        "long_description": long_desc,
        "content_validation": validation,
    }