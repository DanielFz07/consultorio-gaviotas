# Flujo Completo "Día en la Clínica" - Consultorio Las Gaviotas

**Fase:** Elaboración (modelo) → Transición (ejecución demo)
**Propósito:** Diagrama end-to-end del escenario que se demostrará al profesor.
**Notación:** PlantUML

Este flujo cubre el ciclo completo desde que un cliente llega a la clínica hasta que paga y se marcha, pasando por los tres roles del sistema.

---

## Actores participantes en el escenario

- **Paciente)
- **Recepción** (operador de mostrador)
- **Médico** (atiende consulta)
- **Caja** (rol Recepción con permisos de cobro)
- **Sistema** (worker de recordatorios)

---

## Flujo Narrativo

| # | Hora | Quien | Qué pasa |
|---|---|---|---|
| 1 | 09:00 | Sistema | Envía recordatorio automático de cita del día |
| 2 | 09:30 | Paciente Luna (sin cita previa) |
| 3 | 09:30 | Recepción | Verifica si Luna está registrada; no, la registra + al paciente |
| 4 | 09:35 | Recepción | Agenda cita en slot libre con Dr. Carlos Pérez |
| 5 | 09:50 | Recepción | Confirma cita, sistema agenda recordatorio |
| 6 | 10:00 | Médico | Atiende a Luna, abre consulta desde cita |
| 7 | 10:05 | Médico | Registra síntomas y diagnóstico |
| 8 | 10:10 | Médico | Selecciona servicio "Consulta general" |
| 9 | 10:12 | Médico | Prescribe medicamento X (3 unidades, 5 días) |
| 10 | 10:13 | Sistema | Descuenta stock atómicamente, valida sin faltantes |
| 11 | 10:14 | Médico | Adjunta imagen de radiografía |
| 12 | 10:15 | Médico | Pulsa "Finalizar consulta" |
| 13 | 10:15 | Sistema | Persiste consulta, factura EMITIDA, historial actualizado |
| 14 | 10:20 | Cliente | Pasa a caja a pagar |
| 15 | 10:20 | Caja | Cobra factura, marca como PAGADA |
| 16 | 10:25 | Paciente, prescripción y factura |
| 17 | 10:25 | Sistema | Notifica al cliente email con resumen |
| 18 | fin día | Admin | Consulta reporte diario de atenciones |

---

## Diagrama de Actividad General

```plantuml
@startuml
|Cliente|
|Recep|
|Médico|
|Caja|
|Sistema|

|Cliente|
:09:30 - Llega a clínica;

|Recep|
:Verifica paciente;

if (Existe?) then (no)
  :Registra al paciente;
  :Asocia a paciente;
endif

:Agenda cita en slot libre;
:Sistema valida y crea cita;

|Cliente|
:Espera en sala;

|Sistema|
:09:00 - Envía recordatorio cita del día;

|Médico|
:10:00 - Inicia consulta desde cita;
:Registra síntomas;
:Registra diagnóstico;

:Agrega servicios realizados;
:Sistema congela precios;

:Prescribe medicamento;

|Sistema|
:BEGIN TRANSACTION;
:SELECT producto FOR UPDATE;

if (stock suficiente?) then (sí)
  :UPDATE stock_actual -= cant;
  :INSERT prescripcion;
else (no)
  :ROLLBACK;
  :EX-011;
  stop
endif

:Médico adjunta archivo;
:Médico finaliza consulta;

|Caja|
:BEGIN / Sigue transacción;
:Calcula subtotal;
:Aplica impuestos;
:Crea factura (EMITIDA);
:Inserta item_factura (servicios + productos);
:UPDATE cita = ATENDIDA;
:INSERT evento_clinico;
:COMMIT;

|Cliente|
:Pasa a caja;

|Caja|
:Cobra factura;
:UPDATE factura = PAGADA;

|Sistema|
:10:25 - Email resumen al cliente;

|Cliente|
:Se marcha con paciente + prescripción + factura;

@enduml
```

---

## Diagrama de Secuencia Completo

```plantuml
@startuml
actor Cliente
actor Recep as R
actor Médico as V
actor Caja as K
participant UI
participant API
database DB
participant Worker

== Registro y Cita ==
R -> UI: Buscar paciente por cédula
UI -> API: GET /api/pacientes?cedula=
API -> DB: SELECT
DB --> API: resultado
API --> UI: 200 (no existe)
R -> UI: Registra paciente
UI -> API: POST /api/pacientes
API -> DB: INSERT paciente
DB --> API: pacienteId
R -> UI: Registra paciente
UI -> API: POST /api/pacientes
API -> DB: INSERT paciente
R -> UI: Agenda cita
UI -> API: POST /api/citas
API -> DB: validar slot + INSERT cita
API -> Worker: schedule recordatorio
API --> UI: 201 citaId

== Atención Médica ==
Cliente -> V: pasa a consulta
V -> UI: abre consulta desde cita
UI -> API: POST /api/citas/:id/consulta
API -> DB: INSERT consulta (borrador)
DB --> API: consultaId

V -> UI: + Servicio "Consulta General"
UI -> API: POST /api/consultas/:id/servicios
API -> DB: SELECT precio + INSERT

V -> UI: + Producto "Antibiótico X" cant=3
UI -> API: POST /api/consultas/:id/prescripciones
API -> DB: BEGIN; SELECT FOR UPDATE producto
API -> DB: stock >= 3 ? si
API -> DB: UPDATE stock -= 3; INSERT prescripcion

V -> UI: + Archivo radiografia.png
UI -> API: POST /api/consultas/:id/archivos
API -> API: escribe ./data/uploads/x.png
API -> DB: INSERT archivo

V -> UI: Finalizar consulta
UI -> API: POST /api/consultas/:id/finalizar
API -> DB: BEGIN TRANSACTION
API -> DB: SELECT SUM servicios + SUM prescripciones = subtotal
API -> DB: subtotal * 0.16 = impuestos
API -> DB: INSERT factura (EMITIDA)
API -> DB: INSERT item_factura servicios
API -> DB: INSERT item_factura productos
API -> DB: UPDATE cita = ATENDIDA
API -> DB: INSERT evento_clinico
API -> DB: COMMIT
API --> UI: 200 {consulta, factura}

== Cobro ==
Cliente -> K: presenta para pago
K -> UI: ver factura
UI -> API: GET /api/facturas/:id
K -> UI: marcar pagada
UI -> API: POST /api/facturas/:id/pagar
API -> DB: UPDATE estado = PAGADA
API -> Worker: enqueue email resumen
Worker -> Cliente: envía email con factura

@enduml
```

---

## Puntos críticos cubiertos (mapeo a reglas de negocio)

| RN | Punto en el flujo |
|---|---|
| RN-01 | Una cita solo origina una consulta (transacción de `Finalizar`) |
| RN-02 | N prescripciones por consulta, una por producto |
| RN-03 | Stock descontado dentro de BEGIN/COMMIT |
| RN-04 | Factura no se elimina, se anula (no aplica aquí porque es flujo feliz) |
| RN-05 | Historial clínico actualizado automáticamente |
| RN-06 | Número de factura correlativo vía `factura_numero_seq` |
| RN-07 | Sesión activa exigida en cada request (validado por middleware JWT) |
| RN-08 | Validación de slot único (uq_cita_slot_medico) |
| RN-09 | Motivo oblirio al agendar |
| RN-11 | No se cancelan citas ATENDIDAS |

---

## Variantes a demostrar en la presentación

| Variante                    | Cómo se demuestra                                                 |
| --------------------------- | ----------------------------------------------------------------- |
| **Cliente con cita previa** | Saltar al paso de Atención, omitir Registro                       |
| **Cancelación**             | Mostrar UC-05 antes de atención                                   |
| **Stock bajo**              | Provocar EX-011 mostrando mensaje al médico                  |
| **Reprogramación**          | Cliente llama para cambiar hora, Recep usa UC-04                  |
| **Anulación factura**       | Admin corrige cobro, factura pasa a ANULADA con nuevo comprobante |
