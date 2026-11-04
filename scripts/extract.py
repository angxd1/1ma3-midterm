"""Extract text from course materials into content/extracted/<name>.txt.

Each slide/page is written under a "=== SLIDE n ===" (or "=== PAGE n ===")
header so later stages can cite slide numbers. Speaker notes are kept,
marked with "[notes]".

Usage: python scripts/extract.py materials content/extracted
"""
import sys
from pathlib import Path

from pptx import Presentation
from pypdf import PdfReader


def shape_text(shape):
    out = []
    if shape.has_text_frame:
        for p in shape.text_frame.paragraphs:
            t = "".join(r.text for r in p.runs).strip()
            if t:
                out.append("  " * p.level + "- " + t)
    if getattr(shape, "has_table", False) and shape.has_table:
        for row in shape.table.rows:
            out.append(" | ".join(c.text.strip() for c in row.cells))
    if shape.shape_type == 6:  # group
        for s in shape.shapes:
            out.extend(shape_text(s))
    return out


def extract_pptx(path):
    prs = Presentation(path)
    chunks = []
    for i, slide in enumerate(prs.slides, 1):
        lines = []
        for shape in slide.shapes:
            lines.extend(shape_text(shape))
        if slide.has_notes_slide:
            notes = slide.notes_slide.notes_text_frame.text.strip()
            if notes:
                lines.append("[notes] " + notes.replace("\n", " "))
        chunks.append(f"=== SLIDE {i} ===\n" + "\n".join(lines))
    return "\n\n".join(chunks)


def extract_pdf(path):
    reader = PdfReader(path)
    return "\n\n".join(
        f"=== PAGE {i} ===\n{(p.extract_text() or '').strip()}"
        for i, p in enumerate(reader.pages, 1)
    )


def main(src, dst):
    dst = Path(dst)
    dst.mkdir(parents=True, exist_ok=True)
    for f in sorted(Path(src).iterdir()):
        if f.suffix.lower() == ".pptx":
            text = extract_pptx(f)
        elif f.suffix.lower() == ".pdf":
            text = extract_pdf(f)
        else:
            continue
        (dst / (f.stem + ".txt")).write_text(text)
        print(f"{f.name}: {len(text):,} chars")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
