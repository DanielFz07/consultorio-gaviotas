# Diseño DSI - Realización de Casos de Uso

**Fase:** Elaboración (RUP)
**Tipo:** Diseño del Sistema de Información (DSI)
**Propósito:** Documentar la interacción entre objetos del sistema para los casos de uso críticos.

Cada caso se modela con un **diagrama de secuencia** que muestra:
- Actores (Usuario, Sistemas externos)
- Objetos del sistema (boundary, control, entity)
- Mensajes en orden temporal
- Decisiones, alternativas y excepciones

---

## UC-03: Agendar Cita Médica

### Realización - Camino feliz

```plantuml
@startuml
skinparam sequenceArrowThickness 2
actor "Recepcionista" as Recep
participant "/citas/nueva" as UI
participant "CitaController" as API
participant "PostgreSQL" as DB
Recep ->> UI : completa formulario (fecha, hora, pacienteId, medicoId)
UI ->> API : POST /api/citas {fecha, horaInicio, pacienteId, medicoId}
API ->> API : validar payload (Zod)
API ->> DB : SELECT COUNT(*) FROM cita WHERE medico_id = \$consultorio AND hora_inicio = \$hora AND estado != 'CANCELADA'
DB -->> API : 0 (libre)
API ->> DB : INSERT INTO cita (...)
DB -->> API : cita_id = 42
API ->> DB : SELECT paciente JOIN paciente (para email)
DB -->> API : {nombre, email}
API -->> UI : 201 {id:42, estado:PROGRAMADA}
UI -->> Recep : redirect → /citas/42 + toast "Cita agendada"
@enduml
```

### Realización - Alternativa: conflicto de horario

```plantuml
@startuml
skinparam sequenceArrowThickness 2
actor "Recepcionista" as Recep
participant "/citas/nueva" as UI
participant "CitaController" as API
participant "PostgreSQL" as DB
Recep ->> UI : completa formulario
UI ->> API : POST /api/citas {horaInicio: '10:00', ...}
API ->> DB : SELECT COUNT(*) WHERE hora_inicio='10:00' AND estado != 'CANCELADA'
DB -->> API : 1 (ocupado)
API -->> UI : 409 EX-014 "Ya hay cita en ese horario"
UI -->> Recep : error inline en formulario
@enduml
```

---

## UC-06: Registrar Consulta Médica (CRÍTICO)

Este es el caso de uso más importante del sistema. Demuestra la **atomicidad transaccional** que es la propuesta de valor única de Consultorio Las Gaviotas.

### Realización - Camino feliz

```plantuml
@startuml
skinparam sequenceArrowThickness 2
actor "Médico" as Doc
participant "/consultas/nueva" as UI
participant "ConsultaController" as API
participant "PostgreSQL (TX)" as DB
participant "/data/uploads" as FS
Doc ->> UI : abre consulta de cita #42
UI ->> API : GET /api/citas/42/consulta-activa
API ->> DB : SELECT id FROM consulta WHERE cita_id=42 LIMIT 1
DB -->> API : null (no existe aún)
API -->> UI : {id: null}
Doc ->> UI : completa formulario + agrega prescripciones + servicios
Note over Doc,UI: 2 prescripciones (Amoxi 500mg x2, Metacam x1) 1 servicio (Consulta general x1) 1 adjunto PDF (lab.pdf)
Doc ->> UI : click "Finalizar consulta"
UI ->> FS : upload lab.pdf (multipart)
FS -->> UI : {filename: lab_a3f9.pdf}
UI ->> API : POST /api/citas/42/consulta {sintomas, diagnostico, prescripciones, servicios, archivo}
API ->> API : BEGIN TRANSACTION
API ->> DB : SELECT stock_actual FROM producto WHERE id=1 FOR UPDATE
DB -->> API : 50 (suficiente)
API ->> DB : SELECT stock_actual FROM producto WHERE id=2 FOR UPDATE
DB -->> API : 30 (suficiente)
API ->> DB : INSERT INTO consulta (cita_id, medico_id, ...)
API ->> DB : INSERT INTO consulta_servicio (consulta_id, servicio_id, precio)
API ->> DB : INSERT INTO consulta_prescripcion (consulta_id, producto_id, cantidad, dosis)
API ->> DB : INSERT INTO consulta_archivo (consulta_id, path, mime)
API ->> DB : UPDATE producto SET stock_actual = stock_actual - 2 WHERE id=1
API ->> DB : UPDATE producto SET stock_actual = stock_actual - 1 WHERE id=2
API ->> DB : INSERT INTO factura (numero=nextval, consulta_id, subtotal, iva, total, estado='PENDIENTE')
API ->> DB : UPDATE cita SET estado='ATENDIDA' WHERE id=42
API ->> API : COMMIT
DB -->> API : OK (transacción confirmada)
API -->> UI : 201 {consultaId, facturaId, numeroFactura, total}
UI -->> Doc : toast "Consulta finalizada. Factura #F-1234 generada"
@enduml
```

### Realización - Excepción: stock insuficiente

```plantuml
@startuml
skinparam sequenceArrowThickness 2
actor "Médico" as Doc
participant "/consultas/nueva" as UI
participant "ConsultaController" as API
participant "PostgreSQL (TX)" as DB
Doc ->> UI : prescripción Amoxi 500mg x100 (stock=10)
Doc ->> UI : click "Finalizar consulta"
UI ->> API : POST /api/citas/42/consulta {..., prescripciones:[{prodId:1, cant:100}]}
API ->> API : BEGIN TRANSACTION
API ->> DB : SELECT stock_actual FROM producto WHERE id=1 FOR UPDATE
DB -->> API : 10
API ->> API : validar 100 <= 10? NO
API ->> API : ROLLBACK
API -->> UI : 400 EX-018 "Stock insuficiente: Amoxi 500mg tiene 10, necesitas 100"
UI -->> Doc : error inline en prescripción
Note over UI,DB: Ningún cambio fue persistido. Consulta, factura, stock quedan intactos.
@enduml
```

### Realización - Excepción: falla de BD durante transacción

```plantuml
@startuml
skinparam sequenceArrowThickness 2
actor "Médico" as Doc
participant "/consultas/nueva" as UI
participant "ConsultaController" as API
participant "PostgreSQL (TX)" as DB
Doc ->> UI : completa consulta válida
UI ->> API : POST /api/citas/42/consulta {válida}
API ->> API : BEGIN
API ->> DB : INSERT consulta OK
API ->> DB : INSERT consulta_servicio OK
API ->> DB : UPDATE stock producto 1 OK (50 → 48)
API ->> DB : INSERT factura (consulta_id) **FALLA** (violación constraint)
API ->> API : detecta error, ROLLBACK
Note over DB: PostgreSQL hace ROLLBACK automático de: - INSERT consulta ❌ - INSERT consulta_servicio ❌ - UPDATE stock ❌
API -->> UI : 500 EX-099 "Error interno - operación revertida"
UI -->> Doc : error "Algo salió mal. Intentá de nuevo."
Note over Doc: El stock NO quedó en 48. Vuelve a estar en 50.
@enduml
```

### Diagrama de colaboración (objetos)

```plantuml
@startuml
title Diagrama de Colaboración - UC-06 Registrar Consulta
skinparam sequenceArrowThickness 2

actor "Recepcionista" as R
actor "Médico" as V
participant "ConsultaUI" as UI
participant "ConsultaCtrl" as API
participant "Consulta" as C
participant "Factura" as F
participant "Producto" as P

R -> UI: 1: openForm
UI -> API: 2: findActive
API -> C: 3: consulta
C --> API: (datos cita)
UI -> API: 4: submit
API -> P: 5: lockStock (FOR UPDATE)
P --> API: 6: stockValue
API -> C: 7: new Consulta()
API -> F: 8: new Factura()
API -> P: 9: decrementStock
API --> UI: 10: response

note over V: Stock verificado atómicamente
note over R:Consulta finalizada, factura emitida
@enduml
```

---

## UC-09: Cobrar Factura

### Realización - Camino feliz

```plantuml
@startuml
skinparam sequenceArrowThickness 2
actor "Recepcionista" as Recep
participant "/facturas" as UI
participant "FacturaController" as API
participant "PostgreSQL" as DB
Recep ->> UI : lista facturas del día, click "Cobrar" en #F-1234
UI ->> API : GET /api/facturas/1234
API ->> DB : SELECT * FROM factura WHERE id=1234
DB -->> API : {estado: PENDIENTE, total: 1250.00}
API -->> UI : {factura}
Recep ->> UI : selecciona método "EFECTIVO", confirma
UI ->> API : PATCH /api/facturas/1234 {estado: PAGADA, metodoPago: 'EFECTIVO'}
API ->> DB : UPDATE factura SET estado='PAGADA', metodo_pago='EFECTIVO', cobrado_en=NOW() WHERE id=1234 AND estado='PENDIENTE'
DB -->> API : 1 row updated
API -->> UI : 200 {factura actualizada}
UI -->> Recep : toast "Cobrado \$1250.00 · Factura #F-1234"
@enduml
```

### Realización - Excepción: doble cobro (race condition)

```plantuml
@startuml
skinparam sequenceArrowThickness 2
actor "Recepcionista A" as A
actor "Recepcionista B" as B
participant "/facturas" as UI
participant "FacturaController" as API
participant "PostgreSQL" as DB
A ->> API : PATCH /api/facturas/1234 {estado: PAGADA}
API ->> DB : UPDATE WHERE estado='PENDIENTE'
B ->> API : PATCH /api/facturas/1234 {estado: PAGADA}
API ->> DB : UPDATE WHERE estado='PENDIENTE'
DB -->> API : A → 1 row updated
DB -->> API : B → 0 rows updated (ya no está PENDIENTE)
API -->> UI : 200 OK
API -->> UI : 409 EX-016 "Factura ya cobrada"
@enduml
```

---

## UC-04: Registrar Paciente

```plantuml
@startuml
skinparam sequenceArrowThickness 2
actor "Recepcionista" as Recep
participant "/pacientes/{id}" as UI
participant "PacienteController" as API
participant "PostgreSQL" as DB
Recep ->> UI : click "Nueva cita" en paciente #5
UI ->> API : GET /api/pacientes/5 (para confirmar paciente existe)
API -->> UI : {nombre, apellido}
Recep ->> UI : completa {nombre, sexo, antecedente relevante, sexo, fechaNacimiento}
UI ->> API : POST `/api/pacientes`{pacienteId:5, ...}
API ->> API : validar (Zod)
API ->> DB : SELECT 1 FROM paciente WHERE id=5 AND activo=TRUE
DB -->> API : 1 (existe)
API ->> DB : INSERT INTO paciente (paciente_id, ...) RETURNING id
DB -->> API : id=88
API -->> UI : 201 {id:88}
UI -->> Recep : cita agregada al historial del paciente
@enduml
```

---

## UC-07: Reponer Stock

```plantuml
@startuml
skinparam sequenceArrowThickness 2
actor "Administrador" as Admin
participant "/inventario/{id}" as UI
participant "ProductoController" as API
participant "PostgreSQL" as DB
Admin ->> UI : ve producto Amoxi con stock=2 (bajo mínimo 5)
Admin ->> UI : completa "Reponer 20 unidades"
UI ->> API : PATCH /api/productos/1/reponer {cantidad: 20}
API ->> DB : SELECT stock_actual FROM producto WHERE id=1
DB -->> API : 2
API ->> DB : UPDATE producto SET stock_actual = stock_actual + 20 WHERE id=1 RETURNING stock_actual
DB -->> API : 22
API ->> DB : INSERT INTO movimiento_stock (producto_id, tipo='ENTRADA', cantidad=20, usuario_id=...)
API -->> UI : 200 {stock_actual: 22}
UI -->> Admin : toast "Stock actualizado a 22"
@enduml
```

---

## Patrones arquitectónicos identificados

De la realización de estos CU emergen 3 patrones:

### Transaction Script con Control Explícito
Cada endpoint crítico encapsula una transacción BEGIN/COMMIT con ROLLBACK ante cualquier excepción. La lógica de negocio vive en el handler, no en la DB (excepto constraints NOT NULL/UNIQUE/FK).

### Optimistic Locking via WHERE en UPDATE
Para evitar race conditions en transiciones de estado (cobrar factura, cancelar cita), el UPDATE incluye `WHERE estado = 'ESPERADO'` y se chequea el rowcount. Si 0, retorna 409.

### Pessimistic Locking con FOR UPDATE
Para decremento de stock en consulta médica, se hace `SELECT ... FOR UPDATE` antes del UPDATE para serializar accesos concurrentes a la misma fila.

---

## Mapeo a código

| CU | Endpoint | Archivo |
|---|---|---|
| UC-03 | `POST /api/citas` | `apps/backend/src/modules/citas/cita.routes.ts` |
| UC-04 | `POST `/api/pacientes` | `apps/backend/src/modules/pacientes/paciente.routes.ts` |
| UC-06 | `POST /api/citas/:id/consulta` | `apps/backend/src/modules/consultas/consulta.routes.ts` |
| UC-07 | `PATCH /api/productos/:id/reponer` | `apps/backend/src/modules/productos/producto.routes.ts` |
| UC-09 | `PATCH /api/facturas/:id` | `apps/backend/src/modules/facturas/factura.routes.ts` |

El prototipo arquitectónico de UC-06 está implementado en `apps/backend/src/prototype/consulta-flow.ts` y demuestra la transacción atómica end-to-end.