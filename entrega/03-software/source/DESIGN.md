# Design

<!-- impeccable:design-schema 1 -->

## World

Consultorio Las Gaviotas is committed to a single visual world: the **concierge médico** — the small private clinic that treats you like a hotel guest and a hospital patient at the same time. The system is the front desk, the medical chart, and the bill, fused into one quiet, premium surface.

The artifact the audience knows by heart: the engraved brass plate beside the door of a private clinic in Barcelona, set into a chalk-white wall, with a single hairline border and a name in serif capitals. Inside, the same world is the concierge desk of an Aman hotel — calm light, a leather-bound register, one tasteful lamp, and the receptionist who knows the patient by name. The system inherits both: the engraved permanence of the brass plate and the warm, considered hospitality of the concierge.

The category habit this world refuses: the SaaS dashboard with stat cards in a card in a card in a sidebar. The replacement: a single sheet under a header strip, ruled like a hotel register, with a serif masthead and full-bleed sections separated by hairline gold rules. Information is delivered with the precision of a stamped receipt and the warmth of a welcome.

## Mode

Operate. Density outranks expression. The visitor's success is the staff's success: find the patient, see the day, complete the consultation, log the result, in as few steps as the data requires. The premium voice lives in the details — typography, spacing, the gold rule, the calm navy — not in chrome that slows the work down.

## Color strategy

Full palette. Five named roles commit to the world.

| Token | Value | Role |
|---|---|---|
| `--navy` | `#0f1d3d` | Primary actions, masthead, sidebar, strong headings. The hospital-blue of the brass plate. |
| `--cream` | `#f5f1e8` | Page surface. Warm paper, the chalk-white wall behind the brass plate. |
| `--gold` | `#a07c3e` | Hairline rules, focused borders, the lamp. Used at 1px for separators, never as fills. |
| `--coral` | `#c8624a` | The human signal: alerts, today's date, primary CTA on hero moments. Sparing. |
| `--ink` | `#1a1a1a` | Body text. |
| `--ink-2` | `#5a5a5a` | Secondary text, captions. Tinted from navy, never neutral gray. |
| `--rule` | `#e6dfd1` | Soft dividers between rows. |
| `--rule-strong` | `#a07c3e` | Section rules, hairline gold. |
| `--surface` | `#faf7f0` | Cards, modals, elevated sheets. |
| `--success` | `#1f6e4e` | Confirmations, "pagada", activo. |
| `--warn` | `#b47820` | Stock bajo, atención. |
| `--danger` | `#a4324a` | Cancelar, error, anulado. Wine, not red. |
| `--serif` | `#0f1d3d` | Display headings, table headers, ticket mastheads. |

Dark/light is not a default; it is a scene. The clinic desk is under warm daylight with a brass lamp. The page is cream paper under navy ink; no terminal, no pure black ground, no `#000`. Coral is the only saturated color allowed to carry a fill (the primary CTA), and only on hero moments — everywhere else it is hairline or absent.

## Typography

Three faces, all loaded, all with full Latin Extended for Spanish:

- **Spectral** — display serif. 300, 400, 500, 600. Page titles, masthead, table headers, ticket names, the engraved-plate capital look. Tracking −0.02em on display, normal on small caps. Body weight 400 for editorial passages; 500 for table headers.
- **Manrope** — body sans. 300, 400, 500, 600, 700. UI labels, descriptions, buttons, form fields. Tight tracking on body, +0.01em on small labels.
- **JetBrains Mono** — data mono. 400, 500. Cédulas, money, stock counts, IDs, times, durations. Always tabular.

Forbidden: Inter, system-default sans, anything that says "AI dashboard." Spectral is the engraved-plate voice; Manrope is the concierge-desk voice; the pairing is deliberate and not interchangeable. Display caps at 6rem. Body measure 60–72ch. Tracking floor −0.02em on display, normal on body. Number columns use tabular-lining figures.

## Composition

The page is one sheet, layered like a hotel register:

1. **Masthead** (72px tall): full-bleed navy band. Left: brass-plate mark "CLG · Consultorio Las Gaviotas" in Spectral. Right: today's date (mono) and the user chip (avatar + role). A 1px gold rule runs along the bottom of the masthead.
2. **Nav strip** (56px tall): cream surface, sits under the masthead. The navigation lives here as a single horizontal row of icon-plus-label items in Manrope 500. The active item shows a 2px gold underline. No sidebar — Operate has density, not chrome.
3. **Sheet body**: max 1280px, centered, 1 cream sheet. Inside: page title in Spectral (display, navy), eyebrow label in Manrope 500 small caps (gold), and the working content. Sections separated by 1px gold rules; sub-sections by `--rule` soft hairlines.
4. **Footer** (32px tall): cream, 1px rule above. Left: clinic name in Spectral small caps. Center: page indicator. Right: build hash in mono.

No drop shadows except one elevation tier for modals and the user chip (a soft 0/2/12 navy/8% blur). No gradient fills. Cards are flat cream on cream with a 1px `--rule-strong` border; nesting cards inside cards is forbidden. Border-left accents are allowed only on the "today's stat" rail and only as a 2px gold mark, never decorative.

## Tables

Tables are the working surface. They behave like a hand-ruled register:

- Header row: Spectral 500, navy, on cream. 1px gold rule below. Capitalized column labels tracked +0.04em.
- Body rows: Manrope 400. Numeric columns in JetBrains Mono, tabular. Row hover tints the background `--surface` (cream, not gray). Zebra striping is forbidden; the rule between rows is enough.
- The action column is right-aligned, mono labels in 12px: `VER · EDITAR · ANULAR`.
- Empty state: a centered display line in Spectral italic with a one-sentence Manrope caption.

## Forms

Forms are a single ruled column, max 640px:

- Field label: Manrope 500, 13px, navy. 6px below the label, the input.
- Input: 1px `--rule-strong` border, 12px padding, cream surface. Focus: 2px gold outline at 2px offset. No inner shadow. Placeholder text in `--ink-2` italic.
- Submit row: sticky bottom, cream with 1px gold rule above. Primary button navy solid, secondary outline 1px navy. No gradients.

## States

Six states are committed to the system and reused everywhere:

- **Default** — cream surface, navy text, gold rule.
- **Hover** — surface tint to `#faf7f0`, gold underline on the affected row or button.
- **Focus** — 2px gold outline, 2px offset. Keyboard-only.
- **Active / Selected** — 2px gold left mark + 2px gold bottom rule on the nav item or table row.
- **Disabled** — 40% opacity, no pointer, no hover.
- **Error** — coral left mark (2px) + coral helper text below. Field border stays gold, not red.

## Motion

One orchestrated entrance for the page: the masthead settles (8px down → 0, 320ms, ease-out), the page title fades in (240ms, 80ms delay), the body content cross-fades (200ms, 120ms delay). After that, no per-section entrance. Hover transitions are 120ms ease-out, never springs. Numbers count up on stat tiles with a 600ms ease-out. The whole page is calm; no bouncing.

## Iconography

Custom 1.5px-stroke icons, drawn in the world: a stethoscope, a person, a calendar, a pill, a clipboard, a shield, a chart. Geometric, not playful. Inline SVG, never sprite sheets. Icons carry the navy color and inherit `--ink-2` at 60% when inactive.

## Brand commitments (pinned by user choice)

- Personality: **Clínica moderna premium** — the small private clinic that feels like a hotel.
- Color strategy: **Full palette** with five roles — navy, cream, gold, coral, ink.
- Density: **Operacional denso** — info-rich without becoming a wall of data.
- The world is **not** the incumbent "ficha clínica unificada" paper binder. The brass-plate voice and concierge warmth replace it. Future surfaces inherit this; do not split back into a SaaS stat-card pattern.