"""Canonical Status Vocabulary for ProductPilot AI.

Single source of truth for attribute / review / conflict status values used
across backend, database, API, and frontend. The canonical vocabulary is
UPPERCASE; legacy lowercase values written by earlier versions of the app are
mapped to their canonical form via :func:`canonical_status`.
"""

# --- Attribute / pipeline statuses -----------------------------------------
STATUS_EXTRACTED = "EXTRACTED"
STATUS_NORMALIZED = "NORMALIZED"
STATUS_VERIFIED = "VERIFIED"
STATUS_NOT_FOUND = "NOT_FOUND"
STATUS_INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
STATUS_CONFLICT = "CONFLICT"
STATUS_NEEDS_REVIEW = "NEEDS_REVIEW"

ATTRIBUTE_STATUSES = [
    STATUS_EXTRACTED,
    STATUS_NORMALIZED,
    STATUS_VERIFIED,
    STATUS_NOT_FOUND,
    STATUS_INSUFFICIENT_EVIDENCE,
    STATUS_CONFLICT,
    STATUS_NEEDS_REVIEW,
]

# --- Review / conflict statuses --------------------------------------------
STATUS_PENDING = "PENDING"
STATUS_OPEN = "OPEN"
STATUS_APPROVED = "APPROVED"
STATUS_REJECTED = "REJECTED"
STATUS_EDITED = "EDITED"
STATUS_RESOLVED = "RESOLVED"

REVIEW_STATUSES = [STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED, STATUS_EDITED]
CONFLICT_STATUSES = [STATUS_OPEN, STATUS_RESOLVED, STATUS_REJECTED]

# Legacy (pre-standardization) values -> canonical value
_LEGACY_MAP = {
    "verified": STATUS_VERIFIED,
    "normalized": STATUS_NORMALIZED,
    "extracted": STATUS_EXTRACTED,
    "not_found": STATUS_NOT_FOUND,
    "insufficient_evidence": STATUS_INSUFFICIENT_EVIDENCE,
    "conflict": STATUS_CONFLICT,
    "needs_review": STATUS_NEEDS_REVIEW,
    "low_confidence": STATUS_NEEDS_REVIEW,
    "unverified": STATUS_NEEDS_REVIEW,
    "missing": STATUS_NOT_FOUND,
    "pending": STATUS_PENDING,
    "open": STATUS_OPEN,
    "approved": STATUS_APPROVED,
    "rejected": STATUS_REJECTED,
    "edited": STATUS_EDITED,
    "resolved": STATUS_RESOLVED,
}


def canonical_status(value: str | None) -> str:
    """Map any stored/legacy status value to its canonical uppercase form.

    Unknown values are upper-cased and returned as-is so that no data is
    silently lost, but the canonical vocabulary should be preferred.
    """
    if not value:
        return STATUS_NEEDS_REVIEW
    key = value.strip().lower()
    if key in _LEGACY_MAP:
        return _LEGACY_MAP[key]
    return value.strip().upper()
