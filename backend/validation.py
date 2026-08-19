"""Product Data Validation Engine.

Deterministic validation layer that validates ProductTwin data and generated
product content against UniHack reference rules.

Validates:
  1. LOV compliance (attribute key + value approval)
  2. UOM compliance (unit approval and formatting)
  3. Manufacturer / Brand canonical resolution
  4. Required fields detection
  5. Description compliance (character limits, casing, terminology)
  6. Evidence verification (VERIFIED requires evidence)
  7. Conflict detection (contradictions between values)
"""

from typing import Dict, List, Any, Optional, Tuple
from backend.schemas.product import ProductTwinAttribute, ValidationResult
from backend.description_generation import (
    DESCRIPTION_SPECS,
    _truncate,
    _format_value,
    validate_char_limits,
    validate_no_unsupported_claims,
)
from backend.lov_validation import (
    is_approved_attribute,
    is_approved_value,
    validate_against_lov,
    _ATTRIBUTE_LOV,
    _APPROVED_ATTRIBUTE_KEYS,
    load_attribute_lov,
)
from backend.uom_validation import is_uom_valid, load_uom_standards
from backend.manufacturer_resolution import (
    resolve_manufacturer,
    resolve_brand,
    load_manufacturer_canonical,
    _EMPTY_PLACEHOLDERS,
)


# ---------------------------------------------------------------------------
# Validation result data class
# ---------------------------------------------------------------------------

class ValidationCheckResult:
    """Result of a single validation check."""

    def __init__(
        self,
        check_name: str,
        valid: bool,
        errors: List[str] = None,
        warnings: List[str] = None,
        severity: str = "ERROR",
    ):
        self.check_name = check_name
        self.valid = valid
        self.errors = errors if errors is not None else []
        self.warnings = warnings if warnings is not None else []
        self.severity = severity

    def to_dict(self) -> Dict[str, Any]:
        return {
            "check_name": self.check_name,
            "valid": self.valid,
            "errors": self.errors,
            "warnings": self.warnings,
            "severity": self.severity,
        }


# ---------------------------------------------------------------------------
# Core Validation Engine
# ---------------------------------------------------------------------------

class ProductValidator:
    """Main validation engine for ProductTwin attributes and generated content."""

    def __init__(self):
        self.attribute_lov_loaded = False
        self.uom_standards_loaded = False
        self.manufacturer_canonical_loaded = False

    # ------------------------------------------------------------------
    # LOV initialization helpers (called once from app startup)
    # ------------------------------------------------------------------

    def load_attribute_lov(self, attribute_data: Dict[str, Dict[str, str]]) -> None:
        """Load attribute LOV from reference data."""
        load_attribute_lov(attribute_data)
        self.attribute_lov_loaded = True

    def load_uom_standards(self, uom_data: Dict[str, List[str]]) -> None:
        """Load approved UOM standards from reference data."""
        load_uom_standards(uom_data)
        self.uom_standards_loaded = True

    def load_manufacturer_canonical(
        self, manufacturer_data: Dict[str, str]
    ) -> None:
        """Load manufacturer/brand canonical mapping."""
        load_manufacturer_canonical(manufacturer_data)
        self.manufacturer_canonical_loaded = True

    # ------------------------------------------------------------------
    # 1. LOV Compliance Validation
    # ------------------------------------------------------------------

    def validate_lov(self, attr: ProductTwinAttribute) -> ValidationCheckResult:
        """Validate attribute key and value against approved LOV.

        Checks:
        - Attribute key exists in approved LOV
        - Attribute value is in approved normalized values
        - Flags unsupported/unknown values
        """
        errors: List[str] = []
        warnings: List[str] = []

        # Check if attribute key is approved
        key_valid = is_approved_attribute(attr.attribute)
        if not key_valid:
            errors.append(
                f"Attribute key '{attr.attribute}' not in approved LOV"
            )
            warnings.append("Attribute key not in LOV - value cannot be validated")

        # Check if value is approved for the key
        if attr.normalized_value:
            value_valid, approved = is_approved_value(
                attr.attribute, attr.normalized_value
            )
            if not value_valid:
                errors.append(
                    f"Value '{attr.normalized_value}' not LOV-approved "
                    f"for key '{attr.attribute}'"
                )
                warnings.append("Value not in LOV - may need human review")
        else:
            # No normalized value to check
            if attr.raw_value and attr.status == "VERIFIED":
                warnings.append(
                    "VERIFIED status with no normalized value - "
                    "cannot validate LOV compliance"
                )

        lov_valid = len(errors) == 0
        all_errors = errors if not lov_valid else []
        # If key is not approved, the whole LOV check fails
        if not key_valid:
            lov_valid = False

        return ValidationCheckResult(
            check_name="lov",
            valid=lov_valid,
            errors=all_errors,
            warnings=warnings,
            severity="ERROR" if not lov_valid else "PASS",
        )

    # ------------------------------------------------------------------
    # 2. UOM Compliance Validation
    # ------------------------------------------------------------------

    def validate_uom(self, attr: ProductTwinAttribute) -> ValidationCheckResult:
        """Validate unit against approved UOM standards.

        Checks:
        - Unit exists in approved UOM standards
        - Correct formatting and spacing
        - Flags invalid units
        """
        errors: List[str] = []
        warnings: List[str] = []

        if not attr.unit:
            if attr.status == "VERIFIED":
                errors.append("VERIFIED status with no unit field")
                warnings.append("Missing unit - may need human review")
            else:
                warnings.append("Unit field empty - informational only")
            return ValidationCheckResult(
                check_name="uom",
                valid=len(errors) == 0,
                errors=errors,
                warnings=warnings,
                severity="ERROR" if errors else "WARNING",
            )

        uom_valid, canonical = is_uom_valid(attr.unit)
        if not uom_valid:
            errors.append(
                f"Unit '{attr.unit}' not in approved UOM list"
            )
            warnings.append(
                f"Unit '{attr.unit}' not recognized. "
                "Available UOMs must be from approved master list."
            )

        return ValidationCheckResult(
            check_name="uom",
            valid=uom_valid,
            errors=errors,
            warnings=warnings,
            severity="ERROR" if not uom_valid else "PASS",
        )

    # ------------------------------------------------------------------
    # 3. Manufacturer / Brand Validation
    # ------------------------------------------------------------------

    def validate_manufacturer(
        self, attr: ProductTwinAttribute
    ) -> ValidationCheckResult:
        """Validate manufacturer/brand name against canonical lists.

        Checks:
        - Manufacturer matches approved master
        - Brand matches approved manufacturer/brand mapping
        - Flags uncertain or conflicting matches
        """
        errors: List[str] = []
        warnings: List[str] = []

        # If no manufacturer/brand provided, flag for review if VERIFIED
        if not attr.raw_value:
            if attr.status == "VERIFIED":
                errors.append(
                    "VERIFIED status with no manufacturer/brand raw value"
                )
                warnings.append(
                    "Missing manufacturer/brand for VERIFIED attribute"
                )
            else:
                warnings.append(
                    "No manufacturer/brand provided - informational"
                )
            return ValidationCheckResult(
                check_name="manufacturer",
                valid=len(errors) == 0,
                errors=errors,
                warnings=warnings,
                severity="ERROR" if errors else "WARNING",
            )

        # Resolve manufacturer
        canon_mfr, mfr_status, mfr_evidence = resolve_manufacturer(
            attr.raw_value
        )
        if mfr_status == "NOT_FOUND":
            errors.append(f"Manufacturer '{attr.raw_value}' not in canonical list")
            warnings.append("Manufacturer resolution failed - check spelling")
        elif mfr_status == "EXTRACTED":
            warnings.append(
                f"Fuzzy manufacturer match: '{mfr_evidence}'"
            )

        # Resolve brand
        canon_brand, brand_status, brand_evidence = resolve_brand(
            attr.raw_value
        )
        if brand_status == "NOT_FOUND":
            errors.append(
                f"Brand '{attr.raw_value}' not in canonical list"
            )
            warnings.append("Brand resolution failed - check spelling")
        elif brand_status == "EXTRACTED":
            warnings.append(
                f"Fuzzy brand match: '{brand_evidence}'"
            )

        # Check for placeholder patterns
        raw_lower = (attr.raw_value or "").strip().lower()
        is_placeholder = raw_lower in _EMPTY_PLACEHOLDERS
        if is_placeholder:
            if attr.status == "VERIFIED":
                errors.append(
                    "VERIFIED status with empty placeholder manufacturer/brand"
                )
            else:
                warnings.append(
                    "Placeholder manufacturer/brand - treated as empty"
                )

        mfr_valid = len([e for e in errors if "Manufacturer" in e]) == 0
        brand_valid = len([e for e in errors if "Brand" in e]) == 0

        all_errors = errors if not (mfr_valid and brand_valid) else []
        all_warnings = warnings

        return ValidationCheckResult(
            check_name="manufacturer",
            valid=mfr_valid and brand_valid,
            errors=all_errors,
            warnings=all_warnings,
            severity="ERROR" if not (mfr_valid and brand_valid) else "PASS",
        )

    # ------------------------------------------------------------------
    # 4. Required Fields Validation
    # ------------------------------------------------------------------

    def validate_required_fields(self, attr: ProductTwinAttribute) -> ValidationCheckResult:
        """Detect missing required ProductTwin fields.

        Never fills missing data automatically - only reports problems.
        """
        errors: List[str] = []
        warnings: List[str] = []

        # Required fields for a ProductTwin attribute
        required_attr_fields = ["attribute"]

        missing: List[str] = []
        if not attr.attribute:
            missing.append("attribute")

        # Check normalized_value for attributes that typically need it
        # (but don't auto-fill - just report)
        if attr.attribute and not attr.normalized_value and attr.status == "VERIFIED":
            warnings.append(
                f"Attribute '{attr.attribute}' has VERIFIED status but "
                "no normalized_value - cannot verify specifications"
            )

        if missing:
            errors.append(f"Missing required field(s): {', '.join(missing)}")

        return ValidationCheckResult(
            check_name="required_fields",
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            severity="ERROR" if errors else "PASS",
        )

    # ------------------------------------------------------------------
    # 5. Description Compliance Validation
    # ------------------------------------------------------------------

    def validate_descriptions(self, attr: ProductTwinAttribute) -> ValidationCheckResult:
        """Validate generated descriptions against Unilog content guidelines.

        Checks:
        - Invoice description character limit
        - Mobile description character limit
        - Product title limit/rules
        - Short description rules
        - Long description rules
        - Casing and terminology
        - Unsupported claims/specifications
        """
        from backend.description_generation import generate_descriptions

        errors: List[str] = []
        warnings: List[str] = []

        # Generate all descriptions
        try:
            result = generate_descriptions(attr)
        except Exception as e:
            errors.append(f"Description generation failed: {e}")
            return ValidationCheckResult(
                check_name="descriptions",
                valid=False,
                errors=errors,
                warnings=warnings,
                severity="ERROR",
            )

        # Check character limits per field
        char_result = validate_char_limits(
            {
                "invoice": result["invoice_description"],
                "mobile": result["mobile_description"],
                "title": result["product_title"],
                "short": result["short_description"],
                "long": result["long_description"],
            }
        )

        for field, valid in char_result.items():
            if not valid:
                max_chars = DESCRIPTION_SPECS[field]["max_chars"]
                actual_len = len(
                    {
                        "invoice": result["invoice_description"],
                        "mobile": result["mobile_description"],
                        "title": result["product_title"],
                        "short": result["short_description"],
                        "long": result["long_description"],
                    }[field]
                )
                errors.append(
                    f"{field} description exceeds limit: "
                    f"{actual_len} chars > {max_chars} chars allowed"
                )
                warnings.append(
                    f"{field} description truncated to {max_chars} chars"
                )

        # Check for unsupported claims in long description
        unsupported = validate_no_unsupported_claims(
            result["long_description"], attr
        )
        if unsupported:
            for claim in unsupported:
                errors.append(f"Unsupported claim in long description: {claim}")

        # Check casing/terminology rules
        # Mobile description should have attribute uppercased
        if result["mobile_description"] and attr.attribute:
            if attr.attribute.upper() not in result["mobile_description"].upper():
                warnings.append(
                    "Mobile description may have incorrect attribute casing"
                )

        # Check title rules
        if result["product_title"]:
            title = result["product_title"]
            # Title should not have duplicate values
            parts = title.split()
            # Simple check for obvious duplicates
            if len(parts) > 1 and parts[0].lower() == parts[-1].lower():
                warnings.append("Product title may have duplicate trailing value")

        all_errors = errors if errors else []
        all_warnings = warnings if warnings else []

        valid = len(all_errors) == 0
        severity = "ERROR" if not valid else "PASS"

        return ValidationCheckResult(
            check_name="descriptions",
            valid=valid,
            errors=all_errors,
            warnings=all_warnings,
            severity=severity,
        )

    # ------------------------------------------------------------------
    # 6. Evidence Validation
    # ------------------------------------------------------------------

    def validate_evidence(self, attr: ProductTwinAttribute) -> ValidationCheckResult:
        """Validate evidence requirements.

        Checks:
        - VERIFIED values must have evidence
        - Evidence must contain source information
        - Flag VERIFIED values without evidence
        """
        errors: List[str] = []
        warnings: List[str] = []

        if attr.status == "VERIFIED":
            if not attr.evidence:
                errors.append(
                    "VERIFIED status with no evidence - "
                    "cannot verify specification source"
                )
            elif not attr.source:
                errors.append(
                    "VERIFIED status with evidence but no source information"
                )
            elif attr.evidence.strip() == "":
                errors.append("VERIFIED status with empty evidence string")
            else:
                warnings.append(
                    "VERIFIED with evidence - validation complete"
                )
        else:
            # Non-VERIFIED status - evidence is optional/informational
            if attr.evidence:
                warnings.append(
                    "Non-VERIFIED status with evidence - mark as VERIFIED when ready"
                )
            else:
                warnings.append(
                    "Non-VERIFIED status with no evidence - "
                    "will require evidence for VERIFIED promotion"
                )

        return ValidationCheckResult(
            check_name="evidence",
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            severity="ERROR" if errors else "PASS",
        )

    # ------------------------------------------------------------------
    # 7. Conflict Detection
    # ------------------------------------------------------------------

    def validate_conflicts(self, attr: ProductTwinAttribute) -> ValidationCheckResult:
        """Detect contradictions between extracted, normalized and verified values.

        Checks:
        - Contradictions between raw_value and normalized_value
        - Conflicting status indicators
        - Inconsistent UOM or unit formatting
        """
        errors: List[str] = []
        warnings: List[str] = []

        # Check if raw_value and normalized_value contradict each other
        if attr.raw_value and attr.normalized_value:
            raw_stripped = attr.raw_value.strip().lower()
            norm_stripped = str(attr.normalized_value).strip().lower()

            # If they look completely different, flag as potential conflict
            if raw_stripped and norm_stripped and raw_stripped != norm_stripped:
                # Could be normal (e.g., "15 kW" vs "15.0") but worth flagging
                if not (
                    raw_stripped.replace(" ", "").startswith(norm_stripped)
                    or norm_stripped.replace(" ", "").startswith(raw_stripped)
                ):
                    warnings.append(
                        f"Potential conflict: raw_value='{attr.raw_value}' "
                        f"vs normalized_value='{attr.normalized_value}'"
                    )

        # Check status vs value consistency
        if attr.status == "VERIFIED" and not attr.normalized_value:
            errors.append(
                "VERIFIED status with no normalized_value - "
                "data inconsistency detected"
            )

        # Check if unit in raw_value differs from specified unit
        if attr.raw_value and attr.unit:
            raw_has_unit = any(
                u in attr.raw_value.lower() for u in ["kw", "hp", "v", "a", "rpm"]
            )
            if not raw_has_unit and attr.unit:
                warnings.append(
                    "Unit specified but not present in raw_value - "
                    "verify correctness"
                )

        # If there are errors, mark as needing review
        if errors:
            warnings.append("Conflicts detected - human review recommended")

        return ValidationCheckResult(
            check_name="conflicts",
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            severity="ERROR" if errors else ("WARNING" if warnings else "PASS"),
        )

    # ------------------------------------------------------------------
    # Full validation run
    # ------------------------------------------------------------------

    def validate(self, attr: ProductTwinAttribute) -> Dict[str, Any]:
        """Run all validation checks and return structured result."""

        checks: Dict[str, bool] = {}
        all_errors: List[str] = []
        all_warnings: List[str] = []

        # 1. LOV compliance
        lov_result = self.validate_lov(attr)
        checks["lov"] = lov_result.valid
        if not lov_result.valid:
            all_errors.extend(lov_result.errors)
        all_warnings.extend(lov_result.warnings)

        # 2. UOM compliance
        uom_result = self.validate_uom(attr)
        checks["uom"] = uom_result.valid
        if not uom_result.valid:
            all_errors.extend(uom_result.errors)
        all_warnings.extend(uom_result.warnings)

        # 3. Manufacturer/Brand validation
        mfr_result = self.validate_manufacturer(attr)
        checks["manufacturer"] = mfr_result.valid
        if not mfr_result.valid:
            all_errors.extend(mfr_result.errors)
        all_warnings.extend(mfr_result.warnings)

        # 4. Required fields
        required_result = self.validate_required_fields(attr)
        checks["required_fields"] = required_result.valid
        if not required_result.valid:
            all_errors.extend(required_result.errors)
        all_warnings.extend(required_result.warnings)

        # 5. Description compliance
        desc_result = self.validate_descriptions(attr)
        checks["descriptions"] = desc_result.valid
        if not desc_result.valid:
            all_errors.extend(desc_result.errors)
        all_warnings.extend(desc_result.warnings)

        # 6. Evidence validation
        evidence_result = self.validate_evidence(attr)
        checks["evidence"] = evidence_result.valid
        if not evidence_result.valid:
            all_errors.extend(evidence_result.errors)
        all_warnings.extend(evidence_result.warnings)

        # 7. Conflict detection
        conflict_result = self.validate_conflicts(attr)
        checks["conflicts"] = conflict_result.valid
        if not conflict_result.valid:
            all_errors.extend(conflict_result.errors)
        all_warnings.extend(conflict_result.warnings)

        # Determine overall validity and human review needs
        all_valid = all(checks.values())
        needs_review = (
            not all_valid
            or any(
                r.severity in ("ERROR", "REVIEW")
                for r in [
                    lov_result,
                    uom_result,
                    mfr_result,
                    required_result,
                    desc_result,
                    evidence_result,
                    conflict_result,
                ]
                if r.errors
            )
        )

        # Build human-review flag rationale
        review_fields: List[str] = []
        if not lov_result.valid:
            review_fields.append("lov")
        if not uom_result.valid:
            review_fields.append("uom")
        if not mfr_result.valid:
            review_fields.append("manufacturer")
        if not evidence_result.valid:
            review_fields.append("evidence")
        if conflict_result.valid and conflict_result.warnings:
            review_fields.append("conflicts")

        result = {
            "valid": all_valid,
            "errors": all_errors if all_errors else [],
            "warnings": all_warnings if all_warnings else [],
            "checks": checks,
            "needs_human_review": needs_review,
            "review_fields": review_fields,
            "severity": (
                "ERROR"
                if not all_valid
                else ("WARNING" if any(checks.values()) == False else "PASS")
            ),
        }

        return result


# ---------------------------------------------------------------------------
# Module-level convenience function
# ---------------------------------------------------------------------------

def validate_product_twin(
    attr: ProductTwinAttribute,
) -> Dict[str, Any]:
    """Validate a ProductTwin attribute and return structured result.

    Convenience function for quick validation calls.

    Returns dict with keys:
        valid, errors, warnings, checks, needs_human_review
    """
    validator = ProductValidator()
    return validator.validate(attr)