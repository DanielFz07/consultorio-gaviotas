#!/usr/bin/env python3
"""
build_entrega.py — Compila todos los PDFs de la entrega final.

Genera:
  entrega/01-documentos/
    - vision.pdf
    - catalogos.pdf
    - especificaciones-tecnicas.pdf
  entrega/02-diagramas/
    - prototipo-ui.pdf
    - casos-uso.pdf
    - diagrama-clases.pdf
    - modelo-fisico.pdf
    - dsi-avanzado.pdf
  entrega/03-software/
    - prototipo-arquitectonico.pdf
    - README_INSTALACION.pdf
"""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "md_to_pdf.py"
TEX_SCRIPT = ROOT / "scripts" / "md_to_tex.py"
OUT = ROOT / "entrega"

DOC_TITLES = {
    "vision.pdf": "Documento de Visión",
    "catalogos.pdf": "Catálogo de Requisitos, Excepciones y Normas",
    "especificaciones-tecnicas.pdf": "Especificaciones Técnicas",
    "prototipo-ui.pdf": "Prototipo UI Estático",
    "casos-uso.pdf": "Modelo de Casos de Uso",
    "diagrama-clases.pdf": "Diagrama de Clases",
    "modelo-fisico.pdf": "Modelo Físico de Datos",
    "dsi-avanzado.pdf": "DSI Avanzado: Arquitectura y Realización de Casos de Uso",
    "prototipo-arquitectonico.pdf": "Prototipo Arquitectónico — Consulta Médica",
    "README_INSTALACION.pdf": "Consultorio Las Gaviotas — Manual de Instalación y Despliegue",
}

# Mapeo: archivo destino → lista de .md a consolidar (en orden)
CONSOLIDATED = {
    "01-documentos/vision.pdf": [
        ("docs/fase-inicio/01-documento-vision.md", "Fase de Inicio — Visión y Riesgos"),
        (".cache/docs_with_diagrams/05-modelo-dominio.md", "Modelo de Dominio del Sistema"),
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
        (".cache/docs_with_diagrams/02-prototipo-ui-pantallas.md", "Prototipo UI estático"),
    ],
    "02-diagramas/casos-uso.pdf": [
        # Usar versiones con imágenes embebidas
        (".cache/docs_with_diagrams/02-casos-uso.md", "Modelo de Casos de Uso (general)"),
        (".cache/docs_with_diagrams/02b-casos-uso-expandidos.md", "Casos de Uso Expandidos"),
    ],
    "02-diagramas/diagrama-clases.pdf": [
        (".cache/docs_with_diagrams/01-diagrama-clases.md", "Diagrama de Clases"),
    ],
    "02-diagramas/modelo-fisico.pdf": [
        (".cache/docs_with_diagrams/03-er-diagrama.md", "Modelo Físico de Datos (ER)"),
        (".cache/docs_with_diagrams/04-flujo-dia-completo.md", "Flujo del Día Completo"),
        (".cache/docs_with_diagrams/05-estados.md", "Diagramas de Estado"),
    ],
    "02-diagramas/dsi-avanzado.pdf": [
        (".cache/docs_with_diagrams/06-arquitectura-despliegue.md", "Arquitectura y Despliegue"),
        (".cache/docs_with_diagrams/07-realizacion-casos-uso.md", "Realización de Casos de Uso (Diagramas de Secuencia)"),
        ("docs/fase-elaboracion/08-prototipo-arquitectonico.md", "Prototipo Arquitectónico"),
        (".cache/docs_with_diagrams/09-diagrama-capas.md", "Diagrama de Capas"),
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


def merge_and_convert(out_rel: str, docs: list):
    """Concatena varios .md y los convierte en un PDF único con cover concierge."""
    out_path = OUT / out_rel
    title = DOC_TITLES.get(Path(out_rel).name, Path(out_rel).stem)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Ensamblar markdown consolidado (usar versiones con diagramas inyectados cuando existan)
    docs_cache = ROOT / ".cache" / "docs_with_diagrams"
    parts = []
    for md_path, section_title in docs:
        # Preferir versión con diagramas inyectados si existe
        cached = docs_cache / Path(md_path).name
        full = cached if cached.exists() else ROOT / md_path
        if not full.exists():
            print(f"  ⚠ no existe: {md_path}")
            continue
        content = full.read_text(encoding="utf-8")
        parts.append(f"\n\n---\n\n# {section_title}\n\n{content}\n")

    merged = "\n".join(parts)
    tmp_md = OUT / f".tmp_{out_path.stem}.md"
    tmp_md.write_text(merged, encoding="utf-8")

    # Convertir vía md_to_pdf.py (weasyprint) — más tolerante con caracteres especiales
    cmd = [
        "python3", str(SCRIPT),
        str(tmp_md), str(out_path),
        "--title", title,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"  ✗ ERROR: {r.stderr}")
    else:
        size = out_path.stat().st_size
        print(f"  ✓ {out_rel} ({size // 1024} KB)")

    tmp_md.unlink(missing_ok=True)


def main():
    print(f"\n=== Compilando PDFs en {OUT}/ ===\n")
    for out_rel, docs in CONSOLIDATED.items():
        rel = out_rel.replace("01-documentos/", "").replace("02-diagramas/", "").replace("03-software/", "")
        print(f"→ {rel}")
        merge_and_convert(out_rel, docs)

    # Generar también un INDICE_ENTREGA.md y luego PDF con cover concierge médico premium
    print("\n→ INDICE_ENTREGA.pdf")
    idx_md = OUT / "INDICE_ENTREGA.md"
    idx_md.write_text(make_index_md(), encoding="utf-8")
    idx_tex = OUT / "INDICE_ENTREGA.tex"

    # 1) Generar el body .tex con md_to_tex.py (--body-only da solo el body)
    md_to_tex_script = ROOT / "scripts" / "md_to_tex.py"
    body_tex_path = idx_tex.with_suffix(".body.tex")
    subprocess.run([
        "python3", str(md_to_tex_script),
        str(idx_md), str(body_tex_path),
        "--title", "Consultorio Las Gaviotas — Índice de Entrega",
        "--body-only",
    ], check=True)
    # 2) Construir el master.tex con PREAMBLE de md_to_tex + cover concierge + body
    md_to_tex_src = md_to_tex_script.read_text(encoding="utf-8")
    import re as _re
    preamble_match = _re.search(r'PREAMBLE = r"""(.*?)"""', md_to_tex_src, _re.DOTALL)
    preamble = preamble_match.group(1) if preamble_match else ""

    from datetime import datetime
    meses = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio",
             "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    now = datetime.now()
    fecha_es = f"{now.day} de {meses[now.month]} de {now.year}"
    cover = (
        "\\begin{titlepage}\n"
        "\\thispagestyle{empty}\n"
        "\\centering\n"
        "\\vspace*{3cm}\n"
        "\\color{navy}\\rule{0.7\\textwidth}{1.2pt}\\\\[1.5em]\n"
        "{\\fontsize{36}{42}\\selectfont\\sffamily\\bfseries\\color{navy} Consultorio}\\\\[0.2em]\n"
        "{\\fontsize{42}{48}\\selectfont\\itshape\\color{gold} Las Gaviotas}\\\\[1em]\n"
        "\\color{gold}\\rule{0.7\\textwidth}{1.2pt}\\\\[1.5em]\n"
        "{\\fontsize{22}{26}\\selectfont\\sffamily\\color{navy-600} Índice de Entrega}\\\\[0.6em]\n"
        "{\\fontsize{14}{18}\\selectfont\\itshape\\color{ink-2} Sistema de Información Automatizado para la Gestión de Registro}\\\\[0.2em]\n"
        "{\\fontsize{14}{18}\\selectfont\\itshape\\color{ink-2} y Orden de Pacientes — Barcelona, Estado Anzoátegui}\\\\[2em]\n"
        "{\\fontsize{11}{14}\\selectfont\\sffamily\\color{gold} \\MakeUppercase{Análisis y Diseño de Sistemas · Framework RUP}}\\\\[0.3em]\n"
        "{\\fontsize{11}{14}\\selectfont\\sffamily\\color{ink-2} \\MakeUppercase{Concierge Médico Premium}}\\\\[3em]\n"
        "\\color{navy}\\rule{0.5\\textwidth}{0.6pt}\\\\[1em]\n"
        f"{{\\fontsize{{12}}{{14}}\\selectfont\\sffamily\\color{{ink-2}} Fecha: {fecha_es}}}\n"
        "\\end{titlepage}\n"
        "\\thispagestyle{plain}\n"
        "\\renewcommand{\\contentsname}{Índice}\n"
        "\\tableofcontents\n"
        "\\newpage\n"
    )
    # body viene sin \begin{document}, lo envolvemos
    master_tex = idx_tex
    master_tex.write_text(preamble + cover + body_tex_path.read_text(encoding="utf-8") + "\n\\end{document}\n", encoding="utf-8")
    # 3) Compilar 2 veces (TOC)
    for _ in range(2):
        subprocess.run(
            ["xelatex", "-interaction=nonstopmode", "-output-directory", str(OUT), str(master_tex)],
            capture_output=True,
        )
    body_tex_path.unlink(missing_ok=True)
    print(f"  ✓ INDICE_ENTREGA.pdf")

    print("\n✓ Compilación completa.\n")


def make_index_md() -> str:
    """Genera el documento índice de la entrega."""
    return """# Consultorio Las Gaviotas — Índice de Entrega Final

**Materia:** Análisis y Diseño de Sistemas
**Framework:** RUP (Rational Unified Process)
**Stack:** Bun + Elysia + PostgreSQL 16 + Astro 5 + Tailwind CSS 4
**Tipo de entrega:** Sistema de gestión para el Consultorio Médico Las Gaviotas (Barcelona, Anzoátegui)

---

## 1. Estructura de la entrega

- **INDICE_ENTREGA.pdf** — este documento.
- **01-documentos/**
  - `vision.pdf` — Documento de Visión.
  - `catalogos.pdf` — Catálogos (requisitos, excepciones, normas).
  - `especificaciones-tecnicas.pdf` — Especificaciones Técnicas.
- **02-diagramas/**
  - `prototipo-ui.pdf` — Prototipos UI estáticos.
  - `casos-uso.pdf` — Modelo de Casos de Uso.
  - `diagrama-clases.pdf` — Diagrama de Clases.
  - `modelo-fisico.pdf` — ER / Modelo Físico.
  - `dsi-avanzado.pdf` — Arquitectura + Realización CU.
- **03-software/**
  - `prototipo-arquitectonico.pdf` — Prototipo Arquitectónico.
  - `README_INSTALACION.pdf` — Manual de instalación.
  - `consultorio-gaviotas-codigo/` — Código fuente completo.

---

## 2. Cómo usar esta entrega

### 2.1 Leer los documentos

Los PDFs están listos para imprimir o visualizar. Cada uno incluye:
- Portada con el título del documento y metadatos de la materia.
- Numeración de páginas en el footer.
- Títulos jerárquicos con estilo académico.

### 2.2 Revisar el software

```bash
cd entrega/03-software/consultorio-gaviotas-codigo
docker compose -f deploy/docker-compose.yml up -d
# Esperar 30s a que termine el seed.
# Abrir http://localhost:4321
# Login: admin / admin123
```

### 2.3 Revisar el prototipo arquitectónico

```bash
cd entrega/03-software/consultorio-gaviotas-codigo/apps/backend
bun run prototype/consulta-flow.ts
```

---

## 3. Mapeo con los puntos de la entrega

| Punto de la entrega | Archivo(s) |
|---|---|
| **1. Documento de Visión** | `01-documentos/vision.pdf` |
| **1. Catálogos** (requisitos, excepciones, normas) | `01-documentos/catalogos.pdf` |
| **1. Especificaciones Técnicas** (entorno, seguridad, plan de pruebas, instalación) | `01-documentos/especificaciones-tecnicas.pdf` |
| **2. Prototipo UI estático** | `02-diagramas/prototipo-ui.pdf` |
| **2. Modelo de Casos de Uso** (con detalle en UC-06) | `02-diagramas/casos-uso.pdf` + `02-diagramas/dsi-avanzado.pdf` |
| **2. Diagrama de Clases** (Paciente, Cita, Historia clínica) | `02-diagramas/diagrama-clases.pdf` |
| **2. Modelo Físico de Datos** | `02-diagramas/modelo-fisico.pdf` |
| **2. DSI Avanzado** (arquitectura + realización de CU) | `02-diagramas/dsi-avanzado.pdf` |
| **3. Prototipo Arquitectónico** | `03-software/prototipo-arquitectonico.pdf` + `apps/backend/src/prototype/consulta-flow.ts` |
| **3. Aplicación Final (Consultorio Las Gaviotas)** | `03-software/consultorio-gaviotas-codigo/` |

---

## 4. Credenciales de acceso

| Usuario | Contraseña | Rol |
|---|---|---|
| admin | admin123 | ADMIN |
| medico | medico123 | MEDICO |
| medico2 | medico123 | MEDICO |
| recep | recep123 | RECEPCION |
| recep2 | recep123 | RECEPCION |

> Cambiar todas las contraseñas antes de producción.

---

## 5. Estado del proyecto

Sistema funcional, 3 fases RUP completas (Inicio, Elaboración, Construcción). Desplegado en Railway con 1 servicio y 3 procesos (web Astro SSR, API Elysia, PostgreSQL).
"""


if __name__ == "__main__":
    main()