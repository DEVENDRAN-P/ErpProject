from typing import Any


def explain_field(field_name: str, data: dict[str, Any]) -> dict[str, Any]:
    return {
        "field_name": field_name,
        "source": "placeholder",
        "confidence": 0.0,
        "evidence": "Placeholder explanation",
        "reason": "Placeholder reason",
    }
