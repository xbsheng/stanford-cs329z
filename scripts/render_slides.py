#!/usr/bin/env python3
"""Render selected slides of one lecture to WebP for the VitePress notes.

Usage:
    python3 scripts/render_slides.py 07 2 3 5 9

lecture-01 ... lecture-10 correspond to the ten lectures with published slides.
"""
import io
import sys
from pathlib import Path

import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SCALE = 2.0
WEBP_QUALITY = 84


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    code = sys.argv[1].zfill(2)
    pages = [int(x) for x in sys.argv[2:]]
    pdf_path = ROOT / "slides" / f"lecture{code}.pdf"
    if not pdf_path.exists():
        raise SystemExit(f"missing slides: {pdf_path}")
    out_dir = ROOT / "docs" / "public" / "images" / f"lecture-{code}"
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(pdf_path)
    for n in pages:
        if not 1 <= n <= len(doc):
            print(f"skip p{n}: out of range (1..{len(doc)})")
            continue
        path = out_dir / f"p{n:02d}.webp"
        pix = doc[n - 1].get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE), alpha=False)
        im = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        im.save(path, "WEBP", quality=WEBP_QUALITY, method=6)
        print(f"{path.relative_to(ROOT)} {im.width}x{im.height} {path.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
