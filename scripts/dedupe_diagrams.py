#!/usr/bin/env python3
"""
dedupe_diagrams.py — Tras la conversión Mermaid→PlantUML, todos los bloques
son PlantUML. Este script simplemente lista todos los diagramas a mantener
(sin deduplicación ya que no hay duplicados).

Output:
    .cache/dedupe_index.json
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / ".cache" / "rendered_index.json"
OUTPUT = ROOT / ".cache" / "dedupe_index.json"


def main():
    index = json.loads(INPUT.read_text(encoding="utf-8"))
    # Sin deduplicación: mantener todos los diagramas
    dedupe = {doc: blocks for doc, blocks in index.items()}
    OUTPUT.write_text(json.dumps(dedupe, indent=2, ensure_ascii=False), encoding="utf-8")
    total = sum(len(v) for v in dedupe.values())
    print(f"✓ {total} diagramas (sin deduplicar; todos son PlantUML)")


if __name__ == "__main__":
    main()