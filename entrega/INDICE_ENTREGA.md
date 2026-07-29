# Consultorio Las Gaviotas — Índice de Entrega Final

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
