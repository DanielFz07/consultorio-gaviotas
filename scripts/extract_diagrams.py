#!/usr/bin/env python3
"""
extract_diagrams.py — Extrae los SVGs de Consultorio Las Gaviotas_Diagramas.html y los
convierte a PNG para embeber en los PDFs de la entrega.

Uso:
    python3 scripts/extract_diagrams.py

Genera:
    .cache/diagrams/
        d-01-diagrama-clases-plantuml-1.png
        d-02-casos-uso-plantuml-1.png
        ...
    .cache/diagram_index.json  (mapa id → png_path, title, doc)
"""

import re
import base64
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "Consultorio Las Gaviotas_Diagramas.html"
CACHE = ROOT / ".cache" / "diagrams"
INDEX = ROOT / ".cache" / "diagram_index.json"
CACHE.mkdir(parents=True, exist_ok=True)


def extract():
    if not HTML.exists():
        print(f"ERROR: {HTML} no existe", file=sys.stderr)
        sys.exit(1)
    html = HTML.read_text(encoding="utf-8")

    # Find all <img id="img-d-..." src="data:image/{svg+xml,png};base64,...">
    pat = re.compile(r'<img id="(img-d-[^"]+)" src="data:image/(?:svg\+xml|png);base64,([^"]+)"')
    matches = pat.findall(html)
    print(f"Encontrados {len(matches)} diagramas en el HTML")

    # Find title and doc info from the surrounding section
    # Look for: <div class="diagram" id="d-..."> ... <div class="diagram-title">TITLE</div>
    # ... <span class="diagram-type">TYPE</span>
    # Then walk up to <div class="section"><h2>DOC</h2>
    info = {}
    for img_full_id, _ in matches:
        d_id = img_full_id.replace("img-", "")
        # Find the diagram block
        block_pat = re.compile(
            r'<div class="diagram" id="' + re.escape(d_id) + r'">(.*?)(?=<div class="diagram"|</div>\s*</div>\s*</div>)',
            re.DOTALL,
        )
        m = block_pat.search(html)
        if not m:
            continue
        block = m.group(1)
        title_m = re.search(r'<div class="diagram-title">([^<]+)</div>', block)
        title = title_m.group(1).strip() if title_m else d_id
        info[d_id] = {"title": title}

    # Find doc for each diagram (walk up to <section><h2>DOC</h2>)
    # Look for the section containing each diagram
    section_pat = re.compile(
        r'<div class="section"><h2>([^<]+)</h2>(.*?)(?=<div class="section"|</main>)',
        re.DOTALL,
    )
    for sec_m in section_pat.finditer(html):
        doc = sec_m.group(1).strip()
        body = sec_m.group(2)
        for d_id in info:
            if d_id in body and "doc" not in info[d_id]:
                info[d_id]["doc"] = doc

    # Extract & convert SVGs
    for img_id, b64_data in matches:
        d_id = img_id.replace("img-", "")
        png_path = CACHE / f"{d_id}.png"
        if png_path.exists():
            print(f"  ✓ {d_id} (cached)")
            continue

        # Detect if SVG or PNG (we match both formats)
        # Need to check the original source — re-extract with format info
        full_pat = re.compile(
            r'<img id="' + re.escape(img_id) + r'" src="data:image/(svg\+xml|png);base64,([^"]+)"'
        )
        m = full_pat.search(html)
        if not m:
            print(f"  ✗ {d_id}: no se pudo ubicar la imagen")
            continue
        fmt, b64 = m.group(1), m.group(2)

        if fmt == "svg+xml":
            svg_bytes = base64.b64decode(b64)
            svg_path = CACHE / f"{d_id}.svg"
            svg_path.write_bytes(svg_bytes)
            r = subprocess.run(
                ["rsvg-convert", "-d", "150", "-p", "150", str(svg_path), "-o", str(png_path)],
                capture_output=True,
            )
            if r.returncode != 0:
                print(f"  ✗ {d_id}: {r.stderr.decode()}")
                continue
        else:
            # PNG already
            png_bytes = base64.b64decode(b64)
            png_path.write_bytes(png_bytes)

        print(f"  ✓ {d_id} ({png_path.stat().st_size // 1024} KB)")

    # Generate index
    index = {}
    for d_id, info_d in info.items():
        png_path = CACHE / f"{d_id}.png"
        if png_path.exists():
            index[d_id] = {
                "title": info_d.get("title", d_id),
                "doc": info_d.get("doc", ""),
                "png": str(png_path),
            }
    INDEX.write_text(json.dumps(index, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n✓ {len(index)} diagramas indexados en {INDEX}")


if __name__ == "__main__":
    extract()