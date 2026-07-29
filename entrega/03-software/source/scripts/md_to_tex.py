#!/usr/bin/env python3
"""
md_to_tex.py — Convierte un archivo Markdown a LaTeX (xelatex).

Características:
- Convierte headings, párrafos, listas, blockquotes
- Convierte tablas markdown a longtable
- Reemplaza ```plantuml y ```mermaid por \includegraphics con PNG
- Convierte inline code, code blocks, emphasis, links
- Mantiene anchors para cross-references
- Genera un cover con título y metadatos
- Crea un preámbulo estándar (xelatex, fontspec, tcolorbox, geometry, etc.)

Uso:
    python3 scripts/md_to_tex.py input.md output.tex [--title "Título"]
"""

import argparse
import re
import sys
from pathlib import Path
import json


ROOT = Path(__file__).resolve().parent.parent
DEDUPE = ROOT / ".cache" / "dedupe_index.json"


PREAMBLE = r"""\documentclass[11pt,letterpaper]{article}

% Paquetes
\usepackage{fontspec}
\usepackage[utf8]{inputenc}
% Babel omitido intencionalmente: rompe \tableofcontents
% (su macro \babel@aux redefine \@writefile y vacía el TOC).
% xelatex + fontspec maneja UTF-8 nativo, así que tildes/ñ siguen funcionando.
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage{geometry}
\usepackage[most]{tcolorbox}
\usepackage{booktabs}
\usepackage{longtable}
\usepackage{array}
\usepackage{enumitem}
\usepackage{fancyhdr}
\usepackage{parskip}
\usepackage[hidelinks]{hyperref}
\usepackage{float}
\usepackage{titlesec}
\usepackage{amssymb}
\usepackage{textcomp}
\usepackage{eso-pic}        % full-page background (cream en toda la hoja)

\geometry{
    letterpaper,
    left=1.8cm, right=1.8cm,
    top=2.2cm, bottom=2.2cm,
    headheight=14pt,
}

% Colores Consultorio Las Gaviotas — Concierge médico premium
% Paleta: navy / cream / gold / coral / ink
\definecolor{navy}{HTML}{0F1D3D}
\definecolor{navy-600}{HTML}{1A2C54}
\definecolor{navy-800}{HTML}{08122A}
\definecolor{navy-50}{HTML}{E8EBF3}
\definecolor{cream}{HTML}{F5F1E8}
\definecolor{surface}{HTML}{FAF7F0}
\definecolor{gold}{HTML}{A07C3E}
\definecolor{gold-600}{HTML}{8A6732}
\definecolor{gold-100}{HTML}{F1EAD9}
\definecolor{gold-50}{HTML}{F7F1E1}
\definecolor{coral}{HTML}{C8624A}
\definecolor{coral-600}{HTML}{A84A35}
\definecolor{coral-100}{HTML}{F7E1D8}
\definecolor{coral-50}{HTML}{FCEFEB}
\definecolor{ink}{HTML}{1A1A1A}
\definecolor{ink-2}{HTML}{5A5A5A}
\definecolor{muted}{HTML}{5A5A5A}
\definecolor{line}{HTML}{E6DFD1}
\definecolor{line-soft}{HTML}{F6F1E4}
\definecolor{paper}{HTML}{F5F1E8}
\definecolor{success}{HTML}{1F6E4E}
\definecolor{success-soft}{HTML}{D8E8E0}
\definecolor{warning}{HTML}{B47820}
\definecolor{warning-soft}{HTML}{F4EAD2}
\definecolor{danger}{HTML}{A4324A}
\definecolor{danger-soft}{HTML}{F0D8DF}
% Aliases para compatibilidad con código previo
\definecolor{brand}{HTML}{0F1D3D}
\definecolor{brand-50}{HTML}{E8EBF3}
\definecolor{brand-100}{HTML}{DDE4F0}
\definecolor{brand-700}{HTML}{1A2C54}
\definecolor{brand-800}{HTML}{08122A}
\definecolor{accent}{HTML}{A07C3E}

% Estilo del cuerpo
\setlength{\parindent}{0pt}
\setlength{\parskip}{0.6em}
\renewcommand{\baselinestretch}{1.18}

% Fuentes — Concierge médico premium
% Display: Noto Serif Display (peso semibold para títulos)
% Body: Noto Sans (peso regular)
% Mono: DejaVu Sans Mono (con box-drawing para árboles ASCII)
\setmainfont{Noto Serif Display}[Scale=1.0]
\setsansfont{Noto Sans}[Scale=1.0]
\setmonofont{DejaVu Sans Mono}[Scale=0.9]

% Page color: cream (full-bleed, cubre TODA la hoja, no solo el text area)
\AddToShipoutPictureBG*{\AtPageLowerLeft{\color{cream}\rule{\paperwidth}{\paperheight}}}

% Hyperlinks
\hypersetup{
    colorlinks=true,
    linkcolor=navy,
    urlcolor=gold,
    citecolor=navy,
    pdftitle={Sistema de Información Automatizado para la Gestión de Registro y Orden de Pacientes — Consultorio Las Gaviotas},
    pdfauthor={Consultorio Las Gaviotas},
    pdfsubject={Sistema de Información Automatizado para la Gestión de Registro y Orden de Pacientes en C.A Consultorio Médico Las Gaviotas, de Barcelona Estado Anzoátegui},
    pdfkeywords={Consultorio Las Gaviotas, RUP, UML, PostgreSQL, Bun, Astro, Concierge Médico},
}

% Cabeceras y pie — branding brass-plate
\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\footnotesize\sffamily\bfseries\color{gold} Consultorio Las Gaviotas}
\fancyhead[R]{\footnotesize\color{ink-2} \thetitle}
\fancyfoot[L]{\footnotesize\sffamily\itshape\color{ink-2} Sistema de Información Automatizado · Barcelona, Anzoátegui}
\fancyfoot[C]{\footnotesize\sffamily\color{ink-2} \thepage\ /\ \pageref{LastPage}}
\fancypagestyle{plain}{%
  \fancyhf{}%
  \fancyhead[L]{\footnotesize\sffamily\bfseries\color{gold} Consultorio Las Gaviotas}%
  \fancyhead[R]{\footnotesize\color{ink-2} \thetitle}%
  \fancyfoot[L]{\footnotesize\sffamily\itshape\color{ink-2} Sistema de Información Automatizado · Barcelona, Anzoátegui}%
  \fancyfoot[C]{\footnotesize\sffamily\color{ink-2} \thepage\ /\ \pageref{LastPage}}%
}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

% Estilo de títulos — Spectral/Noto Serif Display en navy con rule gold
\titleformat{\section}
  {\sffamily\bfseries\Huge\color{navy}}
  {}{0pt}{}[\vspace{-0.2em}\textcolor{gold}{\rule{\textwidth}{1.5pt}}\vspace{-0.2em}]
\titleformat{\subsection}
  {\sffamily\bfseries\LARGE\color{navy-600}}
  {}{0pt}{}
\titleformat{\subsubsection}
  {\sffamily\bfseries\Large\color{navy}}
  {}{0pt}{}
\titleformat{\paragraph}[runin]
  {\sffamily\bfseries\color{ink-2}}
  {}{0pt}{}

\titlespacing*{\section}{0pt}{1.5em}{0.6em}
\titlespacing*{\subsection}{0pt}{1.2em}{0.4em}
\titlespacing*{\subsubsection}{0pt}{1em}{0.3em}

% Cajas de colores concierge
\newtcolorbox{notebox}[1][Nota]{
  colback=gold-50, colframe=gold, fonttitle=\sffamily\bfseries,
  title=#1, breakable, enhanced
}
\newtcolorbox{warnbox}[1][Atención]{
  colback=warning-soft, colframe=warning, fonttitle=\sffamily\bfseries,
  title=#1, breakable, enhanced
}
\newtcolorbox{dangerbox}[1][Error]{
  colback=danger-soft, colframe=danger, fonttitle=\sffamily\bfseries,
  title=#1, breakable, enhanced
}
\newtcolorbox{successbox}[1][Listo]{
  colback=success-soft, colframe=success, fonttitle=\sffamily\bfseries,
  title=#1, breakable, enhanced
}

% Code blocks
\usepackage{tabularx}
\usepackage{adjustbox}
\usepackage{listings}
\usepackage{fancyvrb}
\lstset{
  basicstyle=\ttfamily\small,
  backgroundcolor=\color{surface},
  frame=single,
  framerule=0pt,
  framesep=8pt,
  xleftmargin=10pt, xrightmargin=10pt,
  breaklines=true,
  breakatwhitespace=true,
  numbers=left,
  numberstyle=\tiny\color{ink-2},
  numbersep=8pt,
  keywordstyle=\color{navy}\bfseries,
  commentstyle=\color{ink-2}\itshape,
  stringstyle=\color{coral},
  showstringspaces=false,
  tabsize=2,
  literate={á}{{\'a}}1 {é}{{\'e}}1 {í}{{\'i}}1 {ó}{{\'o}}1 {ú}{{\'u}}1 {ñ}{{\~n}}1,
}

% Last page label
\usepackage{lastpage}

\begin{document}
"""


def md_to_tex(md_text: str, doc_id: str, title: str = "", md_dir: str = "") -> str:
    """Convert markdown to LaTeX body.

    md_dir: directorio del archivo .md original (para resolver paths relativos
             de imágenes). Si se da, los paths relativos se resuelven contra él.
    """
    # Load diagram index for replacements
    try:
        dedupe = json.loads(DEDUPE.read_text(encoding="utf-8"))
        doc_blocks = dedupe.get(doc_id, [])
    except Exception:
        doc_blocks = []
    # Map (block_index) -> png path
    png_map = {b["index"]: b["png"] for b in doc_blocks}

    # === STEP 1: Reemplazar diagramas (plantuml/mermaid) con figure+includegraphics ===
    # Estos se procesan AHORA (antes de proteger todo) porque necesitamos
    # conocer el índice del bloque para emparejar con el png.
    def repl_codeblock(m):
        btype = m.group(1)
        code = m.group(2)
        # Find block index: count how many plantuml blocks come before
        before = md_text[:m.start()]
        block_index = len(re.findall(r"```(?:plantuml|mermaid)\n.*?\n```", before, re.DOTALL)) + 1

        # If we have a PNG for this index, use it
        if block_index in png_map:
            png_path = png_map[block_index]
            caption = ""
            if btype == "plantuml":
                title_match = re.search(r"^\s*title\s+(.+?)$", code, re.MULTILINE)
                if title_match:
                    caption = title_match.group(1).strip()
            # Solo agregar caption si hay un title explícito en el PlantUML
            if caption:
                # Escape special LaTeX chars in caption
                caption_safe = (caption
                    .replace("\\", r"\textbackslash{}")
                    .replace("_", r"\_")
                    .replace("&", r"\&")
                    .replace("%", r"\%")
                    .replace("$", r"\$")
                    .replace("#", r"\#"))
                caption_block = f"\\caption*{{\\small\\textit{{{caption_safe}}}}}\n"
            else:
                caption_block = ""
            return (
                f"\n\\begin{{figure}}[H]\n"
                f"\\centering\n"
                # PDF vectorial: usar \includegraphics con keepaspectratio
                # para que se escale sin distorsion y quepa en la página.
                f"\\includegraphics[width=\\textwidth,height=0.85\\textheight,keepaspectratio]{{{png_path}}}\n"
                f"{caption_block}"
                f"\\end{{figure}}\n\n"
            )
        else:
            return f"\n\\begin{{lstlisting}}\n{code}\n\\end{{lstlisting}}\n\n"

    md_text = re.sub(
        r"```(plantuml|mermaid)\n(.*?)\n```",
        repl_codeblock,
        md_text,
        flags=re.DOTALL,
    )

    # === STEP 2: Proteger el resto de los bloques de código con placeholders ===
    # Los bloques de código que NO son diagramas (bash, sql, etc.) se
    # guardan tal cual y se restauran al final. Esto evita que las
    # transformaciones de texto (headings, listas, etc.) afecten
    # al contenido de los bloques de código (por ejemplo, líneas que
    # empiezan con "# 1." dentro de un bash no se conviertan en \section).
    code_blocks: list[str] = []
    def save_code(m):
        idx = len(code_blocks)
        code_blocks.append(m.group(0))
        return f"\x00CODEBLOCK{idx}\x00"
    md_text = re.sub(r"```[\s\S]*?```", save_code, md_text)

    # Track which block indices we've used (for non-kept blocks, keep code as text)
    used_indices = set()

    def repl_plantuml(m):
        idx = m.start()
        return m.group(0)

    # Replace fenced code blocks (non-diagram) - after code block protection
    # Solo usar lenguajes que listings trae por defecto
    LANG_MAP = {
        "sql": "SQL",
        "html": "HTML",
        "xml": "XML",
        "python": "Python",
        "py": "Python",
        "java": "Java",
        "c": "C",
        "cpp": "C++",
        "ruby": "Ruby",
        "perl": "Perl",
    }

    # Headings (numbered so they appear in TOC)
    md_text = re.sub(r"^#### (.+?)$", r"\\paragraph{\1}\n", md_text, flags=re.MULTILINE)
    md_text = re.sub(r"^### (.+?)$", r"\\subsubsection{\1}\n", md_text, flags=re.MULTILINE)
    md_text = re.sub(r"^## (.+?)$", r"\\subsection{\1}\n", md_text, flags=re.MULTILINE)
    md_text = re.sub(r"^# (.+?)$", r"\\section{\1}\n", md_text, flags=re.MULTILINE)

    # Bold / italic / code
    md_text = re.sub(r"\*\*(.+?)\*\*", r"\\textbf{\1}", md_text)
    md_text = re.sub(r"(?<!\*)\*([^\*\n]+?)\*(?!\*)", r"\\textit{\1}", md_text)
    # Escape special chars in inline code before wrapping in texttt
    def escape_tt(m):
        s = m.group(1)
        s = s.replace("\\", r"\textbackslash{}")
        s = s.replace("_", r"\_")
        s = s.replace("&", r"\&")
        s = s.replace("%", r"\%")
        s = s.replace("$", r"\$")
        s = s.replace("#", r"\#")
        s = s.replace("{", r"\{")
        s = s.replace("}", r"\}")
        s = s.replace("~", r"\textasciitilde{}")
        s = s.replace("^", r"\textasciicircum{}")
        return f"\\texttt{{{s}}}"
    md_text = re.sub(r"`([^`]+)`", escape_tt, md_text)

    # Unicode replacements for LaTeX compatibility
    md_text = md_text.replace("✓", "\\textcolor{brand}{\\textbf{\\checkmark}}")
    md_text = md_text.replace("✗", "\\textcolor{danger}{\\textbf{$\\times$}}")
    md_text = md_text.replace("—", "---")
    md_text = md_text.replace("–", "--")
    md_text = md_text.replace("·", "$\\cdot$")
    md_text = md_text.replace("•", "$\\bullet$")
    md_text = md_text.replace("→", "\\textrightarrow{}")
    md_text = md_text.replace("←", "\\textleftarrow{}")

    # Images (markdown): ![alt](path) → \includegraphics
    from pathlib import Path as _Path
    _root = _Path(__file__).resolve().parent.parent
    _md_dir = _Path(md_dir) if md_dir else None

    def repl_img(m):
        alt = m.group(1)
        path = m.group(2)
        # Convert relative paths to absolute for LaTeX to find them
        if not path.startswith("/"):
            # Try against md_dir first (where the markdown file is)
            if _md_dir:
                full = _md_dir / path
                if full.exists():
                    path = str(full.resolve())
                else:
                    # Fallback: against project root
                    full = _root / path
                    if full.exists():
                        path = str(full.resolve())
            else:
                full = _root / path
                if full.exists():
                    path = str(full.resolve())
        # Escape LaTeX special chars in alt
        alt_safe = alt.replace("_", r"\_").replace("&", r"\&").replace("%", r"\%")
        return f"\\begin{{figure}}[H]\n\\centering\n\\includegraphics[width=0.95\\textwidth,keepaspectratio]{{{path}}}\n\\caption*{{\\small\\textit{{{alt_safe}}}}}\n\\end{{figure}}"
    md_text = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", repl_img, md_text)

    # Links (después de images, por si hay conflictos)
    md_text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\\href{\2}{\1}", md_text)

    # Tables (markdown) — usar tabularx con \RaggedRight para evitar cortes de palabras
    def repl_table(m):
        lines = [l.strip() for l in m.group(0).split("\n") if l.strip()]
        if len(lines) < 2:
            return m.group(0)
        # Header
        header = [c.strip() for c in lines[0].strip("|").split("|")]
        # Skip alignment line (lines[1])
        # Data rows
        rows = []
        for line in lines[2:]:
            cells = [c.strip() for c in line.strip("|").split("|")]
            rows.append(cells)
        # Build LaTeX table with tabularx (auto-width columns)
        ncols = len(header)
        # X columns for auto width distribution con \RaggedRight
        col_spec = ">{\\RaggedRight\\arraybackslash}X" * ncols
        # Header con \RaggedRight también (mantiene consistencia)
        out = [
            "\\begin{table}[H]",
            "\\centering",
            "\\small",
            "\\renewcommand{\\arraystretch}{1.3}",
            f"\\begin{{tabularx}}{{\\linewidth}}{{{col_spec}}}",
            "\\toprule",
        ]
        out.append(" & ".join(f"\\textbf{{\\textcolor{{brand-800}}{{{h}}}}}" for h in header) + " \\\\")
        out.append("\\midrule")
        for r in rows:
            out.append(" & ".join(r) + " \\\\")
        out.append("\\bottomrule")
        out.append("\\end{tabularx}")
        out.append("\\end{table}")
        return "\n".join(out)
    md_text = re.sub(r"(\|.+\|\n)+", repl_table, md_text)

    # Blockquotes
    md_text = re.sub(
        r"^> (.+?)$",
        r"\\begin{quote}\\itshape \1\\end{quote}",
        md_text,
        flags=re.MULTILINE,
    )

    # Unordered lists
    lines = md_text.split("\n")
    out = []
    in_list = False
    list_indent = 0
    for line in lines:
        m = re.match(r"^(\s*)[-*+] (.+)$", line)
        if m:
            if not in_list:
                out.append("\\begin{itemize}[leftmargin=*]")
                in_list = True
            out.append(f"  \\item {m.group(2)}")
        elif re.match(r"^\s+\d+\. ", line):
            if not in_list:
                out.append("\\begin{enumerate}[leftmargin=*]")
                in_list = True
            out.append(f"  \\item {re.sub(r'^\\s+\\d+\\. ', '', line)}")
        else:
            if in_list:
                out.append("\\end{itemize}" if not list_indent else "\\end{itemize}")
                in_list = False
            out.append(line)
    if in_list:
        out.append("\\end{itemize}")

    md_text = "\n".join(out)

    # Horizontal rules
    md_text = re.sub(r"^---+$", r"\\hrulefill", md_text, flags=re.MULTILINE)
    md_text = re.sub(r"^\*\*\*+$", r"\\hrulefill", md_text, flags=re.MULTILINE)

    # Clean up blank lines
    md_text = re.sub(r"\n{3,}", "\n\n", md_text)

    # === STEP FINAL: Restaurar code blocks desde placeholders ===
    def repl_protected_code(m):
        idx = int(m.group(1))
        original = code_blocks[idx]
        m_inner = re.match(r"```(\w*)\n([\s\S]*?)\n```\s*$", original)
        if not m_inner:
            return original
        lang = m_inner.group(1).lower() if m_inner.group(1) else ""
        body = m_inner.group(2)
        # Si el bloque tiene caracteres Unicode que lstlisting/verbatim no
        # manejan bien con la fuente typewriter, usar Verbatim de fancyvrb
        # que sí respeta \setmonofont.
        has_unicode_specials = any(c in body for c in "├│└─")
        if has_unicode_specials:
            return f"\n\\begin{{Verbatim}}[fontfamily=tt]\n{body}\n\\end{{Verbatim}}\n\n"
        listings_lang = LANG_MAP.get(lang)
        if listings_lang:
            return f"\n\\begin{{lstlisting}}[{listings_lang}]\n{body}\n\\end{{lstlisting}}\n\n"
        else:
            return f"\n\\begin{{lstlisting}}\n{body}\n\\end{{lstlisting}}\n\n"
    md_text = re.sub(r"\x00CODEBLOCK(\d+)\x00", repl_protected_code, md_text)

    return md_text


def make_cover(title: str, subtitle: str = "") -> str:
    """Generate a cover page."""
    subtitle_block = f"{{\\large\\itshape {subtitle}}}\\\\[1em]" if subtitle else ""
    return f"""
\\begin{{titlepage}}
\\centering
\\vspace*{{4cm}}
{{\\Huge\\sffamily\\bfseries\\color{{brand}} Consultorio Las Gaviotas}}\\\\[1.5em]
{{\\LARGE\\sffamily {title}}}\\\\[0.5em]
{subtitle_block}
{{\\large\\sffamily Sistema de Información Automatizado para la Gestión de Registro y Orden de Pacientes}}\\\\[0.5em]
{{\\large\\sffamily Análisis y Diseño de Sistemas}}\\\\[0.5em]
{{\\large\\sffamily Framework: RUP}}\\\\[2em]
\\vfill
{{\\small Fecha: \\today}}
\\end{{titlepage}}
\\newpage
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path)
    ap.add_argument("output", type=Path)
    ap.add_argument("--title", default="")
    ap.add_argument("--doc-id", default="")  # for dedupe map
    ap.add_argument("--no-cover", action="store_true")
    ap.add_argument("--body-only", action="store_true",
                    help="Solo el body, sin preámbulo ni cover (para \\input)")
    args = ap.parse_args()

    if not args.input.exists():
        print(f"ERROR: {args.input} no existe")
        sys.exit(1)

    md = args.input.read_text(encoding="utf-8")
    title = args.title or args.input.stem.replace("-", " ").title()
    try:
        doc_id = args.doc_id or str(args.input.resolve().relative_to(ROOT))
    except ValueError:
        doc_id = args.doc_id or str(args.input)

    body = md_to_tex(md, doc_id, title, md_dir=str(args.input.parent))
    cover = "" if args.no_cover else make_cover(title)

    if args.body_only:
        # Solo el body, sin preámbulo
        tex = body
    else:
        tex = PREAMBLE + cover + body + "\n\\end{document}\n"

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(tex, encoding="utf-8")
    print(f"  ✓ {args.output}")


if __name__ == "__main__":
    main()