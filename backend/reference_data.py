"""Reference data seeding for the validation engine.

Loads approved Lists of Values (LOV), Unit of Measure (UOM) standards, and
manufacturer/brand canonical mappings so that the deterministic validation
engine has real reference data to validate against.

This is a practical, code-based reference set for the industrial-motor
category. It is intentionally conservative: values not listed here are
flagged for human review rather than guessed at.
"""

from __future__ import annotations

from backend.lov_validation import load_attribute_lov
from backend.uom_validation import load_uom_standards
from backend.manufacturer_resolution import load_manufacturer_canonical

# ---------------------------------------------------------------------------
# Approved UOM standards
# ---------------------------------------------------------------------------

UOM_STANDARDS: dict[str, list[str]] = {
    "power": ["kW", "W", "HP", "KW"],
    "voltage": ["V", "kV", "mV"],
    "current": ["A", "mA", "kA"],
    "speed": ["rpm", "RPM", "1/min", "rev/min"],
    "weight": ["kg", "g", "t", "lb"],
    "temperature": ["°C", "C", "degC", "K", "°F"],
    "frequency": ["Hz", "kHz"],
    "torque": ["N·m", "Nm", "N.m", "lbf·ft"],
    "length": ["mm", "cm", "m", "in", "ft"],
    "dimensionless": ["", "-"],
    "protection": ["IP"],
}

# ---------------------------------------------------------------------------
# Attribute LOV: approved attribute keys and their approved values
# ---------------------------------------------------------------------------

ATTRIBUTE_LOV: dict[str, dict[str, str]] = {
    "rated_power": {
        "0.18": "0.18 kW",
        "0.25": "0.25 kW",
        "0.37": "0.37 kW",
        "0.55": "0.55 kW",
        "0.75": "0.75 kW",
        "1.1": "1.1 kW",
        "1.5": "1.5 kW",
        "2.2": "2.2 kW",
        "3": "3 kW",
        "4": "4 kW",
        "5.5": "5.5 kW",
        "7.5": "7.5 kW",
        "11": "11 kW",
        "15": "15 kW",
        "18.5": "18.5 kW",
        "22": "22 kW",
        "30": "30 kW",
        "37": "37 kW",
        "45": "45 kW",
        "55": "55 kW",
        "75": "75 kW",
        "90": "90 kW",
        "110": "110 kW",
        "132": "132 kW",
        "160": "160 kW",
        "200": "200 kW",
    },
    "supply_voltage": {
        "230": "230 V",
        "400": "400 V",
        "415": "415 V",
        "460": "460 V",
        "480": "480 V",
        "525": "525 V",
        "690": "690 V",
        "1000": "1000 V",
    },
    "rated_current": {},
    "efficiency_class": {
        "IE1": "IE1 Standard Efficiency",
        "IE2": "IE2 High Efficiency",
        "IE3": "IE3 Premium Efficiency",
        "IE4": "IE4 Super Premium Efficiency",
        "IE3 PREMIUM": "IE3 Premium Efficiency",
        "IE4 SUPER PREMIUM": "IE4 Super Premium Efficiency",
    },
    "rated_speed": {},
    "max_temperature": {},
    "frame_size": {
        "56": "Frame 56",
        "63": "Frame 63",
        "71": "Frame 71",
        "80": "Frame 80",
        "90S": "Frame 90S",
        "90L": "Frame 90L",
        "100L": "Frame 100L",
        "112M": "Frame 112M",
        "132S": "Frame 132S",
        "132M": "Frame 132M",
        "160M": "Frame 160M",
        "160L": "Frame 160L",
        "180M": "Frame 180M",
        "180L": "Frame 180L",
        "200L": "Frame 200L",
        "225S": "Frame 225S",
        "225M": "Frame 225M",
        "250M": "Frame 250M",
        "280S": "Frame 280S",
        "280M": "Frame 280M",
        "315S": "Frame 315S",
        "315M": "Frame 315M",
        "315L": "Frame 315L",
        "355M": "Frame 355M",
        "355L": "Frame 355L",
        "400M": "Frame 400M",
    },
    "total_weight": {},
    "product_category": {
        "ELECTRIC MOTORS": "Electric Motors",
        "ELECTRIC MOTORS & DRIVES": "Electric Motors & Drives",
        "INDUCTION MOTOR": "Induction Motor",
        "3-PHASE INDUCTION MOTOR": "3-Phase Induction Motor",
    },
}

# ---------------------------------------------------------------------------
# Manufacturer / brand canonical mapping
# ---------------------------------------------------------------------------

MANUFACTURER_CANONICAL: dict[str, str] = {
    "Siemens": "Siemens",
    "Siemens AG": "Siemens",
    "Siemens Industry": "Siemens",
    "Siemens Ltd": "Siemens",
    "ABB": "ABB",
    "ABB Motors": "ABB",
    "WEG": "WEG",
    "WEG Electric": "WEG",
    "WEG Motors": "WEG",
    "Crompton Greaves": "Crompton Greaves",
    "CG": "Crompton Greaves",
    "Bharat Bijlee": "Bharat Bijlee",
    "BBL": "Bharat Bijlee",
    "Marathon Electric": "Marathon Electric",
    "Toshiba": "Toshiba",
    "Toshiba Industrial": "Toshiba",
    "Baldor": "Baldor",
    "Baldor Electric": "Baldor",
    "Nidec": "Nidec",
    "TEC Electric": "TEC Electric",
    "Leroy-Somer": "Leroy-Somer",
    "Lenze": "Lenze",
    "SEW-Eurodrive": "SEW-Eurodrive",
    "SEW Eurodrive": "SEW-Eurodrive",
}

_loaded = False


def load_reference_data(force: bool = False) -> None:
    """Load UOM, LOV, and manufacturer reference data into the validation
    modules. Idempotent unless ``force`` is True."""
    global _loaded
    if _loaded and not force:
        return
    load_uom_standards(UOM_STANDARDS)
    load_attribute_lov(ATTRIBUTE_LOV)
    load_manufacturer_canonical(MANUFACTURER_CANONICAL)
    _loaded = True
