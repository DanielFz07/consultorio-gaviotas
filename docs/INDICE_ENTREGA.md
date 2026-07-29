# Consultorio Las Gaviotas — Índice de Entrega Final

**Materia:** Análisis y Diseño de Sistemas
**Framework:** RUP (Rational Unified Process)
**Stack:** Bun + Elysia + PostgreSQL 16 + Astro 5 + Tailwind CSS 4 (concierge médico premium: navy/cream/gold/coral, Spectral + Manrope + JetBrains Mono)
**Generación:** Julio 2026

---

## 1. Estructura de la entrega

```
entrega/
├── INDICE_ENTREGA.pdf                       ← este documento
├── 01-documentos/
│   ├── vision.pdf                       (8 pp)   Documento de Visión
│   ├── catalogos.pdf                    (14 pp)   Catálogos: requisitos + excepciones + normas
│   ├── especificaciones-tecnicas.pdf    (28 pp)   Especificaciones Técnicas + Plan de Pruebas
├── 02-diagramas/
│   ├── prototipo-ui.pdf                 (11 pp, 8 imgs)   Prototipo UI — Capturas reales + mockups
│   ├── casos-uso.pdf                    (18 pp)   Modelo de Casos de Uso (con UC-06 detallado)
│   ├── diagrama-clases.pdf              (6 pp)   Diagrama de Clases UML
│   ├── modelo-fisico.pdf                (16 pp)   Modelo Físico: ER + Flujo del día + Estados
│   ├── dsi-avanzado.pdf                 (22 pp)   DSI Avanzado: Arquitectura + Realización de CU
└── 03-software/
    ├── prototipo-arquitectonico.pdf     (16 pp)   Prototipo Arquitectónico (consulta médica)
    ├── README_INSTALACION.pdf           (34 pp)   Manual de instalación y despliegue
    ├── consultorio-gaviotas/                       Código fuente completo
    │   └── consultorio-gaviotas.zip                (212 KB)
```

## 2. Cómo usar la entrega

### 2.1 Leer los documentos
Los PDFs están generados con LaTeX (xelatex), tipografía profesional, índice automático, encabezados con marca y numeración de páginas.

### 2.2 Revisar el software
```bash
cd entrega/03-software/consultorio-gaviotas
docker compose -f deploy/docker-compose.yml up -d
# Esperar 30s a que termine el seed.
# Abrir http://localhost:4321
# Login: admin / admin123
```

### 2.3 Revisar el prototipo arquitectónico
```bash
cd entrega/03-software/consultorio-gaviotas/apps/backend
bun run prototype/consulta-flow.ts
```

## 3. Mapeo con los puntos de la entrega

| Punto de la entrega | Archivo(s) |
|---|---|
| **1. Documento de Visión** | `01-documentos/vision.pdf` |
| **1. Catálogos** (requisitos, excepciones, normas) | `01-documentos/catalogos.pdf` |
| **1. Especificaciones Técnicas** (entorno, seguridad, plan de pruebas, instalación) | `01-documentos/especificaciones-tecnicas.pdf` |
| **2. Prototipo UI estático** (mockups) | `02-diagramas/prototipo-ui.pdf` (con capturas reales) |
| **2. Modelo de Casos de Uso** (con detalle en UC-06) | `02-diagramas/casos-uso.pdf` + `02-diagramas/dsi-avanzado.pdf` |
| **2. Diagrama de Clases** (Paciente, Paciente, Cita, Historial) | `02-diagramas/diagrama-clases.pdf` |
| **2. Modelo Físico de Datos** | `02-diagramas/modelo-fisico.pdf` |
| **2. DSI Avanzado** (arquitectura + realización de CU) | `02-diagramas/dsi-avanzado.pdf` |
| **3. Prototipo Arquitectónico** | `03-software/prototipo-arquitectonico.pdf` + `apps/backend/src/prototype/consulta-flow.ts` |
| **3. Aplicación Final (Consultorio Las Gaviotas)** | `03-software/consultorio-gaviotas/` |

## 4. Credenciales de acceso (seed)

| Usuario | Contraseña | Rol |
|---|---|---|
| admin | admin123 | ADMIN |
| medico | medico123 | MEDICO |
| medico2 | medico123 | MEDICO |
| recep | recep123 | RECEPCION |
| recep2 | recep123 | RECEPCION |

> Cambiar todas las contraseñas antes de producción.

## 5. Stack técnico

- **Backend:** Bun 1.3 + Elysia 1.1 + TypeScript + Zod + bcryptjs
- **Frontend:** Astro 5 SSR + Tailwind CSS 4 (Spectral display serif + Manrope body + JetBrains Mono data)
- **DB:** PostgreSQL 16 (modelo relacional estricto, 18 tablas con FK + UNIQUE + CHECK + ENUM)
- **Worker:** Bun + cron (cada 1 min) + SMTP para recordatorios
- **Auth:** JWT HS256, 8h de expiración, bcrypt cost 12
- **Deploy:** Docker Compose (local) + Railway (cloud, 1 servicio, 3 procesos)
- **Diagramas:** PlantUML 1.2024.7 + Mermaid CLI 11.16.0
- **PDFs:** LaTeX (xelatex) + Noto fonts
- **Screenshots:** Playwright Chromium 149

## 6. Datos del proyecto

- **Documentación:** 4127 líneas de Markdown (4 fases RUP)
- **Código:** TypeScript/Astro/SQL
- **Diagramas UML:** 23 (PlantUML + Mermaid) renderizados
- **Capturas UI:** screenshots reales (Playwright)
- **Tests:** 17 casos funcionales + 7 no funcionales
- **Auditoría:** tabla `audit_log` con tracking de operaciones (ADMIN only)
- **Mantenimiento:** backup/restore PostgreSQL vía pg_dump/psql (ADMIN only)
- **Reportes PDF:** 3 reportes con filtros (consultas, citas, pacientes)
