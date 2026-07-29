# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:** Administrator (control global). Manages users, master catalogs (services, products), configures global parameters, monitors inventory thresholds, and runs end-of-day reconciliation. Optimizes the interface for this role: dense data, full information surface, keyboard-friendly tables, fast filters, batch actions.

**Secondary audiences that must not be blocked by the admin-centric layout:**

- **Reception (Recepcionista):** operates the front desk, registers owners and pets, schedules/reprograms/cancels appointments, takes payment at checkout. Needs a high-volume, low-friction path for: find owner → register pet → schedule slot → print receipt. Should not be punished for not being the admin; sidebar, color-coding, and shortcuts reflect the same vocabulary.
- **Médican (Médico):** runs the clinical session. Reads clinical history, opens the consultation, prescribes, attaches lab/imaging files, finalizes the consultation (which emits the invoice). Values legible medical typography and zero-friction access to history, not interface flourishes.
- **Cashier (Caja):** role is `RECEPCION` with payment permission. Reuses the same UI as reception; no separate surface.

**Job-to-be-done (admin, primary):** "I need to know, in under 10 seconds, whether the clinic is operating normally today: appointments attended, revenue captured, products consumed, and stock that needs replenishment before tomorrow."

## Product Purpose

Consultorio Las Gaviotas is an integrated management system for small veterinary clinics (typically 1–3 vets, 1–2 front-desk staff). It replaces the manual notebook + spreadsheet + paper invoice triad that small clinics in Latin America still use. The product exists to:

1. Eliminate manual calculation errors in invoicing.
2. Centralize the pet clinical history so it is never lost or duplicated.
3. Keep stock synchronized with prescriptions in real time (every dispensed dose is a stock decrement).
4. Reduce no-shows via automated 24-hour reminders.
5. Produce operational metrics the clinic never had before (daily revenue, top services, low-stock alerts).

Success means a clinic can run a full day with the system, lose zero inventory between prescription and billing, and produce a daily report without any hand-tallying.

## Positioning

The mechanism a neighboring product could not truthfully copy: **a single transactional boundary that ties a consultation to its prescriptions to its invoice to its stock decrement**. When the consultorio presses "Finalize Consultation", a Postgres `BEGIN/COMMIT` block guarantees that the invoice number, the items, the stock update, and the history entry are written atomically or not at all. No partial state, no "the stock said yes but the invoice didn't print" race condition. This is the core of the product's reliability story and the reason a clinic can trust it more than a spreadsheet.

## Operating Context

- **Environment:** physical reception desk, single-screen PC (1920×1080 typical), sometimes a tablet in the consultation room.
- **Workflow cadence:** ~8–15 consultations/day, peak in the morning. Each consultation averages 15–20 minutes of clinical time plus 3–5 minutes of system entry.
- **Daily ritual:** reception prints the day's appointments at 08:30, vets pull up consultations as patients arrive, cashier closes unpaid invoices at end of day, admin reconciles stock at 19:00.
- **Connectivity assumption:** server reachable on the local network; intermittent outages tolerated (queries retry, file uploads resume).
- **Documents handled:** lab PDFs, radiograph images (PNG/JPEG/WEBP), printed invoices (PDF export), emailed reminders (SMTP).
- **Regulatory light:** no HIPAA-equivalent in the target market, but personal data of pet owners (DNI, email, phone) is treated with restraint. No data leaves the clinic's server without the admin's explicit action.

## Capabilities and Constraints

**Confirmed capabilities:**

- CRUD for patients (personas humanas) with 1:1 patient→clinical-history.
- Appointment scheduling with slot-uniqueness enforcement per médico.
- Consultation workflow: symptoms, diagnosis, treatment, services, prescriptions, file attachments, finalize.
- Inventory: products with stock, minimum-threshold alerts, atomic decrement on prescription.
- Invoicing: auto-generated on consultation close, sequential correlative numbers, services + products + tax.
- Authentication with JWT + bcrypt, three roles (Admin / Médico / Recepción), RBAC enforced server-side.
- Worker process polls every 60s for 24h-appointment reminders and sends via SMTP.
- Backend: Bun + Elysia + TypeScript. Database: PostgreSQL 16. Storage: local volume. Deployment: docker-compose.

**Confirmed technical constraints:**

- Backend runs on Linux inside Docker. No Windows-specific paths.
- Database is strictly relational (PostgreSQL 16). No NoSQL.
- Files served from `./data/uploads` volume; max 10 MB per file; allowed MIME: PNG, JPEG, WEBP, PDF.
- Frontend is Astro SSR with Node adapter; the SSR layer proxies all auth to the backend.
- Tax rate is a single configuration value (`TAX_RATE` env, default 0.16).
- Sequential invoice numbers via a Postgres `SEQUENCE`; no manual override.

**Explicitly undecided (do not invent):**

- Multi-clinic (chain) tenancy. Current design is single-clinic.
- Native mobile app. The system is responsive but not native.
- Payment gateway integration (cards, transfers). Only cash/manual recording exists.
- SMS provider. Only SMTP email reminders are wired; SMS is a future hook.

## Brand Commitments

- **Name:** Consultorio Las Gaviotas. Established by the academic project; do not rename or reskin the name.
- **Voice:** professional, concise, clinical. No exclamation marks, no emoji in product copy, no marketing language. Empty states say "No hay citas para hoy." not "Uh oh! Nothing here yet!"
- **Identity constraint:** the system name "Consultorio Las Gaviotas" and the wordmark in the sidebar must remain on every page that is part of the operator's daily flow.
- **Visual world pinned by user:** *Clínica moderna premium* — full palette (navy `#0f1d3d` / cream `#f5f1e8` / gold `#a07c3e` / coral `#c8624a` / ink `#1a1a1a`) and three faces (Spectral display serif, Manrope body, JetBrains Mono data). Recorded in DESIGN.md as the *concierge médico* world; replacement world, not a refinement. Future surfaces inherit it.

## Evidence on Hand

- The implemented system is itself the evidence: every flow described in the manual-of-operations document is live in the running system.
- The product has no public marketing site, no customer testimonials, no press, no case study. Future work must not fabricate any.
- The visual reference set is empty; the only incumbent truth is the current Astro implementation in `apps/frontend/`.

## Product Principles

1. **One transaction, one truth.** A consultation, its prescriptions, its invoice, its stock decrement, and its history entry are inseparable. Never split them.
2. **The admin sees everything; the role only gates.** The primary user is the admin, so density and completeness outrank decoration; role-based hiding prevents unauthorized actions but does not simplify the admin's view.
3. **Reversible on paper, irreversible in the system.** A no-show is logged, a cancellation is kept with its reason, an invoice can be annulled (not deleted) — but the system never silently overwrites. Auditability over convenience.
4. **Boring beats clever at the desk.** Reception processes dozens of customers a day. The interface must be predictable, keyboard-friendly, and free of animations that delay actions.
5. **Local clinic, real network.** No external SaaS dependency, no telemetry, no third-party tracker. The clinic owns the server, owns the data, owns the backup.

## Accessibility & Inclusion

- **Target:** WCAG 2.1 Level AA.
- All interactive elements reachable by keyboard; visible focus rings on all focusable elements.
- Text contrast ≥ 4.5:1 against the surface background; non-text UI contrast ≥ 3:1.
- Form fields have associated `<label>` elements; error messages are programmatically associated via `aria-describedby` or equivalent.
- Color is never the sole carrier of state (badges pair color with text).
- Tables are responsive on tablet widths (≥ 768px); below that, the operator is expected to use a dedicated device.
- Spanish-language UI. No localization infrastructure (i18n) is in scope for v1; copy is written directly in Spanish.
