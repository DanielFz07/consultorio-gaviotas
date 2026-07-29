# Iteración 3 - Inventario y Facturación

**Sprint:** 3 de 3
**Objetivo:** CRUD de productos/servicios, ciclo de vida de factura (emitir/pagar/anular), worker de notificaciones SMTP.

## Entregables

| Capa | Archivo |
|---|---|
| Productos/Servicios | `apps/backend/src/modules/productos/producto.routes.ts` |
| Facturas | `apps/backend/src/modules/facturas/factura.routes.ts` |
| Worker cron | `apps/worker/src/index.ts` |
| Compose | `deploy/docker-compose.yml` |
| Env | `deploy/.env.example` |

## Endpoints productos/servicios

```
GET    /api/productos?bajoStock=true    (alerta de stock mínimo)
GET    /api/productos/:id
POST   /api/productos                  (rol ADMIN)
PATCH  /api/productos/:id              (rol ADMIN)
PATCH  /api/productos/:id/reponer      (rol ADMIN, suma stock)

GET    /api/servicios
POST   /api/servicios                  (rol ADMIN)
```

## Endpoints facturas

```
GET    /api/facturas?fecha=
GET    /api/facturas/:id               (incluye items)
POST   /api/facturas/:id/pagar         (rol RECEPCION o ADMIN)
POST   /api/facturas/:id/anular        (rol ADMIN, con motivo)
```

## Worker

Polling cada 60s. Tareas:
1. **Recordatorio 24h antes** - lee notificaciones PENDIENTES con `fecha = hoy + 1` y envía email.
2. **Marcar NO_ASISTIO** - citas pasadas con slot ya terminado (+15min tolerancia).

Estados notificación: PENDIENTE → ENVIADA / FALLIDA → DESCARTADA (manual).

## Pruebas del plan

| Test | Esperado |
|---|---|
| `POST /api/productos` con `rol: RECEPCION` | 403 EX-003 |
| `PATCH /api/productos/:id/reponer {cantidad:50}` | stock_actual += 50 |
| `GET /api/productos?bajoStock=true` | lista con stock_actual <= stock_minimo |
| `POST /api/facturas/:id/pagar` ya pagada | 409 EX-016 |
| `POST /api/facturas/:id/anular` rol MEDICO | 403 EX-003 |
| `POST /api/facturas/:id/anular` ADMIN | estado=ANULADA, motivo registrado |
| Worker tick con cita `fecha = mañana` | email enviado, notificacion=ENVIADA |
| Worker tick con cita pasada +15min | cita=NO_ASISTIO |

## Pruebas E2E "día completo"

```bash
# 1. Login recepcion
TOKEN_R=$(curl -s -X POST localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{"username":"recep","password":"recep123"}' | jq -r .token)

# 2. Crear al paciente
DUID="V-111111"
MID=$(curl -s -X POST localhost:3001/api/pacientes -H "Authorization: Bearer $TOKEN_R" -H 'Content-Type: application/json' -d "{\"cedula\":$DUID,\"nombre\":\"Luna\",\"sexo\":\"FEMENINO\"}" | jq -r .id)

# 3. Agendar cita
CID=$(curl -s -X POST localhost:3001/api/citas -H "Authorization: Bearer $TOKEN_R" -H 'Content-Type: application/json' -d "{\"pacienteId\":$MID,\"fecha\":\"2026-07-25\",\"horaInicio\":\"10:00\",\"horaFin\":\"10:30\",\"tipoServicio\":\"CONSULTA\",\"motivo\":\"Chequeo\"}" | jq -r .id)

# 4. Login consultorio
TOKEN_MED=$(curl -s -X POST localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{"username":"medico","password":"medico123"}' | jq -r .token)

# 5. Abrir consulta
CONID=$(curl -s -X POST localhost:3001/api/citas/$CID/consulta -H "Authorization: Bearer $TOKEN_MED" -H 'Content-Type: application/json' -d '{"sintomas":"s","diagnostico":"d"}' | jq -r .id)

# 6. Servicio
curl -s -X POST localhost:3001/api/consultas/$CONID/servicios -H "Authorization: Bearer $TOKEN_MED" -H 'Content-Type: application/json' -d '{"servicioId":1,"cantidad":1}'

# 7. Prescripción
curl -s -X POST localhost:3001/api/consultas/$CONID/prescripciones -H "Authorization: Bearer $TOKEN_MED" -H 'Content-Type: application/json' -d '{"productoId":1,"cantidad":3}'

# 8. Finalizar
curl -s -X POST localhost:3001/api/consultas/$CONID/finalizar -H "Authorization: Bearer $TOKEN_MED"

# 9. Pagar
curl -s -X POST localhost:3001/api/facturas/1/pagar -H "Authorization: Bearer $TOKEN_R"
```

## Despliegue

```bash
cp deploy/.env.example deploy/.env
docker compose -f deploy/docker-compose.yml up -d
# Mailhog UI: http://localhost:8025
# API: http://localhost:3001/api/health
```