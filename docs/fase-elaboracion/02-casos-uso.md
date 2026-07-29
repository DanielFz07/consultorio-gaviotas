# Modelo de Casos de Uso - Consultorio Las Gaviotas

**Fase:** Elaboración (RUP)
**Notación principal:** PlantUML
**Apéndice visual:** Mermaid flowchart

**Actores:**
- **Recepcionista** (rol Recepción)
- **Médico** (rol MEDICO)
- **Administrador** (rol Admin)
- **Cliente** (actor secundario, recibe notificaciones)
- **Sistema** (actor automático: worker de recordatorios, reloj de tiempo)

---

## Diagrama General

```plantuml
@startuml
left to right direction
actor Recepcionista
actor Médico
actor Administrador
actor Cliente
actor Sistema

rectangle "Consultorio Las Gaviotas" {
  usecase "UC-01 Registrar Paciente" as UC01
  usecase "UC-02 Registrar Paciente" as UC02
  usecase "UC-03 Agendar Cita" as UC03
  usecase "UC-04 Reprogramar Cita" as UC04
  usecase "UC-05 Cancelar Cita" as UC05
  usecase "UC-06 Registrar Consulta Médica" as UC06
  usecase "UC-07 Prescribir Medicamento" as UC07
  usecase "UC-08 Adjuntar Archivo" as UC08
  usecase "UC-09 Generar Factura" as UC09
  usecase "UC-10 Gestionar Inventario" as UC10
  usecase "UC-11 Gestionar Usuarios" as UC11
  usecase "UC-12 Consultar Reportes" as UC12
  usecase "UC-13 Enviar Recordatorio" as UC13
  usecase "Autenticar Usuario" as UC00
}

Recepcionista --> UC00
Recepcionista --> UC01
Recepcionista --> UC02
Recepcionista --> UC03
Recepcionista --> UC04
Recepcionista --> UC05
Médico --> UC00
Médico --> UC06
Médico --> UC07
Médico --> UC08
Médico --> UC12
Administrador --> UC00
Administrador --> UC10
Administrador --> UC11
Administrador --> UC12
Administrador --> UC09
Sistema --> UC13
Cliente --> UC13
UC06 ..> UC07 : <<include>>
UC06 ..> UC09 : <<include>>
UC09 ..> UC10 : <<include>>
@enduml
```

---

## Caso de Uso Crítico: **UC-06 Registrar Consulta Médica**

Este es el caso más complejo por su interacción con prescripción, inventario, facturación y archivos. Se documenta con nivel de detalle *expandido*.

### Metadatos

| Campo | Valor |
|---|---|
| ID | UC-06 |
| Nombre | Registrar Consulta Médica |
| Actor primario | Médico |
| Precondiciones | Médico autenticado; cita seleccionada en estado `CONFIRMADA` o `EN_CURSO` |
| Postcondiciones | Consulta registrada con diagnóstico, prescripciones (si aplica) y factura emitida |
| Frecuencia estimada | 8-15 veces al día |
| Criticidad | Alta |

### Flujo Principal (Éxito)

| Paso | Actor | Acción |
|---|---|---|
| 1 | Médico | Selecciona la cita del día desde el panel de citas programadas |
| 2 | Sistema | Muestra datos de la cita + paciente + historial clínico resumido |
| 3 | Médico | Abre el formulario "Nueva Consulta" |
| 4 | Sistema | Despliega campos: síntomas, diagnóstico, tratamiento, observaciones |
| 5 | Médico | Ingresa síntomas observados |
| 6 | Médico | Ingresa diagnóstico |
| 7 | Médico | Selecciona servicios realizados (ej. consulta general + aplicación de vacuna) |
| 8 | Sistema | Registra cada servicio con su precio vigente y lo acumula en pre-factura |
| 9 | Médico | Opcional: agrega prescripción de uno o varios productos desde inventario |
| 10 | Sistema | Para cada producto: valida stock, descuenta cantidad y suma al acumulado de pre-factura |
| 11 | Médico | Opcional: adjunta archivos (imágenes, resultados de laboratorio) |
| 12 | Sistema | Almacena archivos en volumen y registra metadatos |
| 13 | Médico | Pulsa "Finalizar Consulta" |
| 14 | Sistema | Abre transacción SQL, persiste consulta + prescripciones + factura + items |
| 15 | Sistema | Genera número de factura correlativo, muestra resumen al médico |
| 16 | Sistema | Cambia el estado de la cita a `ATENDIDA` y de la factura a `EMITIDA` |
| 17 | Sistema | Registra entradas en el historial clínico de la paciente |

### Diagrama de Secuencia

```plantuml
@startuml
actor Médico
participant "Astro UI" as UI
participant "Elysia API" as API
database "PostgreSQL" as DB
participant "Worker SMTP" as W

Médico -> UI: 1. Selecciona cita
UI -> API: GET /api/citas/:id
API -> DB: SELECT cita+paciente+historial
DB --> API: datos
API --> UI: 200 OK

Médico -> UI: 2. Abre "Nueva Consulta"
UI -> API: POST /api/citas/:id/consulta (draft)
API -> DB: INSERT consulta
DB --> API: id
API --> UI: 201 consultaId

loop por cada servicio
  Médico -> UI: Selecciona servicio
  UI -> API: POST /api/consultas/:id/servicios
  API -> DB: SELECT precio + INSERT consulta_servicio
end

loop por cada prescripción
  Médico -> UI: Selecciona producto + cantidad
  UI -> API: POST /api/consultas/:id/prescripciones
  API -> DB: SELECT producto FOR UPDATE
  API -> DB: UPDATE stock_actual -= cant
  API -> DB: INSERT prescripcion
  DB --> API: OK o EX-011
end

opt Adjuntar archivo
  Médico -> UI: Sube archivo
  UI -> API: POST /api/consultas/:id/archivos
  API -> API: escribe ./data/uploads
  API -> DB: INSERT archivo
end

Médico -> UI: Pulsa "Finalizar Consulta"
UI -> API: POST /api/consultas/:id/finalizar
API -> DB: BEGIN TRANSACTION
API -> DB: factura + items
API -> DB: UPDATE cita estado=ATENDIDA
API -> DB: INSERT evento_clinico
API -> DB: COMMIT
API --> UI: { consulta, factura }
API -> W: enqueue recordatorio si próxima cita
@enduml
```

### Diagrama de Secuencia

```plantuml
@startuml
skinparam sequenceArrowThickness 2
participant "Médico" as V
participant "Astro UI" as UI
participant "Elysia API" as API
participant "PostgreSQL" as DB
V ->> UI : Selecciona cita
UI ->> API : GET /api/citas/:id
API ->> DB : SELECT cita+paciente
DB -->> API : datos
API -->> UI : 200 OK
V ->> UI : Inicia consulta
UI ->> API : POST /api/citas/:id/consulta
API ->> DB : INSERT consulta
DB -->> API : consultaId
API -->> UI : 201
loop Servicios
V ->> UI : + Servicio
UI ->> API : POST /api/consultas/:id/servicios
API ->> DB : INSERT consulta_servicio
loop Prescripciones
V ->> UI : + Producto + cantidad
UI ->> API : POST /api/consultas/:id/prescripciones
API ->> DB : SELECT producto FOR UPDATE
alt Stock suficiente
API ->> DB : UPDATE stock -= cant
API ->> DB : INSERT prescripcion
else Stock insuficiente
DB -->> API : EX-011
API -->> UI : 409 conflicto
V ->> UI : Finalizar consulta
UI ->> API : POST /api/consultas/:id/finalizar
API ->> DB : BEGIN TRANSACTION
API ->> DB : INSERT factura + items
API ->> DB : UPDATE cita = ATENDIDA
API ->> DB : INSERT evento_clinico
API ->> DB : COMMIT
DB -->> API : OK
API -->> UI : 200 { consulta, factura }
@enduml
```

### Flujos Alternativos

**A1 - Stock insuficiente (paso 10):**
- 10a. Sistema detecta que el stock del producto es menor a la cantidad solicitada.
- 10b. Muestra alerta indicando: producto, stock disponible, cantidad solicitada.
- 10c. Médico decide: (i) ajustar cantidad al stock disponible, (ii) seleccionar otro producto, (iii) posponer prescripción.
- 10d. Si acepta (i), continúa con la cantidad ajustada.

**A2 - Cancelar consulta en curso (paso 13):**
- 13a. Médico pulsa "Cancelar".
- 13b. Sistema requiere confirmación.
- 13c. Si confirma: cita queda en estado `NO_ATENDIDA`, no se genera factura, se libera inventario (rollback), se registra motivo en bitácora.

**A3 - Error al adjuntar archivo (paso 11):**
- 11a. Sistema falla al guardar el archivo (disco lleno, permisos).
- 11b. Muestra mensaje de error específico del catálogo de excepciones.
- 11c. Médico puede reintentar o continuar sin el archivo (consulta no se bloquea).

### Reglas de Negocio

| Código | Regla |
|---|---|
| RN-01 | Una cita solo puede generar una consulta |
| RN-02 | Una consulta puede registrar N prescripciones, pero cada prescripción referencia exactamente un producto |
| RN-03 | El descuento de inventario debe ser atómico (transacción); si falla algo, se hace rollback completo |
| RN-04 | La factura no se puede eliminar una vez emitida; solo anular (requiere rol Administrador) |
| RN-05 | El historial clínico de la paciente se actualiza de forma automática al cerrar la consulta |
| RN-06 | El número de factura es correlativo y único por clínica, sin reinicios |
| RN-07 | La sesión del médico debe estar activa para acceder al flujo |

### Casos de Uso Incluidos / Extendidos

- `<<include>>` UC-07 Prescribir Medicamento (paso 9-10)
- `<<include>>` UC-08 Adjuntar Archivo (paso 11)
- `<<include>>` UC-09 Generar Factura (paso 14-16)
- `<<extend>>` A1 Stock Insuficiente (paso 10)

### Especificación de Interfaces (extracto para Elysia)

```
POST   /api/citas/:id/consulta
       Body: { sintomas, diagnostico, tratamiento, observaciones }
       Roles: médico
       Crea consulta en estado "borrador" vinculada a la cita

POST   /api/consultas/:id/prescripciones
       Body: { productoId, cantidad, dosis, frecuencia, duracion }
       Roles: médico
       Descuenta stock atómicamente y suma al acumulado

POST   /api/consultas/:id/servicios
       Body: { servicioId, cantidad }
       Roles: médico
       Registra servicio en consulta con precio vigente

POST   /api/consultas/:id/archivos
       Body: multipart/form-data
       Roles: médico
       Almacena archivo en ./data/uploads y registra metadatos

POST   /api/consultas/:id/finalizar
       Roles: médico
       Cierra transacción: persiste consulta, prescripciones, factura, items, actualiza historial
       Respuesta: { consulta, factura, items }
```
