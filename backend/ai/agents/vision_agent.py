import io
from typing import Any, Dict

try:
    from PIL import Image
except ImportError:
    Image = None

try:
    import pytesseract
except ImportError:
    pytesseract = None


def analyze_image(content: bytes, filename: str) -> Dict[str, Any]:
    """Analyze a product image (nameplate / label) via OCR when available.

    Reports OCR status honestly: 'success' only when real text was extracted,
    'unavailable' when the OCR engine is not installed, and 'error' when OCR
    failed on a valid image. Never fabricates extracted text.
    """
    extracted_text = ""
    ocr_status = "unavailable"
    width = 0
    height = 0
    format_type = ""

    if Image:
        try:
            img = Image.open(io.BytesIO(content))
            width, height = img.size
            format_type = img.format or ""

            if pytesseract:
                try:
                    extracted_text = pytesseract.image_to_string(img).strip()
                    ocr_status = "success" if extracted_text else "error"
                except Exception as ocr_err:
                    ocr_status = "error"
                    extracted_text = f"[OCR failed: {str(ocr_err)}]"
            else:
                ocr_status = "unavailable"
                extracted_text = "[OCR engine (pytesseract) not installed — no text extracted from image]"
        except Exception as e:
            ocr_status = "error"
            extracted_text = f"[Image loading error: {str(e)}]"
    else:
        ocr_status = "unavailable"
        extracted_text = "[Image processing library (PIL) not installed — image could not be read]"

    return {
        "type": "vision",
        "filename": filename,
        "width": width,
        "height": height,
        "format": format_type,
        "description": extracted_text,
        "text": extracted_text,
        "status": "success" if ocr_status == "success" else "error",
        "ocr_status": ocr_status,
        "text_extracted": ocr_status == "success",
    }
