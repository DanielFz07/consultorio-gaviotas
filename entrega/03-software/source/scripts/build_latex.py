#!/usr/bin/env python3
"""
build_latex.py — Genera los PDFs de la entrega usando LaTeX (xelatex).

Estructura:
  Cada PDF consolidado = 1 master.tex que hace \input de varios .tex
  generados con md_to_tex.py.
"""

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENTREGA = ROOT / "entrega"
LATEX_DIR = ROOT / ".cache" / "latex"
LATEX_DIR.mkdir(parents=True, exist_ok=True)
MD_TO_TEX = ROOT / "scripts" / "md_to_tex.py"

DOC_TITLES = {
    "vision.pdf": "Documento de Visión",
    "catalogos.pdf": "Catálogo de Requisitos, Excepciones y Normas",
    "especificaciones-tecnicas.pdf": "Especificaciones Técnicas",
    "prototipo-ui.pdf": "Prototipo UI Estático",
    "casos-uso.pdf": "Modelo de Casos de Uso",
    "diagrama-clases.pdf": "Diagrama de Clases",
    "modelo-fisico.pdf": "Modelo Físico de Datos",
    "dsi-avanzado.pdf": "DSI Avanzado — Arquitectura y Realización de Casos de Uso",
    "prototipo-arquitectonico.pdf": "Prototipo Arquitectónico — Consulta Médica",
    "README_INSTALACION.pdf": "Consultorio Las Gaviotas — Manual de Instalación y Despliegue",
}

CONSOLIDATED = {
    "01-documentos/vision.pdf": [
        ("docs/fase-inicio/01-documento-vision.md", "Fase de Inicio — Visión y Riesgos"),
        ("docs/fase-inicio/05-modelo-dominio.md", "Modelo de Dominio del Sistema"),
    ],
    "01-documentos/catalogos.pdf": [
        ("docs/dsi/01-catalogo-excepciones.md", "Catálogo de Excepciones"),
        ("docs/dsi/02-requisitos-operacion.md", "Requisitos de Operación y Normas de Diseño"),
        ("docs/dsi/03-seguridad-roles.md", "Seguridad y Roles"),
        ("docs/fase-inicio/04-estudio-factibilidad.md", "Estudio de Factibilidad"),
        ("docs/fase-inicio/06-actores-sistema.md", "Actores del Sistema"),
    ],
    "01-documentos/especificaciones-tecnicas.pdf": [
        ("docs/fase-transicion/06-plan-pruebas.md", "Plan de Pruebas"),
        ("docs/fase-transicion/02-implantacion-docker.md", "Implantación con Docker"),
        ("docs/fase-transicion/03-procedimiento-migracion.md", "Procedimiento de Migración"),
        ("docs/dsi/03-seguridad-roles.md", "Procedimientos de Seguridad (Roles)"),
    ],
    "02-diagramas/prototipo-ui.pdf": [
        ("docs/fase-inicio/03-prototipo-ui-screenshots.md", "Prototipo UI — Capturas Reales"),
        ("docs/fase-inicio/02-prototipo-ui-pantallas.md", "Prototipo UI Estático (Mockups)"),
    ],
    "02-diagramas/casos-uso.pdf": [
        ("docs/fase-elaboracion/02-casos-uso.md", "Modelo de Casos de Uso (general)"),
        ("docs/fase-elaboracion/02b-casos-uso-expandidos.md", "Casos de Uso Expandidos"),
    ],
    "02-diagramas/diagrama-clases.pdf": [
        ("docs/fase-elaboracion/01-diagrama-clases.md", "Diagrama de Clases"),
    ],
    "02-diagramas/modelo-fisico.pdf": [
        ("docs/fase-elaboracion/03-er-diagrama.md", "Modelo Físico de Datos (ER)"),
        ("docs/fase-elaboracion/04-flujo-dia-completo.md", "Flujo del Día Completo"),
        ("docs/fase-elaboracion/05-estados.md", "Diagramas de Estado"),
    ],
    "02-diagramas/dsi-avanzado.pdf": [
        ("docs/fase-elaboracion/06-arquitectura-despliegue.md", "Arquitectura y Despliegue"),
        ("docs/fase-elaboracion/07-realizacion-casos-uso.md", "Realización de Casos de Uso (Diagramas de Secuencia)"),
        ("docs/fase-elaboracion/08-prototipo-arquitectonico.md", "Prototipo Arquitectónico"),
        ("docs/fase-elaboracion/09-diagrama-capas.md", "Diagrama de Capas"),
    ],
    "03-software/prototipo-arquitectonico.pdf": [
        ("docs/fase-elaboracion/08-prototipo-arquitectonico.md", "Prototipo Arquitectónico"),
        ("docs/fase-construccion/README.md", "Fase de Construcción — Resumen"),
        ("docs/fase-construccion/iteracion-1-pacientes-citas.md", "Iteración 1: Pacientes y Citas"),
        ("docs/fase-construccion/iteracion-2-consulta-medica.md", "Iteración 2: Consulta Médica"),
        ("docs/fase-construccion/iteracion-3-inventario-facturacion.md", "Iteración 3: Inventario y Facturación"),
    ],
    "03-software/README_INSTALACION.pdf": [
        ("README.md", "Consultorio Las Gaviotas — Descripción General"),
        ("PRODUCT.md", "Contexto del Producto"),
        ("DESIGN.md", "Sistema de Diseño"),
        ("docs/fase-transicion/02-implantacion-docker.md", "Implantación con Docker"),
        ("docs/fase-transicion/04-manual-operacion.md", "Manual de Operación"),
        ("docs/fase-transicion/05-manual-administrador.md", "Manual del Administrador"),
    ],
}


def render_md(md_path: str, section_title: str, out_dir: Path) -> str:
    """Convert .md to .tex using md_to_tex.py. Returns the .tex filename (relative)."""
    full_path = ROOT / md_path
    if not full_path.exists():
        print(f"  ⚠ {md_path} no existe")
        return None
    # Output .tex
    out_tex = out_dir / f"{Path(md_path).stem}.tex"
    cmd = [
        "python3", str(MD_TO_TEX),
        str(full_path), str(out_tex),
        "--title", section_title,
        "--doc-id", md_path,
        "--body-only",  # for \input
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"  ✗ md_to_tex {md_path}: {r.stderr}")
        return None
    return out_tex.name


def build_master(out_rel: str, sections: list, latex_dir: Path) -> Path:
    """Build a master.tex that inputs all sections, compile to PDF."""
    title = DOC_TITLES.get(Path(out_rel).name, Path(out_rel).stem)
    out_name = Path(out_rel).stem

    # Render each section
    sec_dir = latex_dir / out_name
    sec_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n→ {out_rel}")
    tex_includes = []
    for md_path, sec_title in sections:
        tex_name = render_md(md_path, sec_title, sec_dir)
        if tex_name:
            print(f"  · {Path(md_path).name}")
            tex_includes.append(tex_name)

    if not tex_includes:
        print(f"  ✗ no se pudo generar nada")
        return None

    # Read the PREAMBLE from md_to_tex.py
    md_to_tex_src = MD_TO_TEX.read_text(encoding="utf-8")
    # Extract PREAMBLE constant
    import re
    preamble_match = re.search(r'PREAMBLE = r"""(.*?)"""', md_to_tex_src, re.DOTALL)
    if not preamble_match:
        print("  ✗ no se encontró PREAMBLE en md_to_tex.py")
        return None
    preamble = preamble_match.group(1)

    # Build master.tex
    master_tex = sec_dir / "master.tex"
    # Fecha en español (sin babel para no romper el TOC)
    meses = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio",
             "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    from datetime import datetime
    now = datetime.now()
    fecha_es = f"{now.day} de {meses[now.month]} de {now.year}"

    cover = f"""
\\begin{{titlepage}}
\\thispagestyle{{empty}}
\\centering
\\vspace*{{2cm}}
{{\\fontsize{{10}}{{12}}\\selectfont\\sffamily\\bfseries\\color{{gold}} \\MakeUppercase{{\\hspace{{0.5em}}SISTEMA DE INFORMACIÓN AUTOMATIZADO · GESTIÓN DE REGISTRO Y ORDEN DE PACIENTES · C.A CONSULTORIO MÉDICO LAS GAVIOTAS \\hspace{{0.5em}}}}\\\\[1em]
\\color{{navy}}\\rule{{0.7\\textwidth}}{{1.2pt}}\\\\[1.5em]
{{\\fontsize{{36}}{{42}}\\selectfont\\sffamily\\bfseries\\color{{navy}} Consultorio}}\\\\[0.2em]
{{\\fontsize{{42}}{{48}}\\selectfont\\itshape\\color{{gold}} Las Gaviotas}}\\\\[1em]
\\color{{gold}}\\rule{{0.7\\textwidth}}{{1.2pt}}\\\\[1.5em]
{{\\fontsize{{22}}{{26}}\\selectfont\\sffamily\\color{{navy-600}} {title}}}\\\\[0.6em]
{{\\fontsize{{14}}{{18}}\\selectfont\\itshape\\color{{ink-2}} Sistema de Información Automatizado para la Gestión de Registro}}\\\\[0.2em]
{{\\fontsize{{14}}{{18}}\\selectfont\\itshape\\color{{ink-2}} y Orden de Pacientes — Barcelona, Estado Anzoátegui}}\\\\[2em]
{{\\fontsize{{11}}{{14}}\\selectfont\\sffamily\\color{{gold}} \\MakeUppercase{{Análisis y Diseño de Sistemas · Framework RUP}}}}\\\\[0.3em]
{{\\fontsize{{11}}{{14}}\\selectfont\\sffamily\\color{{ink-2}} \\MakeUppercase{{Concierge Médico Premium}}}}\\\\[3em]
\\color{{navy}}\\rule{{0.5\\textwidth}}{{0.6pt}}\\\\[1em]
{{\\fontsize{{12}}{{14}}\\selectfont\\sffamily\\color{{ink-2}} Fecha: {fecha_es}}}
\\end{{titlepage}}
\\thispagestyle{{plain}}
\\renewcommand{{\\contentsname}}{{Índice}}
\\tableofcontents
\\newpage
\\input{{{tex_includes[0]}}}
\\clearpage
\\input{{{tex_includes[1] if len(tex_includes) > 1 else ''}}}
\\end{{document}}
"""
    includes = "\n".join(f"\\input{{{name}}}" for name in tex_includes)
    # Add \clearpage between sections for proper separation
    includes_with_break = "\n\\clearpage\n".join(f"\\input{{{name}}}" for name in tex_includes)

    master_tex.write_text(
        preamble + cover + includes_with_break + "\n\\end{document}\n",
        encoding="utf-8",
    )

    # Compile with xelatex (run twice for TOC)
    for i in range(2):
        r = subprocess.run(
            ["xelatex", "-interaction=nonstopmode",
             "-output-directory", str(sec_dir), str(master_tex)],
            capture_output=True,
        )
        # Show log if failed, but continue to copy if PDF exists
        if r.returncode != 0:
            print(f"  ⚠ xelatex pass {i+1} returned {r.returncode}, but checking if PDF exists...")

    pdf_path = sec_dir / "master.pdf"
    if not pdf_path.exists():
        print(f"  ✗ master.pdf no se generó")
        return None

    # Copy to entrega/
    dest = ENTREGA / out_rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(pdf_path, dest)
    size = dest.stat().st_size // 1024
    print(f"  ✓ {out_rel} ({size} KB)")
    return dest


def main():
    ENTREGA.mkdir(parents=True, exist_ok=True)
    for out_rel, sections in CONSOLIDATED.items():
        build_master(out_rel, sections, LATEX_DIR)
    print("\n✓ Compilación LaTeX completa")


if __name__ == "__main__":
    main()