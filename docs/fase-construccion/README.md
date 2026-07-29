# Fase Construcción - Consultorio Las Gaviotas

Tres iteraciones de código funcional sobre el stack acordado.

## Iteraciones

| # | Nombre | Detalle |
|---|---|---|
| 1 | Pacientes y Citas | [iteracion-1-pacientes-citas.md](./iteracion-1-pacientes-citas.md) |
| 2 | Consulta Médica | [iteracion-2-consulta-medica.md](./iteracion-2-consulta-medica.md) |
| 3 | Inventario y Facturación | [iteracion-3-inventario-facturacion.md](./iteracion-3-inventario-facturacion.md) |

## Estructura de código

```
apps/
├── backend/                    # Elysia API + auth + RBAC
│   ├── src/
│   │   ├── server.ts
│   │   ├── db/{pool,migrate,seed}.ts
│   │   ├── modules/
│   │   │   ├── auth/auth.routes.ts
│   │   │   ├── pacientes/paciente.routes.ts
│   │   │   ├── pacientes/paciente.routes.ts
│   │   │   ├── citas/cita.routes.ts
│   │   │   ├── consultas/consulta.routes.ts
│   │   │   ├── productos/producto.routes.ts
│   │   │   └── facturas/factura.routes.ts
│   │   └── prototype/consulta-flow.ts
│   ├── package.json
│   └── tsconfig.json
└── worker/                     # Cron recordatorios + SMTP
    ├── src/index.ts
    └── package.json

db/
├── migrations/0001_init.sql
└── seeds/001_seed_basico.sql

deploy/
├── docker-compose.yml          # 4 servicios
└── .env.example
```

## Plan de pruebas ejecutado

Cada iteración incluye su bloque "Pruebas" y "Validación" con `curl` reales. Los casos críticos:

- Stock insuficiente concurrente (FOR UPDATE)
- Factura correlativa sin huecos (secuencia)
- Anulación factura pagada por admin
- Recordatorio 24h vía worker
- Marcar NO_ASISTIO automático

## Despliegue

```bash
cp deploy/.env.example deploy/.env
docker compose -f deploy/docker-compose.yml up -d
docker compose -f deploy/docker-compose.yml logs -f api worker
```

Servicios:
- `db` (5432)
- `api` (3001)
- `worker` (cron)
- `mailhog` (1025 SMTP / 8025 UI)

Credenciales seed: `admin / admin123`.