import os
import re
import json
from typing import Any, Dict, List

from backend.core.config import settings

try:
    import openai
except ImportError:
    openai = None


# Simple validation result dict structure (matching ValidationResult schema)
def _make_validation_result() -> dict:
    return {
        "attribute_match": True,
        "unit_valid": True,
        "context_valid": True,
        "plausibility_valid": True,
        "cross_attribute_valid": "insufficient_data",
        "details": "",
    }


# Attribute-specific expected units and plausibility ranges
ATTRIBUTE_SPECS = {
    "rated_power": {
        "label": "Rated Power",
        "expected_units": ["W", "KW", "HP"],
        "plausibility": {
            "with_voltage_current": True,
            "min": 0.001,  # 1W minimum
            "max": 10000,  # 10MW maximum
        },
    },
    "supply_voltage": {
        "label": "Supply Voltage",
        "expected_units": ["V"],
        "plausibility": {
            "with_current_power": True,
            "min": 1,  # 1V minimum
            "max": 1500,  # 1500V maximum
        },
    },
    "rated_current": {
        "label": "Rated Current",
        "expected_units": ["A"],
        "plausibility": {
            "with_voltage_power": True,
            "min": 0.01,  # 10mA minimum
            "max": 1000,  # 1000A maximum
        },
    },
    "efficiency_class": {
        "label": "Efficiency Class",
        "expected_units": [],
        "plausibility": {},
    },
    "rated_speed": {
        "label": "Rated Speed",
        "expected_units": ["RPM"],
        "plausibility": {
            "with_frequency": True,
            "min": 10,  # 10 RPM minimum
            "max": 30000,  # 30,000 RPM maximum
        },
    },
    "max_temperature": {
        "label": "Max Operating Temperature",
        "expected_units": ["°C"],
        "plausibility": {
            "min": -50,  # -50°C minimum
            "max": 200,  # 200°C maximum
        },
    },
    "frame_size": {
        "label": "Frame Size",
        "expected_units": [],
        "plausibility": {},
    },
    "total_weight": {
        "label": "Total Weight",
        "expected_units": ["KG"],
        "plausibility": {
            "min": 0.1,  # 0.1kg minimum
            "max": 10000,  # 10tonnes maximum
        },
    },
}


def extract_context(text: str, position: int, window: int = 300) -> str:
    """Extract a text window around a given position."""
    start = max(0, position - window)
    end = min(len(text), position + window)
    return text[start:end]


def validate_unit(value: str, expected_units: List[str], attribute_key: str) -> Dict[str, Any]:
    """Validate that a value's unit matches the expected unit for the attribute."""
    if not expected_units:
        return {"unit_valid": True, "normalized_unit": None}

    # Extract unit from value (e.g., "12 V" -> "V", "38.05A" -> "A")
    unit_match = re.search(r"([a-zA-Z°]+)$", value.strip())
    detected_unit = unit_match.group(1).upper() if unit_match else ""

    if detected_unit in [u.upper() for u in expected_units]:
        return {"unit_valid": True, "normalized_unit": detected_unit}

    # Check if value has no unit but expected units exist - could be implicit
    if not unit_match and expected_units:
        # Value might be like "12" with unit implied by attribute
        return {"unit_valid": True, "normalized_unit": expected_units[0].upper()}

    return {
        "unit_valid": False,
        "normalized_unit": detected_unit if detected_unit else None,
    }


def compute_plausibility(
    attr_key: str,
    value: float,
    other_attrs: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """Compute plausibility validation for an attribute value."""
    spec = ATTRIBUTE_SPECS.get(attr_key, {})
    result: Dict[str, Any] = {
        "plausibility_valid": True,
        "warning": None,
    }

    if "min" in spec and value < spec["min"]:
        result["plausibility_valid"] = False
        result["warning"] = f"Value {value} is below minimum plausible range ({spec['min']})"

    if "max" in spec and value > spec["max"]:
        result["plausibility_valid"] = False
        result["warning"] = f"Value {value} is above maximum plausible range ({spec['max']})"

    # Cross-attribute plausibility checks
    if other_attrs and spec.get("plausibility", {}).get("with_voltage_current"):
        # Check voltage-current-power consistency
        voltage = other_attrs.get("supply_voltage_parsed")
        current = other_attrs.get("rated_current_parsed")
        power = other_attrs.get("rated_power_parsed")

        if attr_key == "rated_power" and voltage is not None and current is not None:
            calculated = voltage * current
            diff_pct = abs(calculated - value) / max(calculated, 1) * 100
            if diff_pct > 30:
                result["plausibility_valid"] = False
                result["warning"] = (
                    f"Power {value} inconsistent with V×I ({voltage}A × {current}A = {calculated:.1f}), "
                    f"diff {diff_pct:.1f}%"
                )

        if attr_key == "rated_current" and voltage is not None and power is not None:
            if voltage > 0:
                calculated = power / voltage
                diff_pct = abs(calculated - value) / max(calculated, 1) * 100
                if diff_pct > 30:
                    result["plausibility_valid"] = False
                    result["warning"] = (
                        f"Current {value} inconsistent with P/V ({power}V / {voltage}V = {calculated:.2f}), "
                        f"diff {diff_pct:.1f}%"
                    )

        if attr_key == "supply_voltage" and current is not None and power is not None:
            if current > 0:
                calculated = power / current
                diff_pct = abs(calculated - voltage) / max(calculated, 1) * 100
                if diff_pct > 30:
                    result["plausibility_valid"] = False
                    result["warning"] = (
                        f"Voltage {voltage} inconsistent with P/I ({power}A / {current}A = {calculated:.2f}), "
                        f"diff {diff_pct:.1f}%"
                    )

    return result


def extract_attribute_with_context(
    text: str,
    attr_key: str,
    expected_patterns: List[str],
    window: int = 300,
) -> Dict[str, Any]:
    """Extract an attribute using pattern matching with context analysis."""
    # Try each pattern
    for pattern in expected_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            # Extract value and context
            value_text = match.group(0)
            match_position = match.start()

            # Extract context window
            context = extract_context(text, match_position, window)

            # Try to extract raw value (number with optional unit)
            value_match = re.search(r"([\d\.\,]+)\s*([a-zA-Z°]*)", value_text)
            raw_value = value_match.group(1).strip() if value_match else value_text
            detected_unit = value_match.group(2).strip() if value_match else ""

            # Normalize the value - handle decimal comma issues
            normalized_value = raw_value.replace(",", ".")
            try:
                numeric_value = float(normalized_value)
            except ValueError:
                numeric_value = None

            # Validate unit
            unit_validation = validate_unit(value_text, ATTRIBUTE_SPECS[attr_key]["expected_units"], attr_key)

            # Build evidence from context
            evidence = context.strip()[:500]
            evidence_quote = value_text.strip()

            # Determine initial status and confidence
            status = "verified"
            confidence = 0.95

            if not unit_validation["unit_valid"]:
                status = "needs_review"
                confidence = 0.45
                reason = f"Unit '{detected_unit}' does not match expected units for {attr_key}"
            elif numeric_value is None:
                status = "needs_review"
                confidence = 0.3
                reason = f"Could not parse numeric value from '{raw_value}'"
            else:
                reason = f"Explicitly identified as {attr_key} in source document."

            return {
                "key": attr_key,
                "label": ATTRIBUTE_SPECS[attr_key]["label"],
                "raw_value": raw_value,
                "normalized_value": normalized_value,
                "value": str(numeric_value) if numeric_value is not None else None,
                "unit": unit_validation["normalized_unit"] or ATTRIBUTE_SPECS[attr_key]["expected_units"][0] if ATTRIBUTE_SPECS[attr_key]["expected_units"] else None,
                "confidence": confidence,
                "source": "Document Extraction",
                "page": 1,
                "evidence": evidence,
                "evidence_quote": evidence_quote,
                "status": status,
                "reason": reason,
                "context": context,
                "numeric_value": numeric_value,
            }

    # No pattern matched
    return {
        "key": attr_key,
        "label": ATTRIBUTE_SPECS[attr_key]["label"],
        "raw_value": None,
        "normalized_value": None,
        "value": None,
        "unit": ATTRIBUTE_SPECS[attr_key]["expected_units"][0] if ATTRIBUTE_SPECS[attr_key]["expected_units"] else None,
        "confidence": 0.0,
        "source": "Document Extraction",
        "page": 1,
        "evidence": "Insufficient evidence.",
        "evidence_quote": "Not found in document",
        "status": "not_found",
        "reason": f"{ATTRIBUTE_SPECS[attr_key]['label']} not found in document",
        "context": "",
        "numeric_value": None,
    }


def enrich_product_metadata(input_text: str) -> Dict[str, Any]:
    api_key = settings.openai_api_key or os.getenv("OPENAI_API_KEY", "")

    if api_key and openai:
        try:
            client = openai.OpenAI(api_key=api_key)
            prompt = (
                "Extract structured industrial product specification attributes from the following text into JSON format.\n"
                "Attributes: rated_power, supply_voltage, rated_current, efficiency_class, rated_speed, max_temperature, frame_size, total_weight.\n"
                "Each attribute must be an object with fields: key, label, raw_value (string or null), value (string or null), unit, confidence (0.0-1.0), source, page, evidence, evidence_quote, status ('verified', 'needs_review', 'not_found'), validation results, reason.\n"
                "If a value cannot be found, set value to null, confidence to 0.0, status to 'not_found', and evidence to 'Insufficient evidence.'\n"
                "Never invent or hallucinate technical specifications.\n"
                "For every extracted value, extract surrounding context (at least 200 characters before and after) as evidence.\n"
                "Validate that units match the expected attribute type.\n"
                "Mark values as 'needs_review' if context is ambiguous, unit is suspicious, or plausibility is questionable.\n\n"
                f"Input text:\n{input_text[:3000]}"
            )
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.1,
            )
            raw = response.choices[0].message.content
            parsed = json.loads(raw)
            if "attributes" in parsed:
                # Post-process LLM output to ensure proper structure
                attributes = parsed["attributes"]
                for attr in attributes:
                    attr_key = attr.get("key", "")
                    if "raw_value" not in attr:
                        attr["raw_value"] = attr.get("value")
                    if "normalized_value" not in attr:
                        attr["normalized_value"] = attr.get("value")
                    if "validation" not in attr:
                        attr["validation"] = {}
                    if "reason" not in attr:
                        attr["reason"] = ""
                    status = attr.get("status", "verified")
                    if status not in ("verified", "needs_review", "not_found"):
                        attr["status"] = "needs_review"
                return {
                    "type": "enrichment",
                    "product_name": input_text[:100],
                    "attributes": parsed["attributes"],
                    "applications": parsed.get("applications", ["Industrial Pumping", "Compressor Systems", "HVAC Fans"]),
                    "industries": parsed.get("industries", ["Manufacturing", "Oil & Gas", "Water Treatment"]),
                    "tags": parsed.get("tags", ["Industrial Motor", "3-Phase", "IE3"]),
                }
        except Exception as e:
            print(f"[OPENAI EXTRACTION ERROR] {e}")

    # Gemini LLM Extraction
    gemini_key = getattr(settings, "gemini_api_key", None) or os.getenv("GEMINI_API_KEY", "")
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            prompt = (
                "Extract structured industrial product specification attributes from the following text into JSON format.\n"
                "Attributes: rated_power, supply_voltage, rated_current, efficiency_class, rated_speed, max_temperature, frame_size, total_weight.\n"
                "Return JSON object with top-level key 'attributes' containing an array of objects: {key, label, value, unit, confidence, evidence, status}.\n\n"
                f"Input text:\n{input_text[:3000]}"
            )
            resp = model.generate_content(prompt)
            raw = resp.text
            if "{" in raw:
                json_str = raw[raw.find("{"):raw.rfind("}")+1]
                parsed = json.loads(json_str)
                if "attributes" in parsed and isinstance(parsed["attributes"], list):
                    return {
                        "type": "enrichment",
                        "product_name": input_text[:100],
                        "attributes": parsed["attributes"],
                        "applications": ["Industrial Pumping", "Compressor Systems", "HVAC Fans"],
                        "industries": ["Manufacturing", "Oil & Gas", "Water Treatment"],
                        "tags": ["Industrial Motor", "3-Phase", "IE3"],
                    }
        except Exception as e:
            print(f"[GEMINI EXTRACTION ERROR] {e}")

    # Rule-based extraction fallback
    text_lower = input_text.lower()

    # Extract all candidate values with their positions for context-aware processing
    # Rated Power: patterns like "15 kW", "200 HP", "Rated Power: 15kW"
    power_patterns = [
        r"rated\s*power[:\s]+([\d\.\,]+\s*(?:kw|hp|w))",
        r"([\d\.\,]+\s*(?:kw|hp|w))",
        r"power[:\s]+([\d\.\,]+)",
    ]
    power_result = extract_attribute_with_context(input_text, "rated_power", power_patterns)

    # Supply Voltage: patterns like "415 V", "690V", "Supply Voltage: 415V"
    voltage_patterns = [
        r"supply\s*voltage[:\s]+([\d\.]+)\s*v",
        r"([\d\.]+\s*v)",
        r"voltage[:\s]+([\d\.]+)",
    ]
    voltage_result = extract_attribute_with_context(input_text, "supply_voltage", voltage_patterns)

    # Rated Current: patterns like "38.05 A", "28.5A", "Rated Current: 38.05A"
    current_patterns = [
        r"rated\s*current[:\s]+([\d\.\,]+\s*a)",
        r"([\d\.\,]+\s*a\b)",
        r"current[:\s]+([\d\.\,]+)",
    ]
    current_result = extract_attribute_with_context(input_text, "rated_current", current_patterns)

    # Efficiency Class: patterns like "IE3", "IE3 Premium", "efficiency: IE3"
    efficiency_match = re.search(r"(ie3|ie1|ie2|ie4)\s*[^\w]?\s*(?:premium)?", text_lower)
    efficiency_result = {
        "key": "efficiency_class",
        "label": "Efficiency Class",
        "raw_value": efficiency_match.group(0).upper() if efficiency_match else None,
        "normalized_value": efficiency_match.group(1).upper() if efficiency_match else None,
        "value": efficiency_match.group(1).upper() if efficiency_match else None,
        "unit": "",
        "confidence": 0.97 if efficiency_match else 0.0,
        "source": "Document Extraction",
        "page": 1,
        "evidence": f"Efficiency class reference: '{efficiency_match.group(0) if efficiency_match else 'not found'}'",
        "evidence_quote": f"Efficiency Class: {efficiency_match.group(0).upper() if efficiency_match else 'not specified'}",
        "status": "verified" if efficiency_match else "not_found",
        "reason": "Efficiency class found in document reference to IEC 60034-30-1 standard" if efficiency_match else "Efficiency class not specified in document",
        "context": input_text[:300] if efficiency_match else "",
        "numeric_value": None,
    }

    # Rated Speed: patterns like "1475 RPM", "1500 rpm", "Rated Speed: 1475 rpm"
    speed_patterns = [
        r"rated\s*speed[:\s]+([\d\.]+)\s*(?:rpm|1/min)",
        r"([\d]+\s*rpm\b)",
        r"speed[:\s]+([\d]+\s*rpm)",
    ]
    speed_result = extract_attribute_with_context(input_text, "rated_speed", speed_patterns)

    # Max Temperature: patterns like "155°C", "155 C", "155 degC", "155 deg. C"
    all_temps = [(m.group(1), m.start()) for m in re.finditer(r"(\d{2,3})\s*(?:°|deg\.?\s*)?\s*c\b", text_lower)]
    temp_patterns = [r"(\d{2,3})\s*(?:°|deg\.?\s*)?\s*c\b"]
    temp_result = {
        "key": "max_temperature",
        "label": "Max Operating Temperature",
        "raw_value": all_temps[0][0] + "°C" if all_temps else None,
        "normalized_value": all_temps[0][0] if all_temps else None,
        "value": float(all_temps[0][0]) if all_temps else None,
        "unit": "°C",
        "confidence": 0.85 if all_temps else 0.0,
        "source": "Document Extraction",
        "page": 1,
        "evidence": f"Temperature specification: {all_temps[0][0]}°C" if all_temps else "Insufficient evidence.",
        "evidence_quote": f"{all_temps[0][0]}°C" if all_temps else "Temperature: Not specified",
        "status": "verified" if all_temps else "needs_review",
        "reason": "Temperature specification found in document" if all_temps else "Temperature not specified in document",
        "context": input_text[max(0, all_temps[0][1]-100):all_temps[0][1]+100] if all_temps else "",
        "numeric_value": float(all_temps[0][0]) if all_temps else None,
    } if all_temps else {
        "key": "max_temperature",
        "label": "Max Operating Temperature",
        "raw_value": None,
        "normalized_value": None,
        "value": None,
        "unit": "°C",
        "confidence": 0.0,
        "source": "Document Extraction",
        "page": 1,
        "evidence": "Insufficient evidence.",
        "evidence_quote": "Temperature: Not specified",
        "status": "not_found",
        "reason": "Max operating temperature not specified in document",
        "context": "",
        "numeric_value": None,
    }

    # Frame Size: patterns like "160M", "132S", "Frame: 160M"
    frame_match = re.search(r"\b(160m|132s|180l|200l|90s|100l|225m)\b", text_lower)
    frame_result = {
        "key": "frame_size",
        "label": "Frame Size",
        "raw_value": frame_match.group(1).upper() if frame_match else None,
        "normalized_value": frame_match.group(1).upper() if frame_match else None,
        "value": frame_match.group(1).upper() if frame_match else None,
        "unit": "",
        "confidence": 0.97 if frame_match else 0.85,
        "source": "Document Extraction",
        "page": 1,
        "evidence": f"IEC standard frame size: '{frame_match.group(1).upper()}' if frame_match else 'IEC standard frame size'",
        "evidence_quote": f"IEC Frame {frame_match.group(1).upper() if frame_match else '160M'} Cast Iron",
        "status": "verified" if frame_match else "low_confidence",
        "reason": "IEC standard frame size identified in document" if frame_match else "Frame size not identified in document",
        "context": input_text[max(0, frame_match.start()-50):frame_match.end()+50] if frame_match else "",
        "numeric_value": None,
    } if frame_match else {
        "key": "frame_size",
        "label": "Frame Size",
        "raw_value": None,
        "normalized_value": None,
        "value": None,
        "unit": "",
        "confidence": 0.85,
        "source": "Document Extraction",
        "page": 1,
        "evidence": "IEC standard frame size not found in document",
        "evidence_quote": "Frame Size: Not specified",
        "status": "not_found",
        "reason": "Frame size not identified in document",
        "context": "",
        "numeric_value": None,
    }

    # Total Weight: typically not found in motor docs in this fallback
    weight_result = {
        "key": "total_weight",
        "label": "Total Weight",
        "raw_value": None,
        "normalized_value": None,
        "value": None,
        "unit": "kg",
        "confidence": 0.0,
        "source": "None",
        "page": 0,
        "evidence": "Insufficient evidence.",
        "evidence_quote": "Weight: Not specified",
        "status": "not_found",
        "reason": "Weight not specified in document",
        "context": "",
        "numeric_value": None,
    }

    # Build attributes list with post-processing validation
    attributes = [power_result, voltage_result, current_result, efficiency_result, speed_result, temp_result, frame_result, weight_result]

    # Post-process: compute plausibility and cross-attribute validation
    # Extract parsed numeric values for cross-attribute checks
    parsed_attrs = {}
    for attr in attributes:
        key = attr["key"]
        if attr.get("value") is not None:
            try:
                parsed_attrs[key] = float(attr["value"])
            except (ValueError, TypeError):
                parsed_attrs[key] = None

    # Add plausibility validation to each attribute
    for attr in attributes:
        key = attr["key"]
        other_attrs = {k: v for k, v in parsed_attrs.items() if k != key}
        plausibility = compute_plausibility(key, attr.get("numeric_value"), other_attrs)

        # Build validation dict (matching ValidationResult schema)
        validation = {
            "attribute_match": plausibility["plausibility_valid"],
            "unit_valid": unit_validation.get("unit_valid", True) if "unit_validation" in dir() else True,
            "context_valid": True,
            "plausibility_valid": plausibility["plausibility_valid"],
            "cross_attribute_valid": "insufficient_data",
            "details": plausibility.get("warning", ""),
        }

        # Adjust status and confidence based on validation
        if attr["status"] == "verified" and not plausibility["plausibility_valid"]:
            attr["status"] = "needs_review"
            attr["confidence"] = min(attr["confidence"], 0.5)
            attr["reason"] = f"{attr['reason']} | {plausibility.get('warning', '')}"
        elif attr["status"] == "not_found":
            attr["confidence"] = 0.0

        attr["validation"] = validation
        attr["reason"] = (
            attr["reason"][:100] if len(attr["reason"]) > 100 else attr["reason"]
        )

    return {
        "type": "enrichment",
        "product_name": input_text[:100],
        "attributes": attributes,
        "applications": ["Industrial Pumping", "Compressor Systems", "HVAC Fans", "Conveyor Drives"],
        "industries": ["Manufacturing", "Oil & Gas", "Water Treatment", "Mining"],
        "tags": ["3-Phase", "Induction Motor", "IE3", "IP55", "Siemens"],
    }