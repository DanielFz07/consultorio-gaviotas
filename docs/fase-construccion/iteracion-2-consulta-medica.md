# Iteración 2 - Módulo de Consulta Médica

**Sprint:** 2 de 3
**Objetivo:** Flujo clínico del médico: consulta, prescripción con descuento atómico de stock, archivos adjuntos.

## Entregables

| Capa | Archivo |
|---|---|
| Consulta médica | `apps/backend/src/modules/consultas/consulta.routes.ts` |
| Prototipo arquitectónico | `apps/backend/src/prototype/consulta-flow.ts` |

## Endpoints

```
POST   /api/citas/:id/consulta          (crea consulta borrador, cita → EN_CURSO)
POST   /api/consultas/:id/servicios     (acumula servicio en pre-factura)
POST   /api/consultas/:id/prescripciones (descuenta stock atómicamente)
POST   /api/consultas/:id/archivos      (multipart, valida mime/tamaño)
POST   /api/consultas/:id/finalizar     (transacción: factura + items + historial)
```

## Reglas implementadas

| RN | Implementación |
|---|---|
| RN-01 | `consulta.cita_id` UNIQUE |
| RN-02 | N prescripciones permitidas, cada una con 1 producto |
| RN-03 | `withTransaction` + `SELECT FOR UPDATE` en producto |
| RN-05 | INSERT en `evento_clinico` al finalizar |
| RN-06 | `nextval('factura_numero_seq')` |
| RN-07 | `requireAuth(['MEDICO','ADMIN'])` en routes |

## Excepciones manejadas

| Código | Origen |
|---|---|
| EX-004 | zod validación |
| EX-009 | cita no existe |
| EX-010 | cita en estado no válido |
| EX-011 | stock insuficiente |
| EX-012 | producto/servicio inactivo |
| EX-019 | id inexistente |
| EX-021 | archivo > 10 MB |
| EX-022 | mime no permitido |
| EX-023 | error de escritura en disco |

## Pruebas

```bash
# Crear consulta
curl -X POST localhost:3001/api/citas/1/consulta \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"sintomas":"Cojera","diagnostico":"Esguince leve"}'

# Prescribir (descuenta stock)
curl -X POST localhost:3001/api/consultas/1/prescripciones \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"productoId":1,"cantidad":3,"dosis":"1 comp","frecuencia":"12h","duracion":"5 dias"}'

# Forzar EX-011
curl -X POST localhost:3001/api/consultas/1/prescripciones \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"productoId":1,"cantidad":9999}'

# Finalizar (transacción completa)
curl -X POST localhost:3001/api/consultas/1/finalizar \
  -H "Authorization: Bearer $TOKEN"
```

## Validación de stock atómico

Se simula concurrencia en `prototype/consulta-flow.ts` o vía script Bun con dos requests paralelos sobre el mismo producto: solo una transacción descuenta; la otra recibe EX-011 si excede stock. La fila se bloquea con `FOR UPDATE`.