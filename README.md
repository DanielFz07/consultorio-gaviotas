# Consultorio Las Gaviotas

Sistema de gestión médica para la clínica Consultorio Las Gaviotas, Barcelona, Estado Anzoátegui, Venezuela.

**Stack:** Bun + Elysia (API), PostgreSQL 16, Astro 5 SSR (frontend), Tailwind CSS 4, Docker, Railway.

## Quick start (Docker)

```bash
# Clonar e ir a deploy/
git clone <repo>
cd consultorio-gaviotas/deploy

# Copiar .env (opcional — defaults funcionan para dev local)
cp .env.example .env

# Levantar todo
docker compose up -d
```

- Frontend: http://localhost:4321
- API: http://localhost:3001/api/health
- Mailhog (emails de prueba): http://localhost:8025
- Postgres: localhost:5432

**Usuarios por defecto:**

| Usuario | Rol | Password |
|---|---|---|
| admin | ADMIN | admin123 |
| medico | MEDICO | medico123 |
| recep | RECEPCION | recep123 |

## Estructura

```
apps/
├── backend/    Bun + Elysia API + auth + audit + reportes
├── frontend/   Astro 5 SSR + Tailwind CSS 4 (light + dark mode)
└── worker/     Cron para recordatorios por email

db/             Migraciones y seeds
deploy/         Scripts de despliegue + Docker Compose + Railway
docs/           Documentación RUP (fase inicio, elaboración, construcción)
entrega/        Paquete académico entregable
```

## Deploy en producción

Ver `deploy/railway.md` para instrucciones detalladas de Railway.

Build container único con `Dockerfile.railway` (recomendado para plan free) o 3 servicios separados (planes con más recursos).

## Documentación

- `PRODUCT.md` — alcance, usuarios, modelo de negocio
- `DESIGN.md` — sistema visual ("concierge médico", paleta navy/cream/gold)
- `docs/` — RUP completo: visión, especificación, modelos UML, casos de uso, DSI

## Scripts útiles

```bash
# Recargar datos demo
docker compose exec api bun run src/db/seed.ts

# Backup manual
curl -X POST http://localhost:3001/api/mantenimiento/backup \
  -H "Authorization: Bearer <token>"

# Auditoría
docker compose logs -f api | grep audit
```

## Licencia

MIT — ver `LICENSE`.