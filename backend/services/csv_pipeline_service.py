"""CSV-Specific Product Pipeline.

Processes each CSV row as an individual product, creating individual
ProductTwins. Handles column mapping, product type detection, placeholder
filtering, and returns detailed ingestion statistics.

Architecture:
  CSV bytes
    → Parse rows
    → Detect column mapping (auto-detect distributor CSV formats)
    → Detect product type from sample rows
    → For each valid row:
        → Extract product identity (MPN, name, brand, manufacturer)
        → Extract attributes from available columns
        → Normalize manufacturer/brand
        → Validate against LOV/UOM
        → Create individual ProductTwin
    → Return ingestion statistics + created products
"""

from __future__ import annotations

import csv
import io
import re
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from backend.services.product_service import create_product
from backend.schemas.product import ProductCreate, ProductAttributeCreate
from backend.manufacturer_normalization import normalize_manufacturer, normalize_brand
from backend.lov_validation import is_approved_attribute, is_approved_value
from backend.uom_validation import is_uom_valid
from backend.reference_data import load_reference_data
from backend.status import (
    STATUS_VERIFIED,
    STATUS_EXTRACTED,
    STATUS_NOT_FOUND,
    STATUS_NEEDS_REVIEW,
    STATUS_CONFLICT,
    canonical_status,
)

# Ensure reference data is loaded
load_reference_data()

# ---------------------------------------------------------------------------
# Placeholder values to treat as empty/null
# ---------------------------------------------------------------------------
EMPTY_PLACEHOLDERS = {
    "-- unbranded --",
    "-- no unilog brand --",
    "-- no dib brand --",
    "-- no brand --",
    "-- n/a --",
    "-- not specified --",
    "-- na --",
    "-- none --",
    "--",
    "n/a",
    "na",
    "none",
    "null",
    "",
}

def _is_empty(value: Optional[str]) -> bool:
    """Check if a value is empty or a placeholder."""
    if not value:
        return True
    return value.strip().lower() in EMPTY_PLACEHOLDERS


# ---------------------------------------------------------------------------
# Column mapping detection
# ---------------------------------------------------------------------------

COLUMN_PATTERNS = {
    "mpn": [
        "mpn", "mfg_part_num", "manufacturer_part_number", "mfg part num",
        "part_number", "part num", "model_number", "model number", "model",
        "catalog_number", "catalog num", "sku", "item_number", "item num",
        "product_number", "product num",
    ],
    "name": [
        "part_desc", "part desc", "product_name", "product name",
        "description", "item_description", "item desc", "product_desc",
        "long_description", "short_description", "title",
    ],
    "brand": [
        "brand", "brand_name", "brand name", "mfg_brand", "mfg brand",
    ],
    "manufacturer": [
        "manufacturer", "mfg", "mfg_name", "mfg name", "vendor",
        "supplier", "distributor",
    ],
    "category": [
        "category", "product_type", "product type", "type", "class",
        "product_category", "item_type", "item type", "dept", "department",
    ],
    "uom": [
        "uom", "unit", "unit_of_measure", "unit of measure", "each",
        "sell_uom", "sell uom", "price_uom",
    ],
    "price": [
        "price", "list_price", "list price", "cost", "msrp",
        "unit_price", "unit price",
    ],
    "quantity": [
        "qty", "quantity", "stock", "inventory", "on_hand",
    ],
    "weight": [
        "weight", "net_weight", "net weight", "ship_weight", "ship weight",
        "lbs", "kg",
    ],
    "length": [
        "length", "len", "l", "overall_length", "overall length",
    ],
    "width": [
        "width", "w", "wd",
    ],
    "height": [
        "height", "h", "ht", "overall_height", "overall height",
    ],
    "diameter": [
        "diameter", "dia", "od", "outside_diameter",
    ],
    "grit": [
        "grit", "grit_size", "grit size", "abrasive_grit",
    ],
    "material": [
        "material", "substrate", "composition",
    ],
    "voltage": [
        "voltage", "volt", "v", "rated_voltage", "rated voltage",
    ],
    "power": [
        "power", "wattage", "watts", "w", "rated_power", "rated power",
    ],
    "color": [
        "color", "colour",
    ],
    "size": [
        "size", "nominal_size", "nominal size",
    ],
}


def detect_column_mapping(headers: List[str]) -> Dict[str, str]:
    """Auto-detect column mapping from CSV headers."""
    mapping = {}
    headers_lower = {h.lower().strip(): h for h in headers}
    
    for canonical, patterns in COLUMN_PATTERNS.items():
        for pattern in patterns:
            if pattern in headers_lower:
                mapping[canonical] = headers_lower[pattern]
                break
    
    return mapping


# ---------------------------------------------------------------------------
# Product type detection
# ---------------------------------------------------------------------------

PRODUCT_TYPE_KEYWORDS = {
    "abrasive_disc": ["disc", "grinding", "grit", "flap", "cubitron", "depressed center", "abrasive disc"],
    "abrasive_belt": ["belt", "sanding belt", "abrasive belt"],
    "abrasive_wheel": ["wheel", "cutting wheel", "grinding wheel"],
    "cut_off_disc": ["cut-off", "cutoff", "cut off", "chop saw"],
    "sanding_paper": ["sandpaper", "sand paper", "emery"],
    "abrasives": ["abrasives", "abrasive"],
    "sanding_belts": ["sanding belts"],
    "motor": ["motor", "induction", "stator", "rotor", "torque", "rpm", "kw"],
    "pump": ["pump", "impeller", "flow rate", "head pressure"],
    "valve": ["valve", "gate valve", "ball valve", "butterfly valve"],
    "fitting": ["fitting", "connector", "coupling", "adapter", "nipple"],
    "faucet": ["faucet", "tap", "spout", "mixer"],
    "fastener": ["bolt", "screw", "nut", "washer", "rivet"],
    "electrical": ["wire", "cable", "connector", "relay", "contactor"],
    "tool": ["tool", "drill", "saw", "wrench", "plier"],
    "safety": ["safety", "glove", "goggle", "helmet", "glasses"],
}


def detect_product_type(row: Dict[str, str], column_mapping: Dict[str, str]) -> str:
    """Detect product type from row data."""
    text_parts = []
    for canonical in ["name", "category", "mpn", "brand"]:
        col = column_mapping.get(canonical)
        if col and row.get(col):
            text_parts.append(row[col].lower())
    
    combined = " ".join(text_parts)
    
    for product_type, keywords in PRODUCT_TYPE_KEYWORDS.items():
        for keyword in keywords:
            if keyword in combined:
                return product_type
    
    if any(w in combined for w in ["sanding", "grinding", "polishing", "finishing"]):
        return "abrasive_general"
    if any(w in combined for w in ["cutting", "sawing", "drilling"]):
        return "cutting_tool"
    
    return "general"


# ---------------------------------------------------------------------------
# Attribute extraction from CSV columns
# ---------------------------------------------------------------------------

ATTRIBUTE_MAP = {
    "mpn": ("manufacturer_part_number", "Manufacturer Part Number", ""),
    "brand": ("brand", "Brand", ""),
    "manufacturer": ("manufacturer", "Manufacturer", ""),
    "category": ("product_category", "Product Category", ""),
    "uom": ("unit_of_measure", "Unit of Measure", ""),
    "price": ("list_price", "List Price", ""),
    "weight": ("weight", "Weight", ""),
    "length": ("length", "Length", ""),
    "width": ("width", "Width", ""),
    "height": ("height", "Height", ""),
    "diameter": ("diameter", "Diameter", ""),
    "grit": ("grit_size", "Grit Size", ""),
    "material": ("material", "Material", ""),
    "voltage": ("voltage", "Voltage", "V"),
    "power": ("power_rating", "Power Rating", "W"),
    "color": ("color", "Color", ""),
    "size": ("nominal_size", "Nominal Size", ""),
}


def extract_attributes_from_row(
    row: Dict[str, str],
    column_mapping: Dict[str, str],
    product_type: str,
) -> List[Dict[str, Any]]:
    """Extract attributes from a CSV row based on column mapping."""
    attributes = []
    
    for canonical, (attr_key, attr_label, default_unit) in ATTRIBUTE_MAP.items():
        col = column_mapping.get(canonical)
        if not col:
            continue
        raw_value = row.get(col, "").strip()
        if _is_empty(raw_value):
            continue
        
        status = STATUS_VERIFIED
        confidence = 0.9
        
        if canonical in ("voltage", "power", "grit"):
            lov_valid, _ = is_approved_value(attr_key, raw_value)
            if not lov_valid:
                status = STATUS_NEEDS_REVIEW
                confidence = 0.5
        
        attributes.append({
            "key": attr_key,
            "label": attr_label,
            "raw_value": raw_value,
            "normalized_value": raw_value,
            "value": raw_value,
            "unit": default_unit,
            "confidence": confidence,
            "source": "CSV Import",
            "evidence": f"Extracted from CSV column '{col}'",
            "evidence_quote": raw_value,
            "status": status,
            "needs_human_review": status == STATUS_NEEDS_REVIEW,
            "lov_valid": canonical in ("voltage", "power", "grit"),
            "uom_valid": True,
        })
    
    return attributes


# ---------------------------------------------------------------------------
# Main CSV processing pipeline
# ---------------------------------------------------------------------------

def process_csv_rows(
    csv_content: bytes,
    db: Session,
    created_by: str | None = None,
) -> Dict[str, Any]:
    """Process a CSV file, creating individual ProductTwins for each valid row."""
    # Decode CSV
    try:
        text = csv_content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = csv_content.decode("latin-1")
    
    reader = csv.DictReader(io.StringIO(text))
    
    if not reader.fieldnames:
        return {
            "error": "CSV file has no headers",
            "total_rows": 0, "valid_products": 0, "invalid_rows": 0,
            "products_created": 0, "products_persisted": 0,
            "products_needing_review": 0, "conflicts_detected": 0,
            "products": [], "errors": [{"row": 0, "error": "No CSV headers found"}],
            "column_mapping": {}, "product_type": "unknown",
        }
    
    column_mapping = detect_column_mapping(list(reader.fieldnames))
    
    # Read all rows into memory
    all_rows = list(reader)
    
    # First pass: detect product type from sample rows
    product_type = "general"
    sample_rows = all_rows[:10]
    for sr in sample_rows:
        pt = detect_product_type(sr, column_mapping)
        if pt != "general":
            product_type = pt
            break
    
    # Second pass: process each row as individual product
    total_rows = len(all_rows)
    valid_products = 0
    invalid_rows = 0
    products_created = 0
    products_persisted = 0
    products_needing_review = 0
    conflicts_detected = 0
    created_products = []
    errors = []
    
    for row_num, row in enumerate(all_rows, start=1):
        mpn_col = column_mapping.get("mpn")
        name_col = column_mapping.get("name")
        
        mpn = row.get(mpn_col, "").strip() if mpn_col else ""
        name = row.get(name_col, "").strip() if name_col else ""
        
        if not mpn and not name:
            invalid_rows += 1
            errors.append({"row": row_num, "error": "Missing both MPN and product name/description"})
            continue
        
        product_identity = mpn if mpn else name[:120]
        
        if _is_empty(product_identity):
            invalid_rows += 1
            errors.append({"row": row_num, "error": "Product identity is a placeholder value"})
            continue
        
        valid_products += 1
        
        # Extract attributes
        attributes = extract_attributes_from_row(row, column_mapping, product_type)
        
        # Normalize manufacturer and brand
        mfg_col = column_mapping.get("manufacturer")
        brand_col = column_mapping.get("brand")
        raw_mfg = row.get(mfg_col, "").strip() if mfg_col else ""
        raw_brand = row.get(brand_col, "").strip() if brand_col else ""
        
        mfg_result = normalize_manufacturer(raw_mfg) if raw_mfg else None
        brand_result = normalize_brand(raw_brand) if raw_brand else None
        
        if mfg_result and mfg_result["normalized_value"]:
            attributes.insert(0, {
                "key": "manufacturer", "label": "Manufacturer",
                "raw_value": raw_mfg,
                "normalized_value": mfg_result["normalized_value"],
                "value": mfg_result["normalized_value"],
                "unit": "", "confidence": mfg_result["confidence"],
                "source": "Manufacturer Normalization",
                "evidence": mfg_result["matched_reference"],
                "evidence_quote": raw_mfg,
                "status": mfg_result["validation_status"],
                "needs_human_review": mfg_result["needs_human_review"],
                "lov_valid": False, "uom_valid": False,
            })
        
        if brand_result and brand_result["normalized_value"]:
            attributes.insert(1, {
                "key": "brand", "label": "Brand",
                "raw_value": raw_brand,
                "normalized_value": brand_result["normalized_value"],
                "value": brand_result["normalized_value"],
                "unit": "", "confidence": brand_result["confidence"],
                "source": "Brand Normalization",
                "evidence": brand_result["matched_reference"],
                "evidence_quote": raw_brand,
                "status": brand_result["validation_status"],
                "needs_human_review": brand_result["needs_human_review"],
                "lov_valid": False, "uom_valid": False,
            })
        
        needs_review = any(a.get("needs_human_review") for a in attributes)
        if needs_review:
            products_needing_review += 1
        
        # Build display name
        brand_val = brand_result["normalized_value"] if brand_result and brand_result.get("normalized_value") else ""
        display_name = f"{brand_val} {name[:100]}".strip() if name else f"{brand_val} {mpn}".strip()
        if not display_name:
            display_name = product_identity[:120]
        
        # Create ProductCreate
        product_attributes = [
            ProductAttributeCreate(
                key=a["key"], label=a["label"],
                raw_value=a.get("raw_value"), normalized_value=a.get("normalized_value"),
                value=a.get("value"), unit=a.get("unit", ""),
                confidence=a.get("confidence", 0.5),
                source=a.get("source", "CSV Import"),
                evidence=a.get("evidence", ""),
                status=a.get("status", STATUS_EXTRACTED),
                lov_valid=a.get("lov_valid", False),
                uom_valid=a.get("uom_valid", False),
                needs_human_review=a.get("needs_human_review", False),
            )
            for a in attributes
        ]
        
        review_items = []
        for a in attributes:
            if a.get("needs_human_review"):
                review_items.append({
                    "title": f"Review: {a['label']} ({a.get('status', 'UNKNOWN')})",
                    "item_type": "review",
                    "description": (
                        f"Attribute '{a['label']}' needs review. "
                        f"Value: {a.get('raw_value', 'N/A')}. "
                        f"Confidence: {round(a.get('confidence', 0) * 100)}%."
                    ),
                    "action": "Review attribute",
                    "status": "pending",
                })
        
        product_data = ProductCreate(
            name=display_name,
            model_number=mpn if mpn else None,
            category=product_type.replace("_", " ").title(),
            description=f"Imported from CSV row {row_num}. {name[:200] if name else ''}",
            attributes=product_attributes,
            review_items=review_items,
        )
        
        try:
            product = create_product(db=db, product_data=product_data, created_by=created_by)
            products_created += 1
            products_persisted += 1
            created_products.append({
                "id": product.id, "name": product.name,
                "model_number": product.model_number,
                "category": product.category,
                "health_score": product.health_score,
                "attribute_count": len(product.attributes),
                "needs_review": needs_review,
                "row_number": row_num,
            })
        except Exception as e:
            invalid_rows += 1
            errors.append({"row": row_num, "error": f"Failed to create product: {str(e)}"})
    
    return {
        "total_rows": total_rows,
        "valid_products": valid_products,
        "invalid_rows": invalid_rows,
        "products_created": products_created,
        "products_persisted": products_persisted,
        "products_needing_review": products_needing_review,
        "conflicts_detected": conflicts_detected,
        "products": created_products,
        "errors": errors,
        "column_mapping": column_mapping,
        "product_type": product_type,
    }
