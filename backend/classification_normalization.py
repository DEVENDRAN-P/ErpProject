"""Classification Normalization Module.

Maps raw classification strings to approved classpaths from the Unilog
classification system. Uses deterministic rules with fuzzy matching only
as candidate generator.
"""

import re
from typing import Optional, Dict, List, Any

# Import classification from Step 1
from backend.classification import (
    load_classpaths,
    classify,
    is_approved_classpath,
)


# Cache for classpaths
_classpaths_loaded = False
_approved_classpaths: set = set()


def _load_classpaths(data):
    """Load classification pathways data."""
    global _classpaths_loaded, _approved_classpaths
    if _classpaths_loaded:
        return
    load_classpaths(data)
    _approved_classpaths = set(data.get("motors", [])) | set(data.get("fittings", []))
    _classpaths_loaded = True


def set_classpaths(data):
    """Set the approved classpaths from the classification system."""
    _load_classpaths(data)


def normalize_classification(raw_cp, category=None):
    """Normalize a raw classification string to approved classpath."""
    result = {
        "raw_value": raw_cp if raw_cp else "",
        "normalized_value": None,
        "normalization_type": "CLASSIFICATION",
        "confidence": 0.0,
        "matched_reference": "",
        "validation_status": "NOT_FOUND",
        "needs_human_review": False,
    }

    if not raw_cp:
        result["validation_status"] = "NOT_FOUND"
        result["matched_reference"] = "Empty classification field"
        result["needs_human_review"] = True
        return result

    # Step 1: Try exact match in approved classpaths
    if raw_cp.strip() in _approved_classpaths:
        result["normalized_value"] = raw_cp.strip()
        result["validation_status"] = "VERIFIED"
        result["confidence"] = 1.0
        result["matched_reference"] = "Exact classification match: {}".format(raw_cp)
        result["needs_human_review"] = False
        return result

    # Step 2: Fuzzy match - candidates only
    norm_input = raw_cp.strip().lower()
    best_match = None
    best_score = 0

    for approved in _approved_classpaths:
        approved_norm = approved.lower()
        # Substring match
        if norm_input in approved_norm or approved_norm in norm_input:
            score = min(len(norm_input), len(approved_norm))
            if score > best_score:
                best_match = approved
                best_score = score

        # Prefix match (classpath segments)
        input_parts = norm_input.split(".")
        approved_parts = approved_norm.split(".")
        if len(input_parts) >= 2 and len(approved_parts) >= 2:
            if input_parts[0] == approved_parts[0]:
                score = len(input_parts[0]) + 1
                if score > best_score:
                    best_match = approved
                    best_score = score

        # Character overlap
        common = set(norm_input) & set(approved_norm)
        if len(common) > best_score and len(common) >= 2:
            best_match = approved
            best_score = len(common)

    if best_match and best_score >= 3:
        result["normalized_value"] = best_match
        result["validation_status"] = "EXTRACTED"
        result["confidence"] = 0.6
        result["matched_reference"] = "Fuzzy classification: {} -> {} (candidate)".format(raw_cp, best_match)
        result["needs_human_review"] = True
        return result

    # No match found
    result["matched_reference"] = "Classification '{}' not in approved classpaths".format(raw_cp)
    return result


def normalize_classpath_with_fallback(raw_cp, category=None, classpaths_data=None):
    """Legacy compatibility: returns (canonical, status, confidence)."""
    result = normalize_classification(raw_cp, category)
    return result["normalized_value"], result["validation_status"], result["confidence"]