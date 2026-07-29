# Iteración 1 - Gestión de Pacientes y Citas

**Sprint:** 1 de 3
**Objetivo:** Backend funcional con auth, registro de pacientes y gestión de agenda.

## Entregables

| Capa | Archivo |
|---|---|
| Auth | `apps/backend/src/modules/auth/auth.routes.ts` |
| Pacientes | `apps/backend/src/modules/pacientes/paciente.routes.ts` |
| Pacientes | `apps/backend/src/modules/pacientes/paciente.routes.ts` |
| Citas | `apps/backend/src/modules/citas/cita.routes.ts` |
| Migraciones | `db/migrations/0001_init.sql` |
| Seed | `db/seeds/001_seed_basico.sql` |

## Endpoints

```
POST   /api/auth/login
GET    /api/pacientes?q=
GET    /api/pacientes/:id
POST   /api/pacientes
PATCH  /api/pacientes/:id
DELETE /api/pacientes/:id         (borrado lógico)

GET    /api/pacientes?pacienteId=
GET    /api/pacientes/:id       (incluye historial clínico)
POST   /api/pacientes           (crea paciente + historial 1:1)

GET    /api/citas?fecha=
GET    /api/citas/:id
POST   /api/citas              (valida slot, agenda recordatorio)
PATCH  /api/citas/:id/reprogramar
PATCH  /api/citas/:id/cancelar
```

## Criterios de aceptación

- Login devuelve JWT firmado válido 8h.
- Paciente no se duplica por V- (UNIQUE constraint).
- La cita referencia al paciente (FK ON DELETE RESTRICT).
- La consulta referencia al paciente (FK ON DELETE RESTRICT).
- Cita creada reserva slot único por médico.
- Reprogramar cita bloquea slot con `FOR UPDATE`.
- Cancelar descarta notificaciones pendientes.

## Pruebas sugeridas

```bash
# Login
curl -X POST localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'

# Registrar paciente
curl -X POST localhost:3001/api/pacientes \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"dni":"12345678","nombre":"Ana","apellido":"Pérez"}'

# Registrar paciente
curl -X POST localhost:3001/api/pacientes \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"pacienteId":1,"nombre":"Luna","sexo":"","sexo":"HEMBRA"}'

# Agendar cita
curl -X POST localhost:3001/api/citas \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"pacienteId":1,"fecha":"2026-07-20","horaInicio":"10:00","horaFin":"10:30","tipoServicio":"CONSULTA","motivo":"Control general"}'
```