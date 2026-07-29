#!/usr/bin/env python3
"""
mermaid_to_plantuml.py — Convierte bloques Mermaid a PlantUML en archivos .md.

Tipos soportados:
  - erDiagram        → PlantUML er (sintaxis casi idéntica)
  - stateDiagram-v2  → PlantUML state (sintaxis casi idéntica)
  - flowchart LR/TD  → PlantUML activity (conversión de sintaxis)
  - classDiagram     → PlantUML class (quitar prefijo classDiagram)
  - sequenceDiagram  → PlantUML sequence (cambiar participant)

Uso:
    python3 scripts/mermaid_to_plantuml.py
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def convert_er(code: str) -> str:
    """erDiagram es casi idéntico. Solo ajustar."""
    lines = code.strip().split("\n")
    out = []
    for line in lines[1:]:  # skip "erDiagram"
        out.append(_sanitize_for_plantuml(line))
    return "@startuml\n" + "\n".join(out) + "\n@enduml"


def convert_state(code: str) -> str:
    """stateDiagram-v2 → PlantUML state.

    Diferencias:
    - stateDiagram-v2: [*] --> STATE, STATE --> STATE : label
    - PlantUML:        [*] --> STATE, STATE --> STATE : label
    Muy similar, solo ajustar.
    """
    lines = code.strip().split("\n")
    out = []
    for line in lines[1:]:  # skip "stateDiagram-v2"
        # state names con espacios deben ir entre comillas en PlantUML
        # "state Foo Bar"  →  state "Foo Bar"
        line = re.sub(r"^(\s*)state\s+([A-Z][A-Za-z0-9_]*)", r'\1state "\2"', line)
        out.append(_sanitize_for_plantuml(line))
    return "@startuml\n" + "\n".join(out) + "\n@enduml"


def convert_flowchart(code: str) -> str:
    """flowchart LR/TD → PlantUML activity.

    Diferencias:
    - Mermaid: A --> B, subgraph X ... end
    - PlantUML: A --> B, package X { ... } (o rectangle para grouping)
    - Mermaid A[Label] → PlantUML "A" as Label (sintaxis explícita)
    """
    lines = code.strip().split("\n")
    direction = "TB"
    for line in lines:
        m = re.match(r"^flowchart\s+(\w+)", line)
        if m:
            d = m.group(1).upper()
            if d in ("LR", "RL", "TB", "BT"):
                direction = d

    out_lines = []
    in_subgraph = 0
    for line in lines[1:]:  # skip "flowchart ..."
        stripped = line.strip()
        if not stripped:
            continue
        # Convertir subgraph X ... end → package X { ... }
        if stripped.startswith("subgraph "):
            in_subgraph += 1
            rest = stripped[len("subgraph "):].strip()
            if rest.startswith('"'):
                name = rest[1:rest.index('"', 1)]
            else:
                m = re.match(r'(\S+?)(?:\[|$)', rest)
                name = m.group(1) if m else rest
            out_lines.append(" " * (line.find("subgraph")) + f'package "{name}" {{')
            continue
        if stripped == "end":
            if in_subgraph > 0:
                in_subgraph -= 1
                out_lines.append(" " * 4 + "}")
            continue
        # Convertir sintaxis de flecha con label inline
        # Mermaid: A -->|text| B  (label entre | |)
        line = re.sub(r"-->\|([^|]+)\|\s*", r"--> \1 : ", line)
        # Mermaid: A -- text --> B  (label entre guiones)
        line = re.sub(r"--\s+([^-\s][^-]*?)\s+-->", r"--> \1 : ", line)

        # PRIMERO: convertir A[Label] / A((Label)) / etc. a "Label" as A
        # IMPORTANTE: hacerlo ANTES de procesar las flechas
        def repl_node(m):
            node_id, label = m.group(1), m.group(2)
            return f'"{label}" as {node_id}'
        # Mermaid node forms: A((Label)), A([Label]), A(Label), A[Label], A{Label}
        line = re.sub(r'\b([A-Za-z_][A-Za-z0-9_]*)\(\(([^()]+)\)\)', repl_node, line)  # usecase
        line = re.sub(r'\b([A-Za-z_][A-Za-z0-9_]*)\(\[([^\[\]]+)\]\)', repl_node, line)  # hexagon
        line = re.sub(r'\b([A-Za-z_][A-Za-z0-9_]*)\(([^()]+)\)', repl_node, line)   # rounded
        line = re.sub(r'\b([A-Za-z_][A-Za-z0-9_]*)\[([^\[\]]+)\]', repl_node, line)    # rect
        line = re.sub(r'\b([A-Za-z_][A-Za-z0-9_]*)\{([^{}]+)\}', repl_node, line)   # diamond

        # SEGUNDO: ahora que tenemos declaraciones explícitas, separar
        # Caso 1: "Label" as A --> "Label2" as B  (declaración de ambos)
        # Resultado: "Label" as A\n  "Label2" as B\n  A --> B
        line = re.sub(
            r"^(\s*)(\"[^\"]+\")\s+as\s+(\w+)\s+-->\s+(\"[^\"]+\")\s+as\s+(\w+)\s*$",
            r'\1\2 as \3\n\1\4 as \5\n\1\3 --> \5',
            line,
        )
        # Caso 2: A --> "Label" as B  (declaración inline del destino)
        # Resultado: "Label" as B\n  A --> B  (preserva indent)
        line = re.sub(
            r"^(\s*\S[^>]*?-->)\s+(\"[^\"]+\")\s+as\s+(\w+)\s*$",
            r'\2 as \3\n\1 \3',
            line,
        )

        # TERCERO: Mermaid A --> label : B  (label antes de :)
        # El formato PlantUML es: A --> B : label
        # PERO: A --> "X" as B  NO debe convertirse (declaración de B)
        # Y A --> label : "X" as B  (label + declaración) tampoco
        # Si la línea tiene " : " (formato step 2 ya procesado), no tocar
        if " : " not in line:
            # Regex groups: 1=ws, 2=label, 3=target
            line = re.sub(
                r"-->(\s+)(.+?)\s*:\s+(\S+(?:\s+\S+)*?)\s*$",
                lambda m: (
                    m.group(0) if " as " in m.group(3)
                    else f"--> {m.group(3)} : {m.group(2)}"
                ),
                line,
            )

        # PRIMERO: convertir A[Label] / A((Label)) / etc. a "Label" as A
        # IMPORTANTE: hacerlo ANTES de procesar las flechas
        def repl_node(m):
            node_id, label = m.group(1), m.group(2)
            return f'"{label}" as {node_id}'
        # Mermaid node forms: A((Label)), A([Label]), A(Label), A[Label], A{Label}
        line = re.sub(r'\b([A-Za-z_][A-Za-z0-9_]*)\(\(([^()]+)\)\)', repl_node, line)  # usecase
        line = re.sub(r'\b([A-Za-z_][A-Za-z0-9_]*)\(\[([^\[\]]+)\]\)', repl_node, line)  # hexagon
        line = re.sub(r'\b([A-Za-z_][A-Za-z0-9_]*)\(([^()]+)\)', repl_node, line)   # rounded
        line = re.sub(r'\b([A-Za-z_][A-Za-z0-9_]*)\[([^\[\]]+)\]', repl_node, line)    # rect
        line = re.sub(r'\b([A-Za-z_][A-Za-z0-9_]*)\{([^{}]+)\}', repl_node, line)   # diamond

        out_lines.append(_sanitize_for_plantuml(line))
    body = "\n".join(out_lines)
    return f"@startuml\nskinparam nodesep 20\nskinparam ranksep 30\n{body}\n@enduml"


def convert_class(code: str) -> str:
    """classDiagram → PlantUML class.

    Diferencias:
    - Mermaid: classDiagram \n class Foo { +bar: type } \n Foo : +bar() method
    - PlantUML: class Foo { +bar: type\n +method()\n }
    """
    lines = code.strip().split("\n")
    out = []
    current_class = None
    in_block = False
    block_lines = []

    for line in lines[1:]:  # skip "classDiagram"
        stripped = line.strip()
        if not stripped:
            continue
        # class Foo { ... } block start
        m_block = re.match(r"^class\s+(\w+)\s*\{", stripped)
        if m_block:
            current_class = m_block.group(1)
            in_block = True
            block_lines = []
            continue
        if stripped == "}":
            in_block = False
            out.append(f"class {current_class} {{")
            out.extend(block_lines)
            out.append("}")
            current_class = None
            continue
        if in_block:
            block_lines.append("  " + stripped)
            continue
        # Class: Foo : +bar() method  (line outside block, association)
        if ":" in stripped and not stripped.startswith("class"):
            out.append(stripped)
            continue
        # Relación: A <|-- B  (herencia)
        if re.search(r"<\|--", stripped) or re.search(r"--\|>", stripped) or re.search(r"\*--", stripped) or re.search(r"o--", stripped):
            out.append(stripped)
            continue
        # Default: pass through
        out.append(stripped)

    return "@startuml\nskinparam classAttributeIconSize 0\n" + "\n".join(out) + "\n@enduml"


def _sanitize_for_plantuml(s: str) -> str:
    """Sanitize text for PlantUML: remove <br/>, escape $ etc."""
    # <br/> → \n
    s = re.sub(r"<br\s*/?>", " ", s)
    # Escape $ as two $$ for PlantUML
    s = s.replace("$", "\\$")
    # Remove other HTML tags
    s = re.sub(r"<[^>]+>", "", s)
    return s


def convert_sequence(code: str) -> str:
    """sequenceDiagram → PlantUML sequence.

    Diferencias:
    - Mermaid: participant A as "Name" \n A->>B: msg
    - PlantUML: participant "Name" as A \n A ->> B : msg
    - Mermaid par/and/end → no hay equivalente en PlantUML (se quita)
    """
    lines = code.strip().split("\n")
    out = []
    for line in lines[1:]:  # skip "sequenceDiagram"
        stripped = line.strip()
        if not stripped:
            continue
        # par/and/end → ignorar (Mermaid-specific, no existe en PlantUML)
        if stripped == "par" or stripped.startswith("par ") or \
           stripped == "and" or stripped.startswith("and ") or \
           stripped == "end":
            continue
        # participant A as "Name"  →  participant "Name" as A
        m = re.match(r'^participant\s+(\S+)(?:\s+as\s+"?([^"]+)"?)?', stripped)
        if m:
            short = m.group(1)
            name = m.group(2) or short
            out.append(f'participant "{name}" as {short}')
            continue
        # actor A as "Name"  →  actor "Name" as A
        m = re.match(r'^actor\s+(\S+)(?:\s+as\s+"?([^"]+)"?)?', stripped)
        if m:
            short = m.group(1)
            name = m.group(2) or short
            out.append(f'actor "{name}" as {short}')
            continue
        # A->>B: msg  →  A ->> B : msg  (solo agregar espacios)
        # Pero el mensaje puede tener ":" que rompería el split.
        # Estrategia: encontrar el primer ":" después de "->>" y reemplazar
        # Formato típico: A->>B: msg
        # Mermaid-specific: "UI A" como target (rama de par) → "UI"
        stripped = re.sub(r"\bUI\s+([AB])\b", r"UI", stripped)
        m_arrow = re.search(r"(-->>|->>|--x|-x|->|-->)\s*", stripped)
        if m_arrow and ":" in stripped:
            # Split: prefix + arrow + suffix
            parts = re.split(r"(-->>|->>|--x|-x|->|-->)\s*", stripped, maxsplit=1)
            if len(parts) >= 3:
                left = parts[0].strip()
                arrow = parts[1]
                rest = parts[2]
                # rest = "B: msg"  →  "B : msg"
                if ":" in rest:
                    idx = rest.index(":")
                    target = rest[:idx].strip()
                    msg = _sanitize_for_plantuml(rest[idx+1:].strip())
                    out.append(f"{left} {arrow} {target} : {msg}")
                    continue
        out.append(_sanitize_for_plantuml(stripped))
    return "@startuml\nskinparam sequenceArrowThickness 2\n" + "\n".join(out) + "\n@enduml"


def convert_mermaid_block(code: str) -> str:
    """Detect type and convert."""
    first_line = code.strip().split("\n")[0].strip()
    if first_line.startswith("erDiagram"):
        return convert_er(code)
    elif first_line.startswith("stateDiagram"):
        return convert_state(code)
    elif first_line.startswith("flowchart"):
        return convert_flowchart(code)
    elif first_line.startswith("classDiagram"):
        return convert_class(code)
    elif first_line.startswith("sequenceDiagram"):
        return convert_sequence(code)
    else:
        return f"@startuml\n{code}\n@enduml"


def process_file(md_path: Path) -> int:
    """Convert all Mermaid blocks in a .md to PlantUML. Returns count converted."""
    text = md_path.read_text(encoding="utf-8")
    converted = 0

    def repl(m):
        nonlocal converted
        code = m.group(1)
        converted += 1
        plantuml = convert_mermaid_block(code)
        return f"```plantuml\n{plantuml}\n```"

    new_text = re.sub(r"```mermaid\n(.*?)\n```", repl, text, flags=re.DOTALL)
    if converted:
        md_path.write_text(new_text, encoding="utf-8")
    return converted


def main():
    total = 0
    for md_path in ROOT.glob("docs/**/*.md"):
        n = process_file(md_path)
        if n:
            print(f"  ✓ {md_path.relative_to(ROOT)}: {n} diagramas convertidos")
            total += n
    print(f"\n✓ Total: {total} diagramas Mermaid convertidos a PlantUML")


if __name__ == "__main__":
    main()