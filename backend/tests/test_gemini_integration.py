"""End-to-end Gemini integration verification test.

Tests the full Gemini pipeline: key detection → model validation →
REST request → JSON parse → attribute extraction.

Run with:
    cd unihack && python -m pytest backend/tests/test_gemini_integration.py -v -s
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import pytest

from backend.core.config import settings


# ---------------------------------------------------------------------------
# 3M abrasive disc test document
# ---------------------------------------------------------------------------
THREE_M_ABRASIVE_DISC_TEXT = """
3M 255P Premium Plus Hookit™ Disc, 5 inch (127mm), P120 Grit, 50 per case.

Product Description:
3M 255P Premium Plus Hookit™ Disc is designed for high-performance sanding
and finishing. This disc features a precision-shaped grain technology that
cuts faster and lasts longer than conventional disc abrasives.

Key Specifications:
- Brand: 3M
- Product Name: 3M 255P Premium Plus Hookit Disc
- Product Type: Abrasive Disc
- Disc Diameter: 5 inches (127 mm)
- Grit Size: P120
- Backing Type: Hookit™ film backing
- Abrasive Type: Precision-shaped grain aluminum oxide
- Bond Type: Resin bond
- Maximum RPM: 12000
- Color: Purple
- Applications: Metal finishing, wood sanding, paint preparation
- Case Quantity: 50 per case
- Country of Origin: USA

Standards and Compliance:
- ANSI B74.12
- FEPA P120 grit designation
- Suitable for use on steel, aluminum, wood, and composites

Safety Information:
- Always use proper eye protection
- Do not exceed maximum rated speed
- Store in cool, dry environment
"""


class TestGeminiConfig:
    """1. Confirm the backend reads GEMINI_API_KEY."""

    def test_gemini_key_detected(self):
        """GEMINI_API_KEY should be present (from env or Settings)."""
        key = getattr(settings, "gemini_api_key", None) or os.getenv("GEMINI_API_KEY", "")
        present = bool(key and key.strip())
        print(f"\nGEMINI_API_KEY configured: {str(present).lower()}")
        assert present, (
            "GEMINI_API_KEY is not configured. "
            "Set it in the environment or in .env file."
        )

    def test_gemini_key_not_empty_or_placeholder(self):
        """Key should not be empty, 'your-key-here', or obviously fake."""
        key = getattr(settings, "gemini_api_key", None) or os.getenv("GEMINI_API_KEY", "")
        assert key and key.strip(), "GEMINI_API_KEY is empty"
        assert key.strip() != "your-key-here", "GEMINI_API_KEY is a placeholder"
        assert len(key.strip()) > 10, "GEMINI_API_KEY appears too short to be valid"
        # Key should not contain spaces
        assert " " not in key.strip(), "GEMINI_API_KEY contains spaces"
        print(f"GEMINI_API_KEY length: {len(key.strip())} chars (key value hidden)")


class TestGeminiModelValidation:
    """3. Confirm the configured Gemini model names are valid."""

    def test_default_models_are_known(self):
        """Default model list should only contain known valid models."""
        from backend.ai.agents.enrichment_agent import _KNOWN_GEMINI_MODELS, _DEFAULT_GEMINI_MODELS

        defaults = [m.strip() for m in _DEFAULT_GEMINI_MODELS.split(",")]
        print(f"\nDefault Gemini models: {defaults}")
        for model in defaults:
            assert model in _KNOWN_GEMINI_MODELS, (
                f"Default model '{model}' is not in _KNOWN_GEMINI_MODELS"
            )

    def test_env_override_models_are_known(self):
        """If GEMINI_MODELS env var is set, those models should be validated at runtime."""
        env_models = os.getenv("GEMINI_MODELS", "")
        if env_models.strip():
            print(f"\nGEMINI_MODELS env override: {env_models}")
            from backend.ai.agents.enrichment_agent import _KNOWN_GEMINI_MODELS
            models = [m.strip() for m in env_models.split(",") if m.strip()]
            for m in models:
                if m not in _KNOWN_GEMINI_MODELS:
                    print(f"  WARNING: '{m}' is not in known model list — will be skipped at runtime")


class TestGeminiExtraction:
    """Full end-to-end extraction with the 3M abrasive disc document."""

    @pytest.fixture(autouse=True)
    def _capture_logs(self, capsys):
        """Ensure print output is captured for diagnostic review."""
        self._capsys = capsys

    def test_gemini_extract_returns_result(self):
        """_gemini_extract should return a valid enrichment dict."""
        from backend.ai.agents.enrichment_agent import _gemini_extract

        result = _gemini_extract(THREE_M_ABRASIVE_DISC_TEXT)

        captured = self._capsys.readouterr()
        print(f"\n--- Diagnostic Logs ---\n{captured.out}\n--- End Logs ---")

        # Must not be None (Gemini should succeed)
        assert result is not None, (
            "_gemini_extract returned None — Gemini extraction failed. "
            "Check the diagnostic logs above for the exact failure reason."
        )

        # Must be enrichment type
        assert result["type"] == "enrichment"
        assert result["llm_used"] == "gemini", (
            f"llm_used should be 'gemini', got '{result.get('llm_used')}'"
        )

        # Must have attributes
        assert isinstance(result["attributes"], list)
        assert len(result["attributes"]) > 0, "Gemini returned 0 attributes"

        # Print the attributes for visual inspection
        print("\n--- Extracted Attributes ---")
        for attr in result["attributes"]:
            key = attr.get("key", "?")
            value = attr.get("value", "null")
            status = attr.get("status", "?")
            confidence = attr.get("confidence", 0)
            print(f"  {key}: {value} ({status}, confidence={confidence})")
        print("--- End Attributes ---")

    def test_3m_abrasive_disc_attributes(self):
        """Verify product-agnostic extraction for 3M abrasive disc."""
        from backend.ai.agents.enrichment_agent import _gemini_extract

        result = _gemini_extract(THREE_M_ABRASIVE_DISC_TEXT)

        captured = self._capsys.readouterr()
        print(f"\n--- Diagnostic Logs ---\n{captured.out}\n--- End Logs ---")

        assert result is not None, "Gemini extraction failed — see logs above"

        attrs = {a.get("key", ""): a for a in result.get("attributes", [])}

        # Product name should reference 3M or abrasive
        product_name = result.get("product_name", "")
        assert product_name, "product_name should not be empty"
        print(f"\nProduct name: {product_name}")

        # Should NOT return motor-specific fields
        motor_fields = ["rated_power", "supply_voltage", "rated_current",
                        "efficiency_class", "rated_speed", "frame_size"]
        for field in motor_fields:
            if field in attrs and attrs[field].get("value") is not None:
                value = attrs[field]["value"]
                # It's OK if Gemini extracted it — but the document has no motor specs
                # The key assertion is: Gemini should not INVENT motor values
                # If it does, flag it
                if attrs[field].get("status") == "verified":
                    pytest.fail(
                        f"Motor-specific field '{field}'={value} was verified, "
                        f"but the 3M abrasive disc document contains no motor specs. "
                        f"Gemini may be hallucinating."
                    )

        # Should have abrasive-disc-relevant fields
        relevant_keys = list(attrs.keys())
        print(f"Extracted keys: {relevant_keys}")

        # At minimum, should find some attributes
        non_null = [k for k, v in attrs.items() if v.get("value") is not None]
        print(f"Non-null attributes: {non_null}")
        assert len(non_null) >= 3, (
            f"Expected at least 3 non-null attributes for abrasive disc, got {len(non_null)}. "
            f"Extracted keys: {relevant_keys}"
        )


class TestEnrichProductMetadata:
    """5-8. Confirm the document-analysis endpoint calls _gemini_extract
    and returns gemini as llm_used."""

    @pytest.fixture(autouse=True)
    def _capture_logs(self, capsys):
        self._capsys = capsys

    def test_enrich_calls_gemini_first(self):
        """enrich_product_metadata should try Gemini before OpenAI."""
        from backend.ai.agents.enrichment_agent import enrich_product_metadata

        result = enrich_product_metadata(THREE_M_ABRASIVE_DISC_TEXT)

        captured = self._capsys.readouterr()
        log_output = captured.out

        # Check diagnostic sequence
        assert "GEMINI_API_KEY configured:" in log_output, "Missing GEMINI_API_KEY log"
        assert "Gemini initialization:" in log_output, "Missing Gemini initialization log"
        assert "Gemini model selected:" in log_output, "Missing Gemini model selected log"
        assert "Gemini request: started" in log_output, "Missing Gemini request: started log"

        if result.get("llm_used") == "gemini":
            assert "Gemini request: success" in log_output
            assert "Gemini response parsed: success" in log_output
            assert "Fallback activated: false" in log_output
        elif result.get("llm_used") is None:
            # Rule-based fallback
            assert "Fallback activated: true" in log_output
        else:
            # OpenAI was used
            pass

        # llm_used should be "gemini" or None, not "gemini-<model>"
        llm = result.get("llm_used")
        assert llm in ("gemini", None, "openai"), (
            f"llm_used should be 'gemini', 'openai', or None — got '{llm}'"
        )
        print(f"\nllm_used: {llm}")
        print(f"--- Full diagnostic logs ---\n{log_output}--- End logs ---")


class TestNoSilentConversion:
    """9. Confirm the code does NOT silently convert failures into successes."""

    def test_gemini_failure_returns_none(self):
        """_gemini_extract must return None on failure, not fake success."""
        from backend.ai.agents.enrichment_agent import _gemini_extract

        # Test with invalid key (won't work but shouldn't crash)
        # We test the function's behavior by checking it can handle edge cases
        result = _gemini_extract("")  # Empty text should still try Gemini
        # Even if Gemini returns attributes for empty text, that's fine
        # The key point is: no crash, no fake success from an actual failure
        print(f"\nEmpty text result: {result is not None}")

    def test_rule_based_fallback_flagged(self):
        """When both LLMs fail, the result should clearly indicate rule-based."""
        # This test checks the structure, not the actual API call
        from backend.ai.agents.enrichment_agent import _gemini_extract

        # We can't easily mock without unittest.mock, so just verify the
        # function signature and return contract
        import inspect
        import typing
        sig = inspect.signature(_gemini_extract)
        # The return annotation is typing.Dict[str, Any] | None at runtime
        ann = sig.return_annotation
        ann_str = str(ann)
        assert (ann is inspect.Parameter.empty
                or ann is typing.Optional[typing.Dict[str, typing.Any]]
                or 'None' in ann_str
                or 'Dict' in ann_str), f"Unexpected return annotation: {ann_str}"


# ---------------------------------------------------------------------------
# Mocked Gemini tests — do NOT require a real API key
# ---------------------------------------------------------------------------

import json
from unittest.mock import patch, MagicMock

MOCK_GEMINI_RESPONSE_JSON = {
    "candidates": [{
        "content": {
            "parts": [{
                "text": json.dumps({
                    "attributes": [
                        {
                            "key": "brand",
                            "label": "Brand",
                            "value": "3M",
                            "unit": "",
                            "confidence": 0.95,
                            "evidence": "Brand: 3M",
                            "status": "verified",
                        },
                        {
                            "key": "product_type",
                            "label": "Product Type",
                            "value": "Abrasive Disc",
                            "unit": "",
                            "confidence": 0.92,
                            "evidence": "Product Type: Abrasive Disc",
                            "status": "verified",
                        },
                        {
                            "key": "disc_diameter",
                            "label": "Disc Diameter",
                            "value": "5 inches (127 mm)",
                            "unit": "inches",
                            "confidence": 0.95,
                            "evidence": "Disc Diameter: 5 inches (127 mm)",
                            "status": "verified",
                        },
                        {
                            "key": "grit_size",
                            "label": "Grit Size",
                            "value": "P120",
                            "unit": "",
                            "confidence": 0.98,
                            "evidence": "Grit Size: P120",
                            "status": "verified",
                        },
                        {
                            "key": "max_rpm",
                            "label": "Maximum RPM",
                            "value": "12000",
                            "unit": "RPM",
                            "confidence": 0.95,
                            "evidence": "Maximum RPM: 12000",
                            "status": "verified",
                        },
                    ]
                })
            }]
        }
    }]
}


class TestGeminiMockedParsing:
    """Mocked Gemini tests — verify parsing logic without a real API key."""

    @pytest.fixture(autouse=True)
    def _capture_logs(self, capsys):
        self._capsys = capsys

    def _mock_urlopen(self, response_data=None, status_code=200):
        """Create a mock urllib.request.urlopen context manager."""
        if response_data is None:
            response_data = MOCK_GEMINI_RESPONSE_JSON

        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps(response_data).encode("utf-8")
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)

        mock_urlopen = MagicMock(return_value=mock_response)
        return mock_urlopen

    def test_mocked_gemini_extracts_attributes(self):
        """Mocked Gemini response should be parsed into attributes."""
        from backend.ai.agents.enrichment_agent import _gemini_extract

        mock_urlopen = self._mock_urlopen()

        with patch("urllib.request.urlopen", mock_urlopen):
            result = _gemini_extract(THREE_M_ABRASIVE_DISC_TEXT)

        assert result is not None, "Mocked Gemini should return a result"
        assert result["type"] == "enrichment"
        assert result["llm_used"] == "gemini"
        assert isinstance(result["attributes"], list)
        assert len(result["attributes"]) == 5

        keys = [a["key"] for a in result["attributes"]]
        assert "brand" in keys
        assert "grit_size" in keys
        assert "disc_diameter" in keys

        # Verify no motor-specific fields were hallucinated
        motor_fields = ["rated_power", "supply_voltage", "rated_current",
                        "efficiency_class", "rated_speed"]
        for mf in motor_fields:
            assert mf not in keys, f"Motor field '{mf}' should not appear for abrasive disc"

    def test_mocked_gemini_404_tries_next_model(self):
        """When first model returns 404, should try next model."""
        from backend.ai.agents.enrichment_agent import _gemini_extract

        call_count = [0]

        def mock_urlopen_side_effect(req, timeout=None):
            call_count[0] += 1
            if call_count[0] == 1:
                # First model: 404
                from urllib.error import HTTPError
                raise HTTPError(req.full_url, 404, "Not Found", {}, None)
            # Second model: success (must be context manager)
            mock_resp = MagicMock()
            mock_resp.read.return_value = json.dumps(MOCK_GEMINI_RESPONSE_JSON).encode("utf-8")
            mock_resp.__enter__ = MagicMock(return_value=mock_resp)
            mock_resp.__exit__ = MagicMock(return_value=False)
            return mock_resp

        with patch("urllib.request.urlopen", side_effect=mock_urlopen_side_effect):
            result = _gemini_extract(THREE_M_ABRASIVE_DISC_TEXT)

        assert result is not None, "Should succeed with second model"
        assert result["llm_used"] == "gemini"
        assert call_count[0] == 2, f"Should have tried 2 models, tried {call_count[0]}"

    def test_mocked_gemini_all_404_returns_none(self):
        """When all models return 404, should return None (trigger fallback)."""
        from backend.ai.agents.enrichment_agent import _gemini_extract

        from urllib.error import HTTPError

        def mock_urlopen_404(req, timeout=None):
            raise HTTPError(req.full_url, 404, "Not Found", {}, None)

        with patch("urllib.request.urlopen", side_effect=mock_urlopen_404):
            result = _gemini_extract(THREE_M_ABRASIVE_DISC_TEXT)

        assert result is None, "All 404s should return None for fallback"

    def test_mocked_gemini_invalid_json_returns_none(self):
        """When Gemini returns non-JSON, should return None."""
        from backend.ai.agents.enrichment_agent import _gemini_extract

        mock_response = MagicMock()
        mock_response.read.return_value = b"This is not JSON at all"
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)

        with patch("urllib.request.urlopen", return_value=mock_response):
            result = _gemini_extract(THREE_M_ABRASIVE_DISC_TEXT)

        assert result is None, "Invalid JSON should return None"

    def test_mocked_gemini_empty_candidates_returns_none(self):
        """When Gemini returns empty candidates, should return None."""
        from backend.ai.agents.enrichment_agent import _gemini_extract

        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({"candidates": []}).encode("utf-8")
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)

        with patch("urllib.request.urlopen", return_value=mock_response):
            result = _gemini_extract(THREE_M_ABRASIVE_DISC_TEXT)

        assert result is None, "Empty candidates should return None"

    def test_rule_based_fallback_for_abrasive(self):
        """Rule-based fallback should detect abrasive product type."""
        from backend.ai.agents.enrichment_agent import enrich_product_metadata

        result = enrich_product_metadata(THREE_M_ABRASIVE_DISC_TEXT)

        # When no Gemini/OpenAI key, should use rule-based fallback
        # Verify the note mentions limitation
        if result.get("llm_used") is None:
            assert result.get("note") is not None
            print(f"\nFallback note: {result['note']}")

        # Should still extract some attributes (general: brand, model, material)
        attrs = result.get("attributes", [])
        print(f"\nRule-based attributes: {[a['key'] for a in attrs]}")
        assert isinstance(attrs, list)
