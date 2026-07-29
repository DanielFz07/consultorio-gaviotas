#!/usr/bin/env python3
"""
render_all_diagrams.py — Renderiza todos los diagramas PlantUML y Mermaid
desde los archivos .md, generando PNGs escalados a A4.

- PlantUML: java -jar .tools/plantuml.jar
- Mermaid:   mmdc (Mermaid CLI)
- Imágenes >14cm ancho o >20cm alto se reescalan (preservando aspect ratio)
- Imágenes con proporción muy alta reciben una nota visual

Output:
    .cache/rendered/<doc-stem>/diagram-NN.png
    .cache/rendered_index.json
"""

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / ".tools" / "plantuml.jar"
CACHE = ROOT / ".cache" / "rendered"
MAPPING_OUT = ROOT / ".cache" / "rendered_index.json"
CACHE.mkdir(parents=True, exist_ok=True)

# A4 page inner: 16cm x 22cm (with 2cm side margins, 2.5cm top/bottom)
# Render at 200dpi for sharp text
RENDER_DPI = 200
MAX_WIDTH_PX = int(16 / 2.54 * RENDER_DPI)   # ~1260px
MAX_HEIGHT_PX = int(22 / 2.54 * RENDER_DPI)  # ~1732px

DOCS = [
    "docs/fase-inicio/05-modelo-dominio.md",
    "docs/fase-elaboracion/01-diagrama-clases.md",
    "docs/fase-elaboracion/02-casos-uso.md",
    "docs/fase-elaboracion/02b-casos-uso-expandidos.md",
    "docs/fase-elaboracion/03-er-diagrama.md",
    "docs/fase-elaboracion/04-flujo-dia-completo.md",
    "docs/fase-elaboracion/05-estados.md",
    "docs/fase-elaboracion/06-arquitectura-despliegue.md",
    "docs/fase-elaboracion/07-realizacion-casos-uso.md",
    "docs/fase-elaboracion/09-diagrama-capas.md",
    "docs/fase-inicio/02-prototipo-ui-pantallas.md",
]


def render_plantuml(code: str, out_stem: Path) -> tuple[Path | None, Path | None]:
    """Render PlantUML code to SVG + PNG.

    Returns (svg_path, png_path). Neither is guaranteed to exist
    (caller must check)."""
    out_stem = out_stem.resolve()
    out_stem.parent.mkdir(parents=True, exist_ok=True)
    svg_path = out_stem.with_suffix(".svg")
    png_path = out_stem.with_suffix(".png")

    if svg_path.exists() and svg_path.stat().st_size > 500:
        return svg_path, png_path  # cached

    # Add cream background to match page color (#F5F1E8)
    if "skinparam backgroundColor" not in code:
        code = code.replace("@startuml", "@startuml\nskinparam backgroundColor #F5F1E8", 1)
    with tempfile.NamedTemporaryFile(mode="w", suffix=".puml", delete=False, dir="/tmp") as f:
        f.write(code)
        puml_path = Path(f.name)
    tmp_svg = puml_path.with_suffix(".svg")
    try:
        # Step 1: PlantUML generates SVG (vector)
        r = subprocess.run(
            ["java", "-jar", str(TOOLS), "-tsvg", "-charset", "UTF-8",
             "-o", "/tmp", str(puml_path)],
            capture_output=True, timeout=60,
        )
        if r.returncode not in (0, 200):
            if r.stderr:
                print(f"    plantuml stderr: {r.stderr.decode()[:300]}")
            return None, None
        if not tmp_svg.exists():
            print(f"    plantuml: no SVG produced")
            return None, None

        # Step 2: Clean SVG default black background
        svg_text = tmp_svg.read_text(encoding="utf-8")
        svg_text = re.sub(r'background:#000000;', '', svg_text)
        tmp_svg.write_text(svg_text, encoding="utf-8")

        # Step 3: Copy SVG to cache
        svg_text = tmp_svg.read_text(encoding="utf-8")
        # Remove width/height so CSS max-height scales correctly
        svg_text = re.sub(r'\s*width="[^"]*"', '', svg_text, count=1)
        svg_text = re.sub(r'\s*height="[^"]*"', '', svg_text, count=1)
        svg_path.write_text(svg_text, encoding="utf-8")

        # Step 4: Generate PNG via rsvg-convert (fallback)
        r = subprocess.run(
            ["rsvg-convert", "-f", "png", "-w", "1200", str(tmp_svg), "-o", str(png_path)],
            capture_output=True, timeout=30,
        )
        if not png_path.exists():
            png_path = None

        return svg_path, png_path
    except subprocess.TimeoutExpired:
        print("    plantuml timeout")
        return None, None
    finally:
        puml_path.unlink(missing_ok=True)
        tmp_svg.unlink(missing_ok=True)


def render_mermaid(code: str, out_stem: Path) -> tuple[Path | None, Path | None]:
    """Render Mermaid code to SVG + PNG.

    Returns (svg_path, png_path)."""
    out_stem = out_stem.resolve()
    out_stem.parent.mkdir(parents=True, exist_ok=True)
    svg_path = out_stem.with_suffix(".svg")
    png_path = out_stem.with_suffix(".png")

    if svg_path.exists() and svg_path.stat().st_size > 500:
        return svg_path, png_path  # cached

    with tempfile.NamedTemporaryFile(mode="w", suffix=".mmd", delete=False, dir="/tmp") as f:
        f.write(code)
        mmd_path = Path(f.name)
    try:
        # mmdc: output SVG by default
        r = subprocess.run(
            ["mmdc", "-i", str(mmd_path), "-o", str(svg_path),
             "-b", "transparent", "-s", "3"],
            capture_output=True, timeout=60,
        )
        if not svg_path.exists():
            return None, None

        # Also generate PNG (fallback)
        subprocess.run(
            ["mmdc", "-i", str(mmd_path), "-o", str(png_path),
             "-b", "transparent", "-w", "1200", "-s", "3"],
            capture_output=True, timeout=60,
        )
        if not png_path.exists():
            png_path = None

        return svg_path, png_path
    except subprocess.TimeoutExpired:
        print("    mmdc timeout")
        return None, None
    finally:
        mmd_path.unlink(missing_ok=True)


def scale_to_fit(png_path: Path):
    """If image exceeds max dimensions, scale down (preserving aspect)."""
    with Image.open(png_path) as im:
        w, h = im.size
        if w <= MAX_WIDTH_PX and h <= MAX_HEIGHT_PX:
            return False  # no scaling needed
        ratio = min(MAX_WIDTH_PX / w, MAX_HEIGHT_PX / h)
        new_w = max(int(w * ratio), 100)
        new_h = max(int(h * ratio), 100)
        im_resized = im.resize((new_w, new_h), Image.LANCZOS)
        im_resized.save(png_path, optimize=True)
        return True


def extract_blocks(md_text: str):
    """Extract plantuml and mermaid blocks in order of appearance."""
    blocks = []
    pat = re.compile(r"```(plantuml|mermaid)\n(.*?)\n```", re.DOTALL)
    for m in pat.finditer(md_text):
        blocks.append((m.group(1), m.group(2).strip()))
    return blocks


def main():
    index = {}
    total_rendered = 0
    total_scaled = 0

    for doc_rel in DOCS:
        doc_path = ROOT / doc_rel
        if not doc_path.exists():
            print(f"⚠ {doc_rel} no existe")
            continue
        md = doc_path.read_text(encoding="utf-8")
        blocks = extract_blocks(md)
        if not blocks:
            continue
        print(f"\n{doc_rel}: {len(blocks)} diagramas")
        out_dir = CACHE / doc_path.stem
        out_dir.mkdir(parents=True, exist_ok=True)

        doc_index = []
        for i, (btype, code) in enumerate(blocks, 1):
            out_stem = out_dir / f"diagram-{i:02d}"
            # Skip if cached
            svg_file = out_stem.with_suffix(".svg")
            png_file = out_stem.with_suffix(".png")
            cached = svg_file.exists() and svg_file.stat().st_size > 500
            if cached:
                size = svg_file.stat().st_size // 1024
                print(f"  · #{i:2d} {btype:8s} (cached) {size} KB")
            else:
                print(f"  · #{i:2d} {btype:8s} rendering...", end="", flush=True)
                if btype == "mermaid":
                    svg_out, png_out = render_mermaid(code, out_stem)
                else:
                    svg_out, png_out = render_plantuml(code, out_stem)
                if svg_out and svg_out.exists():
                    size = svg_out.stat().st_size // 1024
                    print(f" {size} KB SVG")
                    total_rendered += 1
                else:
                    print(" FAILED")
                    continue
            doc_index.append({
                "index": i,
                "type": btype,
                "svg": str(svg_file) if svg_file.exists() else None,
                "png": str(png_file) if png_file.exists() else None,
            })
        index[doc_rel] = doc_index

    MAPPING_OUT.write_text(json.dumps(index, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n✓ {sum(len(v) for v in index.values())} diagramas en {MAPPING_OUT}")
    print(f"  {total_rendered} renderizados (PDF vectorial — escalan sin perder calidad)")


if __name__ == "__main__":
    main()