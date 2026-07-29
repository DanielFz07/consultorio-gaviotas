# Frontend Astro SSR — Consultorio Las Gaviotas

**Stack:** Astro 5 SSR + Node adapter
**Funciones:** Login, Dashboard, Pacientes, Citas, Atención Consulta, Inventario, Facturas, Auditoría, Mantenimiento, Reportes PDF.
**Auth:** cookie HttpOnly con JWT que se reenvía al backend en cada request.

## Variables de entorno

| Var | Default | Descripción |
|---|---|---|
| `API_URL` | `http://localhost:3001` | URL del backend Elysia |
| `HOST` | `0.0.0.0` | Host de escucha |
| `PORT` | `4321` | Puerto |

## Páginas

| Path | Función | Roles |
|---|---|---|
| `/login` | Login | Público |
| `/dashboard` | Resumen del día | Todos |
| `/pacientes` | Listado y búsqueda de pacientes (filtros: nombre, cédula, fecha nac.) | Todos |
| `/pacientes/nuevo` | Registrar paciente | Todos |
| `/pacientes/:id` | Ficha del paciente + historia clínica | Todos |
| `/citas` | Listado agenda | Todos |
| `/citas/nueva` | Agendar cita | Recepción, Admin |
| `/consultas` | Cola de consultas | Médico, Admin |
| `/consultas/:citaId` | Atender consulta | Médico, Admin |
| `/inventario` | Stock de productos | Todos |
| `/servicios` | Catálogo de prestaciones | Todos |
| `/facturas` | Listado de facturas | Todos |
| `/facturas/:id` | Detalle factura | Todos |
| `/reportes` | Reportes PDF con filtros | Todos |
| `/auditoria` | Logs de operaciones | Admin |
| `/mantenimiento` | Backup / restore BDD | Admin |
| `/usuarios` | Gestión de usuarios y roles | Admin |

## Desarrollo local

```bash
bun install
bun run dev
```

Astro escucha en `:4321`. Backend en `:3001`.

## Build producción

```bash
bun run build
node ./dist/server/entry.mjs
```

## Docker

```bash
docker build -t consultorio-frontend .
docker run -p 4321:4321 -e API_URL=http://api:3001 consultorio-frontend
```

Dentro de `deploy/docker-compose.yml` ya integrado.