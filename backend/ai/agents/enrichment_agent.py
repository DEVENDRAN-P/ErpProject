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


def _is_valid_numeric_value(raw_value: str) -> bool:
    """Reject section numbers, stray periods, and other non-numeric junk.

    Examples of invalid values:
      '.'  '8.1.2'  '1.'  '..'  ''
    Examples of valid values:
      '15'  '415'  '28.5'  '1,500'
    """
    if not raw_value or not raw_value.strip():
        return False
    v = raw_value.strip().replace(",", "")
    # Must contain at least one digit
    if not re.search(r"\d", v):
        return False
    # Reject if it's just a period or multiple periods
    if v.replace(".", "").strip() == "":
        return False
    # Reject section numbers like 8.1.2 (3+ dot-separated groups)
    if re.match(r"^\d+(\.\d+){2,}$", v):
        return False
    # Reject single-digit section numbers followed by dot (e.g. "8.")
    if re.match(r"^\d+\.$", v):
        return False
    return True


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
            # Require at least one digit — reject junk like ". V" or "8.1.2 A"
            value_match = re.search(r"(\d[\d\.\,]*)\s*([a-zA-Z°]*)", value_text)
            raw_value = value_match.group(1).strip() if value_match else value_text
            detected_unit = value_match.group(2).strip() if value_match else ""

            # Validate the extracted numeric value
            if not _is_valid_numeric_value(raw_value):
                continue  # Skip this match — try next pattern

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


# ---------------------------------------------------------------------------
# Known valid Gemini API model names (stable, as of Aug 2026)
# Used to validate GEMINI_MODELS env var and skip invalid entries.
# ---------------------------------------------------------------------------
_KNOWN_GEMINI_MODELS = {
    # Gemini 3.x (newest stable)
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    # Gemini 2.5 (still available)
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
}

# Default model list — newest first, with a fast fallback.
# As of Aug 2026: 2.5 models return 404, 2.0 models shut down.
# Use 3.x stable models (confirmed working on Gemini REST API).
_DEFAULT_GEMINI_MODELS = "gemini-3.5-flash-lite,gemini-3.5-flash,gemini-3.1-flash-lite"


def _gemini_extract(input_text: str) -> Dict[str, Any] | None:
    """Try Gemini extraction via REST API. Returns result dict or None on failure.

    Structured diagnostic logs (no API key exposed):
        GEMINI_API_KEY configured: true/false
        Gemini initialization: success/failure (<reason>)
        Gemini model selected: <model>
        Gemini request: started
        Gemini request: success/failure (<reason>)
        Gemini response parsed: success/failure (<reason>)
        Fallback activated: true/false
        llm_used: gemini
    """
    # ── 1. Key detection ──────────────────────────────────────────────
    gemini_key = getattr(settings, "gemini_api_key", None) or os.getenv("GEMINI_API_KEY", "")
    key_present = bool(gemini_key and gemini_key.strip())
    print(f"GEMINI_API_KEY configured: {str(key_present).lower()}")

    if not key_present:
        print(f"Gemini initialization: failure (no API key in settings or env)")
        print(f"Fallback activated: true")
        return None

    # ── 2. Model list ─────────────────────────────────────────────────
    _default_list = [m.strip() for m in _DEFAULT_GEMINI_MODELS.split(",") if m.strip()]
    raw_models = os.getenv("GEMINI_MODELS", "")
    if raw_models.strip():
        gemini_models = [m.strip() for m in raw_models.split(",") if m.strip()]
    else:
        gemini_models = _default_list

    # Validate each model against known names; skip unknown ones
    validated = []
    for m in gemini_models:
        if m in _KNOWN_GEMINI_MODELS:
            validated.append(m)
        else:
            print(f"Gemini initialization: warning (unknown model '{m}' skipped — not in known model list)")
    gemini_models = validated if validated else _default_list

    if not gemini_models:
        print(f"Gemini initialization: failure (no valid models after validation)")
        print(f"Fallback activated: true")
        return None

    print(f"Gemini initialization: success")

    # ── 3. Build prompt ───────────────────────────────────────────────
    prompt = (
        "You are an industrial product data extraction engine. Analyze the following document text and extract ALL product specification attributes you can find.\n\n"
        "The document may be about ANY type of industrial product — motors, abrasives, valves, pumps, electrical components, etc.\n"
        "Extract attributes that are PRESENT in the document. Do NOT extract attributes that are not mentioned.\n\n"
        "Return a JSON object with key 'attributes' containing an array of objects, each with:\n"
        "- key: snake_case attribute name\n"
        "- label: Human-readable label\n"
        "- value: The extracted value as a string, or null if not found\n"
        "- unit: The unit of measurement, or empty string\n"
        "- confidence: 0.0 to 1.0\n"
        "- evidence: Exact quote from the document\n"
        "- status: 'verified' if explicitly stated, 'needs_review' if ambiguous, 'not_found' if absent\n\n"
        "Rules:\n"
        "- Never invent specifications not present in the text\n"
        "- If an attribute is not in the document, include it with value=null, status='not_found'\n"
        "- Always include: product_name, product_type/category, manufacturer/brand\n"
        "- Include any other specifications you find (dimensions, materials, ratings, standards, etc.)\n\n"
        f"Document text:\n{input_text[:4000]}"
    )
    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"}
    }).encode("utf-8")

    # ── 4. Try each model ─────────────────────────────────────────────
    import urllib.request
    import urllib.error

    for model_name in gemini_models:
        print(f"Gemini model selected: {model_name}")
        print(f"Gemini request: started")

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/"
            f"models/{model_name}:generateContent?key={gemini_key}"
        )
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            # Extract text from Gemini response
            candidates = data.get("candidates", [])
            if not candidates:
                print(f"Gemini request: failure (empty candidates list)")
                print(f"Fallback activated: true")
                return None

            raw_text = (
                candidates[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )
            print(f"Gemini request: success")

            # ── 5. Parse JSON response ────────────────────────────────
            if not raw_text or "{" not in raw_text:
                print(f"Gemini response parsed: failure (no JSON in response, first 200 chars: {raw_text[:200] if raw_text else 'None'})")
                print(f"Fallback activated: true")
                return None

            json_str = raw_text[raw_text.find("{"):raw_text.rfind("}") + 1]
            parsed = json.loads(json_str)

            if not isinstance(parsed.get("attributes"), list):
                print(f"Gemini response parsed: failure (no 'attributes' array in response)")
                print(f"Fallback activated: true")
                return None

            attributes = parsed["attributes"]
            print(f"Gemini response parsed: success")
            print(f"Fallback activated: false")
            print(f"llm_used: gemini")
            return {
                "type": "enrichment",
                "llm_used": "gemini",
                "product_name": input_text[:100],
                "attributes": attributes,
                "applications": parsed.get("applications", []),
                "industries": parsed.get("industries", []),
                "tags": parsed.get("tags", []),
            }

        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8", errors="ignore")[:200]
            if e.code == 404:
                print(f"Gemini request: failure (model '{model_name}' not found — HTTP 404, trying next model)")
                continue  # Try next model
            else:
                print(f"Gemini request: failure (HTTP {e.code}: {error_body})")
                print(f"Fallback activated: true")
                return None

        except json.JSONDecodeError as e:
            print(f"Gemini request: success (HTTP 200) but response parsed: failure (invalid JSON: {e})")
            print(f"Fallback activated: true")
            return None

        except Exception as e:
            print(f"Gemini request: failure ({type(e).__name__}: {e})")
            print(f"Fallback activated: true")
            return None

    # All models failed (all 404)
    print(f"Gemini request: failure (all {len(gemini_models)} models returned HTTP 404)")
    print(f"Fallback activated: true")
    return None


def _openai_extract(input_text: str) -> Dict[str, Any] | None:
    """Try OpenAI extraction. Returns result dict or None on failure."""
    api_key = settings.openai_api_key or os.getenv("OPENAI_API_KEY", "")
    print(f"[ENRICH DIAG] OpenAI key present={bool(api_key and api_key.strip())}")
    if not api_key or not openai:
        return None
    try:
        client = openai.OpenAI(api_key=api_key)
        prompt = (
            "You are an industrial product data extraction engine. Analyze the following document text and extract ALL product specification attributes you can find.\n\n"
            "The document may be about ANY type of industrial product — motors, abrasives, valves, pumps, electrical components, etc.\n"
            "Extract attributes that are PRESENT in the document. Do NOT extract attributes that are not mentioned.\n\n"
            "Return a JSON object with key 'attributes' containing an array of objects, each with:\n"
            "- key: snake_case attribute name (e.g. 'rated_power', 'grit_size', 'disc_diameter', 'abrasive_type', 'max_rpm', 'backing_type', 'bond_type')\n"
            "- label: Human-readable label\n"
            "- value: The extracted value as a string, or null if not found\n"
            "- unit: The unit of measurement, or empty string\n"
            "- confidence: 0.0 to 1.0 based on how certain you are\n"
            "- evidence: Exact quote from the document supporting this value\n"
            "- status: 'verified' if explicitly stated, 'needs_review' if ambiguous, 'not_found' if absent\n\n"
            "Rules:\n"
            "- Never invent specifications not present in the text\n"
            "- If an attribute is not in the document, include it with value=null, status='not_found'\n"
            "- Always include: product_name, product_type/category, manufacturer/brand\n"
            "- Include any other specifications you find (dimensions, materials, ratings, standards, etc.)\n\n"
            f"Document text:\n{input_text[:4000]}"
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
            attributes = parsed["attributes"]
            for attr in attributes:
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
                "llm_used": "openai",
                "product_name": input_text[:100],
                "attributes": parsed["attributes"],
                "applications": parsed.get("applications", []),
                "industries": parsed.get("industries", []),
                "tags": parsed.get("tags", []),
            }
    except Exception as e:
        print(f"[OPENAI EXTRACTION ERROR] {e}")
    return None


def enrich_product_metadata(input_text: str) -> Dict[str, Any]:
    """Run enrichment: Gemini → OpenAI → rule-based fallback.

    Structured diagnostic logs (no API key exposed):
        Extraction started, text_length=<n>
        GEMINI_API_KEY configured: true/false
        Gemini initialization: success/failure
        Gemini model selected: <model>
        Gemini request: started
        Gemini request: success/failure
        Gemini response parsed: success/failure
        Fallback activated: true/false
        llm_used: gemini | openai | None
    """
    print(f"Extraction started, text_length={len(input_text)}")

    # 1) Try Gemini first (free tier)
    gemini_result = _gemini_extract(input_text)
    if gemini_result:
        return gemini_result

    # 2) Fall back to OpenAI
    openai_result = _openai_extract(input_text)
    if openai_result:
        print(f"Fallback activated: false")
        print(f"llm_used: openai")
        return openai_result

    # Rule-based extraction fallback
    print(f"Fallback activated: true")
    print(f"llm_used: None")
    print(f"[ENRICH DIAG] Using rule-based extraction fallback (no LLM succeeded)")
    text_lower = input_text.lower()

    # ── Product-type detection ─────────────────────────────────────────
    # Detect whether the document is about a motor or a different product type.
    # This prevents forcing motor attributes onto abrasive discs, pumps, etc.
    _motor_keywords = ["motor", "induction", "stator", "rotor", "torque", "rpm", "3-phase", "three-phase", "ie3", "ie2", "ie4"]
    _abrasive_keywords = ["abrasive", "grit", "disc", "grinding", "sanding", "flap", "backing", "bond type", "max rpm"]
    _pump_keywords = ["pump", "flow rate", "head", "impeller", "discharge", "suction", "cavitation"]
    _valve_keywords = ["valve", "gate valve", "ball valve", "butterfly", "pressure rating", "seat", "bonnet"]
    _general_keywords = ["brand", "manufacturer", "model", "dimensions", "material", "weight", "certificate", "standard", "specification"]

    detected_type = "unknown"
    if any(kw in text_lower for kw in _motor_keywords):
        detected_type = "motor"
    elif any(kw in text_lower for kw in _abrasive_keywords):
        detected_type = "abrasive"
    elif any(kw in text_lower for kw in _pump_keywords):
        detected_type = "pump"
    elif any(kw in text_lower for kw in _valve_keywords):
        detected_type = "valve"
    elif any(kw in text_lower for kw in _general_keywords):
        detected_type = "general"

    print(f"[ENRICH DIAG] Detected product type: {detected_type}")

    # ── General attributes (all product types) ──────────────────────────
    general_attrs = []

    # Brand / Manufacturer
    brand_match = re.search(r"(?:brand|manufacturer|made by)[:\s]+([A-Za-z][A-Za-z0-9 \-]+)", text_lower)
    if brand_match:
        general_attrs.append({
            "key": "brand", "label": "Brand / Manufacturer",
            "raw_value": brand_match.group(1).strip(),
            "normalized_value": brand_match.group(1).strip(),
            "value": brand_match.group(1).strip(),
            "unit": "", "confidence": 0.9, "source": "Document Extraction",
            "page": 1, "evidence": brand_match.group(0), "evidence_quote": brand_match.group(0),
            "status": "verified", "reason": "Brand/manufacturer identified in document",
        })

    # Model number (common pattern)
    model_match = re.search(r"(?:model|part no|catalog no)[:\s#]+([A-Za-z0-9][A-Za-z0-9\-\/]+)", text_lower)
    if model_match:
        general_attrs.append({
            "key": "model_number", "label": "Model Number",
            "raw_value": model_match.group(1).strip(),
            "normalized_value": model_match.group(1).strip(),
            "value": model_match.group(1).strip(),
            "unit": "", "confidence": 0.9, "source": "Document Extraction",
            "page": 1, "evidence": model_match.group(0), "evidence_quote": model_match.group(0),
            "status": "verified", "reason": "Model number identified in document",
        })

    # Material
    mat_match = re.search(r"(?:material|construction)[:\s]+([A-Za-z][A-Za-z0-9 \-]+)", text_lower)
    if mat_match:
        general_attrs.append({
            "key": "material", "label": "Material",
            "raw_value": mat_match.group(1).strip(),
            "normalized_value": mat_match.group(1).strip(),
            "value": mat_match.group(1).strip(),
            "unit": "", "confidence": 0.85, "source": "Document Extraction",
            "page": 1, "evidence": mat_match.group(0), "evidence_quote": mat_match.group(0),
            "status": "verified", "reason": "Material identified in document",
        })

    # Extract all candidate values with their positions for context-aware processing
    # Rated Power: patterns like "15 kW", "200 HP", "Rated Power: 15kW"
    # Require digits before optional decimal — reject "55 W" from section numbers
    power_patterns = [
        r"rated\s*power[:\s]+(\d[\d\.\,]*\s*(?:kw|hp|w))",
        r"(\d[\d\.\,]*\s*(?:kw|hp|w))",
        r"power[:\s]+(\d[\d\.\,]*)",
    ]
    power_result = extract_attribute_with_context(input_text, "rated_power", power_patterns)

    # Supply Voltage: patterns like "415 V", "690V", "Supply Voltage: 415V"
    # Require digits before optional decimal — reject ". V"
    voltage_patterns = [
        r"supply\s*voltage[:\s]+(\d[\d\.]+)\s*v",
        r"(\d[\d\.]+\s*v)",
        r"voltage[:\s]+(\d[\d\.]+)",
    ]
    voltage_result = extract_attribute_with_context(input_text, "supply_voltage", voltage_patterns)

    # Rated Current: patterns like "38.05 A", "28.5A", "Rated Current: 38.05A"
    # Require digits before decimal — reject "8.1.2 A" (section numbers)
    current_patterns = [
        r"rated\s*current[:\s]+(\d[\d\.\,]*\s*a)",
        r"(\d[\d\.\,]*\s*a\b)",
        r"current[:\s]+(\d[\d\.\,]*)",
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
        r"rated\s*speed[:\s]+(\d[\d\.]+)\s*(?:rpm|1/min)",
        r"(\d{3,5}\s*rpm\b)",
        r"speed[:\s]+(\d{3,5}\s*rpm)",
    ]
    speed_result = extract_attribute_with_context(input_text, "rated_speed", speed_patterns)

    # Max Temperature: patterns like "155°C", "155 C", "155 degC", "155 deg. C"
    # Require 2-3 digits NOT followed by a dot (to avoid section numbers like 8.1)
    all_temps = [(m.group(1), m.start()) for m in re.finditer(r"(\b\d{2,3}\b)\s*(?:°|deg\.?\s*)?\s*c\b", text_lower)]
    temp_patterns = [r"(\b\d{2,3}\b)\s*(?:°|deg\.?\s*)?\s*c\b"]
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
    # Include general attributes detected for any product type, plus motor-specific attrs
    attributes = general_attrs + [power_result, voltage_result, current_result, efficiency_result, speed_result, temp_result, frame_result, weight_result]

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
        "llm_used": None,
        "product_name": input_text[:100],
        "attributes": attributes,
        "note": "WARNING: Rule-based extraction used (no LLM available). Results are limited to motor-specific attributes only. For non-motor products (abrasive discs, pumps, valves, etc.), configure GEMINI_API_KEY or OPENAI_API_KEY on the backend for proper product-specific analysis.",
        "applications": [],
        "industries": [],
        "tags": [],
    }