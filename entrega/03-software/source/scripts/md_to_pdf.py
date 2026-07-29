#!/usr/bin/env python3
"""
md_to_pdf.py — Convierte un documento Markdown a PDF con estilo académico.

Uso:
    python3 md_to_pdf.py input.md output.pdf [--title "Título" --css css.css]

Características:
    - Tipografía serif (Crimson) para cuerpo, sans (Inter) para títulos
    - Numeración de páginas en footer
    - Títulos jerárquicos con anclas automáticas
    - Imágenes responsivas
    - Tablas con bordes sutiles
    - Code blocks con fondo gris
    - Soporta Mermaid (renderizado en <pre> para que sea legible)
    - Soporta PlantUML (advertencia + bloque literal)
"""

import argparse
import sys
import re
from pathlib import Path
import markdown
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration


CSS_PROFESSIONAL = """
@page {
    size: A4;
    margin: 2.2cm 2cm 2.5cm 2cm;
    background: #f5f1e8;
    @top-right {
        content: "Consultorio Las Gaviotas · " string(title);
        font-family: 'Inter', sans-serif;
        font-size: 9pt;
        color: #a07c3e;
        vertical-align: bottom;
        padding-bottom: 0.5cm;
        letter-spacing: 0.04em;
    }
    @bottom-center {
        content: counter(page) " / " counter(pages);
        font-family: 'Inter', sans-serif;
        font-size: 9pt;
        color: #5a5a5a;
    }
}

@page:first {
    @top-right { content: ""; }
}

html { font-family: 'Noto Serif Display', 'Georgia', serif; font-size: 11pt; line-height: 1.55; color: #1a1a1a; background: #f5f1e8; }
body { margin: 0; padding: 0; }

h1, h2, h3, h4, h5, h6 {
    font-family: 'Inter', 'Helvetica', sans-serif;
    color: #0f1d3d;
    page-break-after: avoid;
    line-height: 1.25;
    margin-top: 1.6em;
}
h1 { font-size: 22pt; font-weight: 700; margin-top: 0; padding-bottom: 0.3em; border-bottom: 1.5pt solid #a07c3e; color: #0f1d3d; }
h2 { font-size: 17pt; font-weight: 700; color: #1a2c54; margin-top: 1.4em; padding-bottom: 0.2em; border-bottom: 0.6pt solid #e6dfd1; }
h3 { font-size: 14pt; font-weight: 600; color: #0f1d3d; }
h4 { font-size: 12pt; font-weight: 600; color: #2a2a2a; }
h5 { font-size: 11pt; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.06em; }
h6 { font-size: 10pt; font-weight: 600; color: #a07c3e; text-transform: uppercase; letter-spacing: 0.1em; }

p { margin: 0.6em 0; text-align: justify; hyphens: auto; }
strong { color: #0f1d3d; }
em { color: #2a2a2a; }
a { color: #a07c3e; text-decoration: none; border-bottom: 0.5pt solid #f1ead9; }

ul, ol { margin: 0.6em 0; padding-left: 1.8em; }
li { margin: 0.25em 0; }
li > ul, li > ol { margin: 0.2em 0; }

code {
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    font-size: 0.88em;
    background: #faf7f0;
    padding: 1px 4px;
    border-radius: 3px;
    color: #c8624a;
}
pre {
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    font-size: 9pt;
    line-height: 1.4;
    background: #faf7f0;
    color: #1a1a1a;
    padding: 12px 16px;
    border-radius: 4px;
    overflow-x: auto;
    page-break-inside: auto;
    margin: 1em 0;
    border: 0.5pt solid #e6dfd1;
}
pre code {
    background: transparent;
    color: inherit;
    padding: 0;
    font-size: 1em;
}

/* Tablas: hairline gold con header navy */
table {
    border-collapse: collapse;
    width: 100%;
    margin: 0.8em 0;
    font-size: 9.5pt;
    page-break-inside: auto;
    border-top: 1.2pt solid #a07c3e;
}
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
th, td {
    border: none;
    border-bottom: 0.5pt solid #e6dfd1;
    padding: 5px 9px;
    text-align: left;
    vertical-align: top;
}
th {
    background: transparent;
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    color: #0f1d3d;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 0.8pt solid #a07c3e;
}
tbody tr:nth-child(even) { background: rgba(160, 124, 62, 0.04); }

blockquote {
    border-left: 3pt solid #a07c3e;
    background: #f7f1e1;
    margin: 1em 0;
    padding: 0.6em 1em;
    color: #2a2a2a;
    font-style: italic;
}

hr {
    border: 0;
    border-top: 0.6pt solid #a07c3e;
    margin: 2em 0;
}

img { max-width: 100%; height: auto; display: block; margin: 1em auto; page-break-inside: avoid; }

/* Mermaid / PlantUML: render as preformatted text (it won't render in PDF
   without a server, but it preserves the diagram source for the reader) */
pre.mermaid, pre.language-mermaid, pre.language-plantuml {
    background: #f8fafc;
    color: #1e293b;
    border: 1px dashed #94a3b8;
}

.cover {
    page-break-after: always;
    text-align: center;
    padding-top: 5cm;
    background: #f5f1e8;
}
.cover .cover-eyebrow {
    font-size: 9pt;
    color: #a07c3e;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    font-weight: 600;
    margin-bottom: 1em;
    line-height: 1.4;
}
.cover .cover-rule {
    border-top: 1.2pt solid #a07c3e;
    width: 70%;
    margin: 1.5em auto;
}
.cover h1 {
    font-size: 32pt;
    color: #0f1d3d;
    border: none;
    padding-bottom: 0;
    margin-bottom: 0.1em;
    font-weight: 700;
    letter-spacing: -0.02em;
}
.cover .cover-italic {
    font-size: 38pt;
    color: #a07c3e;
    font-style: italic;
    font-weight: 400;
    margin-bottom: 0.3em;
    letter-spacing: -0.02em;
}
.cover .subtitle {
    font-size: 12pt;
    color: #5a5a5a;
    font-style: italic;
    margin: 1em auto 2em auto;
    max-width: 80%;
    line-height: 1.4;
}
.cover .meta {
    font-size: 11pt;
    color: #5a5a5a;
    margin-top: 3em;
    line-height: 1.8;
}
.cover .meta::before {
    content: "";
    display: block;
    border-top: 0.6pt solid #0f1d3d;
    width: 50%;
    margin: 0 auto 1.5em;
}

/* Evitar saltos antes de headings principales */
h1, h2 { page-break-before: auto; }
"""


def md_to_html(md_text: str, title: str = "") -> str:
    """Convert markdown to HTML with extensions."""
    md = markdown.Markdown(
        extensions=[
            "extra",
            "tables",
            "fenced_code",
            "toc",
            "sane_lists",
            "nl2br",
            "codehilite",
        ],
        extension_configs={
            "codehilite": {"css_class": "codehilite", "guess_lang": False},
            "toc": {"permalink": False, "toc_depth": 3},
        },
    )
    body = md.convert(md_text)
    # Add cover page — concierge médico premium (paleta navy / cream / gold)
    cover = f"""
<div class="cover">
    <div class="cover-rule"></div>
    <h1>{title or 'Documento Consultorio Las Gaviotas'}</h1>
    <div class="cover-italic">Las Gaviotas</div>
    <div class="cover-rule"></div>
    <div class="subtitle">Sistema de Información Automatizado para la Gestión de Registro y Orden de Pacientes en C.A Consultorio Médico Las Gaviotas, de Barcelona Estado Anzoátegui</div>
    <div class="meta">
        Materia: Análisis y Diseño de Sistemas<br>
        Framework: RUP (Rational Unified Process)<br>
        Concierge Médico Premium
    </div>
</div>
"""
    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>{title}</title>
</head>
<body>
{cover}
{body}
</body>
</html>"""
    return html


def convert(input_md: Path, output_pdf: Path, title: str = "", extra_css: str = ""):
    md_text = input_md.read_text(encoding="utf-8")
    html_content = md_to_html(md_text, title=title)
    full_css = CSS_PROFESSIONAL + (extra_css or "")

    font_config = FontConfiguration()
    HTML(string=html_content, base_url=str(input_md.parent)).write_pdf(
        target=str(output_pdf),
        stylesheets=[CSS(string=full_css, font_config=font_config)],
        font_config=font_config,
    )
    print(f"  ✓ {output_pdf}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path)
    ap.add_argument("output", type=Path)
    ap.add_argument("--title", default="")
    ap.add_argument("--css", default="")
    args = ap.parse_args()

    if not args.input.exists():
        print(f"ERROR: {args.input} no existe", file=sys.stderr)
        sys.exit(1)

    title = args.title or args.input.stem
    extra_css = args.css
    if extra_css and Path(extra_css).exists():
        extra_css = Path(extra_css).read_text(encoding="utf-8")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    convert(args.input, args.output, title=title, extra_css=extra_css)


if __name__ == "__main__":
    main()