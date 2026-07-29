# Consultorio Las Gaviotas — Sistema de Gestión Médica

> Proyecto Final · Análisis y Diseño de Sistemas · Metodología RUP

Sistema de información para el Consultorio Médico Las Gaviotas (Barcelona, Anzoátegui). Cubre: registro digital de pacientes, historia clínica única, agenda de citas, prescripciones médicas, reportes PDF y auditoría.

## Stack

- **Frontend:** Astro 5 SSR (Node adapter) · Bricolage Grotesque · Tailwind v4
- **Backend API:** Bun + Elysia + TypeScript + Zod
- **Worker:** Bun standalone (cron recordatorios + SMTP)
- **Base de datos:** PostgreSQL 16
- **Storage:** Volumen Docker `./data/uploads`
- **SMTP testing:** Mailhog
- **Despliegue:** Docker Compose (5 servicios)
- **Calidad:** WCAG 2.1 AA

## Módulos

| Módulo | Endpoints principales |
|---|---|
| Pacientes y Pacientes | `POST/GET/PATCH/DELETE /api/pacientes`, `/api/pacientes` |
| Agenda y Citas | `POST/GET/PATCH /api/citas`, reprogramar, cancelar |
| Consulta Médica | `POST /api/citas/:id/consulta`, `/api/consultas/:id/{servicios,prescripciones,archivos,finalizar}` |
| Inventario | `POST/GET/PATCH/DELETE /api/productos`, `/reponer` |
| Servicios | `POST/GET/PATCH /api/servicios` |
| Facturación | `GET/POST /api/facturas`, `/pagar`, `/anular` |
| Notificaciones | Worker cada 60s, SMTP |

## Autenticación

- **JWT** con HS256, expiración 8h
- **bcrypt** cost 12 para hash
- **RBAC** 3 roles: Administrador, Médico, Recepción
- Cookie `HttpOnly` + `SameSite=Lax`

## Roles y permisos

| Acción | Admin | Médico | Recepción |
|---|:---:|:---:|:---:|
| Crear/editar pacientes y pacientes | ✓ | ✓ | ✓ |
| Agendar/reprogramar/cancelar citas | ✓ | ✓ | ✓ |
| Abrir consulta, prescribir | ✓ | ✓ | ✗ |
| Cobrar factura | ✓ | ✗ | ✓ |
| Anular factura | ✓ | ✗ | ✗ |
| CRUD inventario y servicios | ✓ | ✗ | ✗ |
| Gestión de usuarios (`/usuarios`) | ✓ | ✗ | ✗ |

### Cuentas seed (desarrollo)

| Username | Contraseña | Rol | Notas |
|---|---|---|---|
| `admin` | `admin123` | ADMIN | Cuenta maestra |
| `consultorio` | `vet123` | MEDICO | Dr. Pérez |
| `vet2` | `vet123` | MEDICO | Dra. Gómez |
| `recep` | `recep123` | RECEPCION | Ana Recepción |
| `recep2` | `recep123` | RECEPCION | Carlos Recepción |

> Cambia todas las contraseñas antes de pasar a producción.

## Quick start (Docker)

```bash
# 1. Clonar
git clone https://github.com/TU_USUARIO/consultorio-gaviotas.git
cd consultorio-gaviotas

# 2. Copiar variables de entorno
cp deploy/.env.example deploy/.env

# 3. Levantar todo
docker compose -f deploy/docker-compose.yml up -d

# 4. Acceder
# Frontend: http://localhost:4321
# Mailhog UI: http://localhost:8025
# API health: http://localhost:3001/api/health

# Login por defecto: admin / admin123
```

## Estructura

```
consultorio-gaviotas/
├── apps/
│   ├── backend/          # Elysia API
│   ├── frontend/         # Astro SSR
│   └── worker/           # Cron + SMTP
├── db/
│   ├── migrations/       # 0001_init.sql
│   └── seeds/            # 001_seed_basico.sql
├── deploy/
│   └── docker-compose.yml
├── docs/
│   ├── fase-inicio/      # Doc Visión, Prototipo UI
│   ├── fase-elaboracion/ # UML, casos de uso, DSI
│   ├── fase-construccion/ # 3 iteraciones
│   └── fase-transicion/   # Demo, manuales, despliegue
├── PRODUCT.md             # Contexto del producto
├── DESIGN.md              # Sistema visual
└── README.md              # Este archivo
```

## Regla de negocio clave (transaccionalidad)

El flujo crítico `Registrar Consulta` ejecuta todo dentro de una sola transacción Postgres:

1. `SELECT FOR UPDATE` sobre la cita → valida estado
2. `UPDATE` cita → `EN_CURSO`
3. `INSERT` consulta (síntomas, diagnóstico)
4. `INSERT` servicios
5. `INSERT` prescripciones → descuenta stock atómicamente con `FOR UPDATE`
6. `INSERT` factura correlativa (`F-2026-00000001`)
7. `INSERT` items de factura
8. `UPDATE` cita → `ATENDIDA`
9. `INSERT` entrada en historial clínico

Si cualquier paso falla → ROLLBACK completo. No hay estado parcial posible.

## Documentación RUP

Ver `docs/fase-*/` para los artefactos completos por fase.

Generar el PDF consolidado:

```bash
python3 /tmp/opencode/generate_v2.py  # genera Consultorio Las Gaviotas_Diagramas.html (requiere plantuml.jar y mmdc)
```

## Licencia

MIT
