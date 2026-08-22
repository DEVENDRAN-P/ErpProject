import csv
import io
import re
import urllib.request
from typing import Any, List, Dict

try:
    import pymupdf as fitz  # PyMuPDF
except ImportError:
    try:
        import fitz  # fallback for older versions
    except ImportError:
        fitz = None

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None


def parse_pdf(content: bytes, filename: str) -> Dict[str, Any]:
    pages: List[Dict[str, Any]] = []
    full_text_blocks: List[str] = []
    tables: List[Dict[str, Any]] = []

    if fitz:
        try:
            doc = fitz.open(stream=content, filetype="pdf")
            for page_num, page in enumerate(doc, start=1):
                text = page.get_text("text")
                if text.strip():
                    pages.append({
                        "page": page_num,
                        "text": text.strip(),
                    })
                    full_text_blocks.append(f"--- Page {page_num} ---\n{text.strip()}")

                # Table detection fallback
                tabs = page.find_tables()
                if tabs and tabs.tables:
                    for tab_idx, table in enumerate(tabs.tables):
                        extracted_table = table.extract()
                        tables.append({
                            "page": page_num,
                            "table_index": tab_idx + 1,
                            "headers": extracted_table[0] if extracted_table else [],
                            "rows": extracted_table[1:] if len(extracted_table) > 1 else [],
                        })
        except Exception as e:
            pass  # Continue to fallback

    if not full_text_blocks:
        # Fallback text extraction if fitz is unavailable or empty
        decoded_text = content.decode("utf-8", errors="ignore")
        full_text_blocks.append(decoded_text[:2000])

    combined_text = "\n\n".join(full_text_blocks)
    return {
        "type": "document",
        "format": "pdf",
        "filename": filename,
        "text": combined_text,
        "pages": pages,
        "tables": tables,
        "page_count": len(pages),
    }


def parse_url(url: str) -> Dict[str, Any]:
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NexGenAI/1.0"}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            html_content = response.read().decode("utf-8", errors="ignore")

        if BeautifulSoup:
            soup = BeautifulSoup(html_content, "html.parser")
            for script in soup(["script", "style", "nav", "footer", "header"]):
                script.decompose()
            text = soup.get_text(separator="\n")
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            clean_text = "\n".join(lines)
        else:
            clean_text = re.sub(r"<[^>]+>", " ", html_content)
            clean_text = " ".join(clean_text.split())

        return {
            "type": "url",
            "source": url,
            "text": clean_text[:5000],
            "status": "success",
        }
    except Exception as e:
        return {
            "type": "url",
            "source": url,
            "text": f"Failed to fetch content from {url}: {str(e)}",
            "status": "error",
            "error": str(e),
        }


def parse_csv_catalog(content: bytes, filename: str) -> Dict[str, Any]:
    decoded = content.decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(decoded))
    rows = list(reader)
    return {
        "type": "csv",
        "filename": filename,
        "row_count": len(rows),
        "columns": reader.fieldnames or [],
        "rows": rows[:50],  # cap preview
        "text": decoded[:4000],
    }


def parse_document(content: bytes, filename: str) -> Dict[str, Any]:
    ext = filename.lower().split(".")[-1] if "." in filename else ""
    if ext == "pdf":
        return parse_pdf(content, filename)
    elif ext == "csv":
        return parse_csv_catalog(content, filename)
    else:
        text = content.decode("utf-8", errors="ignore")
        return {
            "type": "document",
            "format": ext,
            "filename": filename,
            "text": text[:3000],
        }

