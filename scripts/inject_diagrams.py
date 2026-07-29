#!/usr/bin/env python3
"""
inject_diagrams.py — Inyecta imágenes PNG de los diagramas UML en los
documentos markdown antes de generar los PDFs.

Para cada bloque plantuml/mermaid en orden secuencial, lo reemplaza con
la imagen correspondiente del cache.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / ".cache" / "diagram_index.json"

# (markdown file, ordered list of diagram IDs in document order)
MAPPING = {
    "docs/fase-inicio/05-modelo-dominio.md": [
        "d-05-modelo-dominio-mermaid-1",
        "d-05-modelo-dominio-mermaid-2",
    ],
    "docs/fase-inicio/02-prototipo-ui-pantallas.md": [
        "d-02-prototipo-ui-pantallas-plantuml-1",
    ],
    "docs/fase-elaboracion/01-diagrama-clases.md": [
        "d-01-diagrama-clases-plantuml-1",
    ],
    "docs/fase-elaboracion/02-casos-uso.md": [
        "d-02-casos-uso-plantuml-1",
        "d-02-casos-uso-plantuml-2",
        "d-02-casos-uso-plantuml-3",
    ],
    "docs/fase-elaboracion/02b-casos-uso-expandidos.md": [
        "d-02b-casos-uso-expandidos-plantuml-1",
        "d-02b-casos-uso-expandidos-plantuml-2",
        "d-02b-casos-uso-expandidos-plantuml-3",
    ],
    "docs/fase-elaboracion/03-er-diagrama.md": [
        "d-03-er-diagrama-plantuml-1",
    ],
    "docs/fase-elaboracion/04-flujo-dia-completo.md": [
        "d-04-flujo-dia-completo-plantuml-1",
        "d-04-flujo-dia-completo-plantuml-2",
    ],
    "docs/fase-elaboracion/05-estados.md": [
        "d-05-estados-plantuml-1",
        "d-05-estados-plantuml-2",
        "d-05-estados-plantuml-3",
        "d-05-estados-plantuml-4",
        "d-05-estados-plantuml-5",
    ],
    "docs/fase-elaboracion/06-arquitectura-despliegue.md": [
        "d-06-arquitectura-despliegue-plantuml-1",
        "d-06-arquitectura-despliegue-plantuml-2",
    ],
    "docs/fase-elaboracion/07-realizacion-casos-uso.md": [
        "d-07-realizacion-casos-uso-plantuml-1",
        "d-07-realizacion-casos-uso-plantuml-2",
        "d-07-realizacion-casos-uso-plantuml-3",
        "d-07-realizacion-casos-uso-plantuml-4",
        "d-07-realizacion-casos-uso-plantuml-5",
        "d-07-realizacion-casos-uso-plantuml-6",
        "d-07-realizacion-casos-uso-plantuml-7",
        "d-07-realizacion-casos-uso-plantuml-8",
        "d-07-realizacion-casos-uso-plantuml-9",
        "d-07-realizacion-casos-uso-plantuml-10",
    ],
    "docs/fase-elaboracion/09-diagrama-capas.md": [
        "d-09-diagrama-capas-mermaid-1",
        "d-09-diagrama-capas-mermaid-2",
    ],
}


def inject(doc_path: str, diagram_ids: list[str]) -> str:
    """Return the markdown content with diagram blocks replaced by image refs."""
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    full_path = ROOT / doc_path
    if not full_path.exists():
        print(f"  ⚠ no existe: {doc_path}")
        return ""
    md = full_path.read_text(encoding="utf-8")

    counter = [0]

    def repl(match):
        if counter[0] >= len(diagram_ids):
            return match.group(0)
        d_id = diagram_ids[counter[0]]
        info = index.get(d_id)
        if not info:
            counter[0] += 1
            return match.group(0)

        # Prefer SVG (vector, selectable text) over PNG (raster)
        svg_path = info.get("svg")
        png_path = info.get("png")

        png_path_obj = Path(png_path) if png_path else None
        svg_path_obj = Path(svg_path) if svg_path else None

        if svg_path_obj and svg_path_obj.exists():
            src_path = svg_path_obj
            mime = "image/svg+xml"
        elif png_path_obj and png_path_obj.exists():
            src_path = png_path_obj
            mime = "image/png"
        else:
            counter[0] += 1
            return match.group(0)

        counter[0] += 1
        import base64
        try:
            with open(src_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("ascii")
        except Exception:
            return match.group(0)
        data_uri = f"data:{mime};base64,{b64}"
        img_md = (
            f"\n\n"
            f"<div style=\"text-align:center; margin: 1em 0; page-break-inside: avoid;\">\n"
            f"<img src=\"{data_uri}\" alt=\"{info['title']}\" style=\"max-width:100%; max-height:20cm; width:auto; height:auto;\" />\n"
            f"<div style=\"text-align:center; font-size:9pt; color:#666; margin-bottom:1em;\"><em>{info['title']} — {info['doc']}</em></div>\n"
            f"</div>\n\n"
        )
        return img_md

    # Match both ```plantuml and ```mermaid code blocks
    md = re.sub(
        r"```(?:plantuml|mermaid)\n.*?\n```",
        repl,
        md,
        flags=re.DOTALL,
    )
    return md


def main():
    out_dir = ROOT / ".cache" / "docs_with_diagrams"
    out_dir.mkdir(parents=True, exist_ok=True)

    for doc_path, ids in MAPPING.items():
        enhanced = inject(doc_path, ids)
        if not enhanced:
            continue
        out_path = out_dir / Path(doc_path).name
        out_path.write_text(enhanced, encoding="utf-8")
        print(f"  ✓ {doc_path} → {out_path.name} ({len(ids)} diagramas)")

    print(f"\n✓ Documentos mejorados en {out_dir}")


if __name__ == "__main__":
    main()