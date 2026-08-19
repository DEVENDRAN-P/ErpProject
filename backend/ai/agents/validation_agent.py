from typing import Any, List, Dict

REQUIRED_MOTOR_ATTRIBUTES = [
    {"key": "rated_power", "label": "Rated Power", "unit": "kW"},
    {"key": "supply_voltage", "label": "Supply Voltage", "unit": "V"},
    {"key": "rated_current", "label": "Rated Current", "unit": "A"},
    {"key": "efficiency_class", "label": "Efficiency Class", "unit": ""},
    {"key": "rated_speed", "label": "Rated Speed", "unit": "RPM"},
    {"key": "max_temperature", "label": "Max Operating Temperature", "unit": "°C"},
    {"key": "frame_size", "label": "Frame Size", "unit": ""},
    {"key": "total_weight", "label": "Total Weight", "unit": "kg"},
]


def validate_product_data(product_data: Dict[str, Any]) -> Dict[str, Any]:
    attributes = product_data.get("attributes", [])
    if isinstance(attributes, dict):
        attributes = list(attributes.values())

    existing_keys = {attr.get("key"): attr for attr in attributes if isinstance(attr, dict)}
    missing_items: List[Dict[str, Any]] = []
    conflict_items: List[Dict[str, Any]] = []
    issues: List[str] = []

    # 1. Missing data detection - never invent specifications
    for req in REQUIRED_MOTOR_ATTRIBUTES:
        key = req["key"]
        if key not in existing_keys or not existing_keys[key].get("value"):
            missing_items.append({
                "key": key,
                "label": req["label"],
                "unit": req["unit"],
                "issue": f"Required industrial specification '{req['label']}' is missing. Do not invent technical specifications.",
            })
            issues.append(f"Missing required specification: {req['label']}")

    # 2. Conflict detection across multiple sources (ProductTruth)
    for attr in attributes:
        if isinstance(attr, dict) and attr.get("status") == "conflict":
            conflict_items.append({
                "key": attr.get("key"),
                "label": attr.get("label"),
                "source": attr.get("source"),
                "evidence": attr.get("evidence"),
                "value": attr.get("value"),
            })
            issues.append(f"ProductTruth Conflict in '{attr.get('label')}': {attr.get('evidence')}")

    # Additional conflict detection: check for contradictory values between attributes
    # Example: if voltage and current suggest different power ratings
    voltage_val = None
    current_val = None
    power_val = None

    for attr in attributes:
        if isinstance(attr, dict):
            if attr.get("key") == "supply_voltage" and attr.get("value"):
                try:
                    voltage_val = float(attr["value"].split()[0]) if " " in attr["value"] else float(attr["value"])
                except (ValueError, IndexError):
                    pass
            if attr.get("key") == "rated_current" and attr.get("value"):
                try:
                    current_val = float(attr["value"].split()[0]) if " " in attr["value"] else float(attr["value"])
                except (ValueError, IndexError):
                    pass
            if attr.get("key") == "rated_power" and attr.get("value"):
                try:
                    power_val = float(attr["value"].split()[0]) if " " in attr["value"] else float(attr["value"])
                except (ValueError, IndexError):
                    pass

    # Detect inconsistency: if voltage*current != power (within 20% tolerance).
    # This is an engineering plausibility check, not a claim of physical truth:
    # a single-phase approximation (P ≈ V × I) ignores power factor, efficiency
    # and phase count, so it is deliberately tolerant and only flags gross
    # contradictions. Power is normalized between kW and W before comparing.
    if voltage_val is not None and current_val is not None and power_val is not None:
        calculated_power_w = voltage_val * current_val  # watts (V × A)
        stated_power_w = power_val
        # If the stated power is orders of magnitude smaller than V×A, it is
        # expressed in kW — convert it to watts before comparing.
        if calculated_power_w > 0 and stated_power_w > 0 and calculated_power_w / stated_power_w > 500:
            stated_power_w = stated_power_w * 1000.0
        power_diff_pct = abs(calculated_power_w - stated_power_w) / max(calculated_power_w, 1) * 100
        if power_diff_pct > 20.0:
            conflict_items.append({
                "key": "power_consistency",
                "label": "Power Consistency (Voltage × Current)",
                "source": "Multi-Source Validation",
                "evidence": (
                    f"Voltage={voltage_val}V, Current={current_val}A → Calculated Power≈{calculated_power_w / 1000:.2f} kW, "
                    f"Stated Power={power_val} kW. Difference: {power_diff_pct:.1f}% "
                    "(plausibility check — single-phase approximation)"
                ),
                "value": f"{power_val} kW (stated) vs ≈{calculated_power_w / 1000:.2f} kW (calculated)",
            })
            issues.append(f"Power consistency conflict: voltage × current differs from stated rated power by {power_diff_pct:.1f}%")

    # Compute breakdown metrics
    total_req = len(REQUIRED_MOTOR_ATTRIBUTES)
    present_req = total_req - len(missing_items)
    completeness_score = round((present_req / total_req) * 100, 1)

    conflict_count = len(conflict_items)
    consistency_score = max(0.0, round(100.0 - (conflict_count * 20.0), 1))

    confidences = [attr.get("confidence", 0.0) for attr in attributes if isinstance(attr, dict)]
    avg_confidence = round((sum(confidences) / len(confidences)) * 100, 1) if confidences else 80.0

    return {
        "type": "validation",
        "completeness_score": completeness_score,
        "consistency_score": consistency_score,
        "avg_confidence": avg_confidence,
        "missing_attributes": missing_items,
        "conflicts": conflict_items,
        "issues": issues,
        "is_valid": len(issues) == 0,
    }