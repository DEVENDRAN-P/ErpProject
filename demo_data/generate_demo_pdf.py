"""Generate the demo Siemens 1LE1001 motor datasheet PDF.

Pure-python minimal PDF writer (no external dependencies) so the demo works
on a clean install. Produces demo_data/Siemens_1LE1001_Datasheet.pdf.

Note: this is a DEMO/SAMPLE datasheet generated for the ProductPilot AI
hackathon demo — it is not a real Siemens document.
"""

import os

OUT = os.path.join(os.path.dirname(__file__), "Siemens_1LE1001_Datasheet.pdf")

LINES = [
    "Siemens 1LE1001-1DB43-4AA4 Three-Phase Induction Motor",
    "General-Purpose Low-Voltage Motor, IE3 Premium Efficiency",
    "",
    "Rated Output Power: 15 kW (20 HP)",
    "Supply Voltage: 415 V Delta / 690 V Star",
    "Frequency: 50 Hz",
    "Rated Current: 28.5 A at 415 V",
    "Efficiency Class: IE3 Premium (92.6% efficiency)",
    "Rated Speed: 1475 rpm",
    "Max Operating Temperature: 155 degC (Insulation Class F)",
    "IEC Frame Size: 160M Cast Iron",
    "Ingress Protection: IP55",
    "Cooling: IC411 Self-Ventilated",
    "Mounting: IM B3 (Foot Mounted)",
    "Duty: S1 Continuous",
]


def pdf_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def build_pdf(lines: list[str]) -> bytes:
    content = "\n".join(lines)
    stream = f"BT /F1 11 Tf 56 740 Td 14 TL ({pdf_escape(lines[0])}) Tj T* ({pdf_escape(lines[1])}) Tj T* T* "
    for line in lines[2:]:
        stream += f"({pdf_escape(line)}) Tj T* "
    stream += "ET"

    objects = {
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        2: b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        3: b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        4: b"<< /Length " + str(len(stream.encode("latin-1"))).encode() + b" >>\nstream\n" + stream.encode("latin-1") + b"\nendstream",
        5: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    }

    out = bytearray(b"%PDF-1.4\n")
    offsets = {}
    for num in sorted(objects):
        offsets[num] = len(out)
        out += f"{num} 0 obj\n".encode()
        out += objects[num] + b"\nendobj\n"

    xref_pos = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for num in sorted(objects):
        out += f"{offsets[num]:010d} 00000 n \n".encode()

    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_pos}\n%%EOF\n"
    ).encode()
    return bytes(out)


if __name__ == "__main__":
    data = build_pdf(LINES)
    with open(OUT, "wb") as f:
        f.write(data)
    print(f"Wrote {OUT} ({len(data)} bytes)")
