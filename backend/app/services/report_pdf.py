"""Minimal dependency-free PDF report builder (PDF 1.4, Helvetica).

Keeps government exports working without adding report libraries.
Only Latin-1-safe text is emitted (e.g. Rs. instead of the rupee sign).
"""
from __future__ import annotations


def _sanitise(text: object) -> str:
    value = "" if text is None else str(text)
    value = value.replace("₹", "Rs. ").replace("–", "-").replace("—", "-")
    out: list[str] = []
    for char in value:
        if char in ("(", ")", "\\"):
            out.append("\\" + char)
        elif 32 <= ord(char) <= 126 or char in ("\n", "\t"):
            out.append(char)
        else:
            out.append("?")
    return "".join(out)


def build_report_pdf(
    *,
    title: str,
    filters: list[str],
    generated_at: str,
    summary_rows: list[tuple[str, str]],
    district_rows: list[list[str]],
    extra_sections: list[tuple[str, list[str]]] | None = None,
) -> bytes:
    lines: list[tuple[str, int, int]] = []  # (text, size, y-step)
    lines.append((title, 18, 26))
    lines.append((f"Generated: {generated_at}", 10, 16))
    for item in filters:
        lines.append((item, 10, 14))
    lines.append(("Summary metrics", 14, 22))
    for key, value in summary_rows:
        lines.append((f"{key}: {value}", 10, 14))
    lines.append(("District outcomes", 14, 22))
    header = ["District", "Trained", "Placed", "Emp %", "6M ret %", "Self-emp %", "Median wage", "Risk"]
    lines.append((" | ".join(header), 9, 14))
    for row in district_rows:
        lines.append((" | ".join(row), 9, 13))
    for section_title, section_lines in extra_sections or []:
        lines.append((section_title, 14, 22))
        for item in section_lines:
            lines.append((item, 9, 13))

    # Paginate: A4 height 842pt, margins 50pt.
    pages: list[list[tuple[str, int]]] = [[]]
    cursor = 770
    for text, size, step in lines:
        if cursor - step < 60:
            pages.append([])
            cursor = 770
        pages[-1].append((text, size))
        cursor -= step

    objects: list[bytes] = []
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(
        f"<< /Type /Pages /Kids [{' '.join(f'{3 + i} 0 R' for i in range(len(pages)))}] "
        f"/Count {len(pages)} >>".encode("ascii")
    )
    font_obj = len(pages) + 3
    for page_lines in pages:
        content: list[str] = ["BT"]
        y = 792
        for text, size in page_lines:
            step = size + 6
            y -= step
            content.append(f"/F1 {size} Tf 50 {y:.0f} Td ({_sanitise(text)}) Tj")
        content.append("ET")
        stream = "\n".join(content).encode("ascii")
        page_index = len(objects) + 1  # 1-based object number for this page
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
            f"/Resources << /Font << /F1 {font_obj} 0 R >> >> "
            f"/Contents {page_index + 1} 0 R >>".encode("ascii")
        )
        objects.append(
            b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream"
        )
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode("ascii") + body + b"\nendobj\n"
    xref_at = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode("ascii")
    out += b"0000000000 65535 f \n"
    for offset in offsets[1:]:
        out += f"{offset:010d} 00000 n \n".encode("ascii")
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_at}\n%%EOF".encode("ascii")
    )
    return bytes(out)
