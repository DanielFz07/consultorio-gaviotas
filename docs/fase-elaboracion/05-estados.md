# Máquinas de Estado - Consultorio Las Gaviotas

**Fase:** Elaboración
**Propósito:** Documentar el ciclo de vida de las entidades con estados explícitos.
**Notación:** PlantUML

---

## Estados de `Cita`

```plantuml
@startuml
[*] --> PROGRAMADA : recepcionista agenda
PROGRAMADA --> CONFIRMADA : cliente confirma / recordatorio enviado OK
PROGRAMADA --> CANCELADA : cliente cancela
PROGRAMADA --> NO_ASISTIO : no llega tras 15 min
CONFIRMADA --> EN_CURSO : médico abre consulta
CONFIRMADA --> CANCELADA : cliente cancela
CONFIRMADA --> NO_ASISTIO : no llega
EN_CURSO --> ATENDIDA : consulta finalizada y facturada
EN_CURSO --> CANCELADA : médico cancela (rollback)
ATENDIDA --> [*]
CANCELADA --> [*]
NO_ASISTIO --> [*]

note right of CANCELADA
  Cancelación desde EN_CURSO
  requiere rollback de
  prescripciones y no genera factura.
end note
@enduml
```

**Transiciones válidas (tabla):**

| Origen | Destino | Disparador | Actor |
|---|---|---|---|
| (ninguno) | PROGRAMADA | INSERT inicial | Recepción |
| PROGRAMADA | CONFIRMADA | Sistema (recordatorio enviado OK) o Recepción manual | Sistema / Recepción |
| PROGRAMADA | CANCELADA | Cancelación | Recepción / Cliente |
| PROGRAMADA | NO_ASISTIO | Tarea programada (15 min post slot) | Sistema |
| CONFIRMADA | EN_CURSO | Médico abre consulta | Médico |
| CONFIRMADA | CANCELADA | Cancelación | Recepción / Cliente |
| CONFIRMADA | NO_ASISTIO | Tarea programada | Sistema |
| EN_CURSO | ATENDIDA | `POST /finalizar` exitoso | Médico |
| EN_CURSO | CANCELADA | Botón "cancelar consulta" con confirmación | Médico |

---

## Estados de `Consulta`

```plantuml
@startuml
[*] --> BORRADOR : médico abre consulta
BORRADOR --> BORRADOR : +servicio / +prescripcion / +archivo
BORRADOR --> FINALIZADA : POST /finalizar (BEGIN/COMMIT OK)
BORRADOR --> CANCELADA : médico cancela
FINALIZADA --> [*]
CANCELADA --> [*]

note right of FINALIZADA
  Estado terminal.
  Dispara: factura EMITIDA,
  UPDATE cita=ATENDIDA,
  INSERT evento_clinico
end note

note left of BORRADOR
  No se descuenta stock
  hasta finalizar.
  Stock reservado virtualmente.
end note
@enduml
```

---

## Estados de `Factura`

```plantuml
@startuml
[*] --> EMITIDA : al finalizar consulta
EMITIDA --> PAGADA : recepcion cobra
EMITIDA --> ANULADA : admin anula
PAGADA --> ANULADA : admin reversa (caso especial)
ANULADA --> [*]
PAGADA --> [*]

note right of ANULADA
  Mantiene auditoría.
  No se elimina.
  Solo rol Admin (RN-04).
end note
@enduml
```

---

## Estados de `Producto` (stock)

```plantuml
@startuml
[*] --> DISPONIBLE : alta de producto
DISPONIBLE --> STOCK_BAJO : stock_actual <= stock_minimo
STOCK_BAJO --> DISPONIBLE : reposicion (UPDATE stock +=)
DISPONIBLE --> AGOTADO : stock_actual = 0
STOCK_BAJO --> AGOTADO : stock_actual = 0
AGOTADO --> DISPONIBLE : reposicion
DISPONIBLE --> INACTIVO : admin desactiva
INACTIVO --> [*]
STOCK_BAJO --> INACTIVO
AGOTADO --> INACTIVO
@enduml
```

---

## Estados de `Notificacion`

```plantuml
@startuml
[*] --> PENDIENTE : al crear cita
PENDIENTE --> ENVIADA : SMTP 2xx
PENDIENTE --> FALLIDA : SMTP error / timeout
FALLIDA --> PENDIENTE : worker reintenta (max 3, backoff)
FALLIDA --> DESCARTADA : excede reintentos + manual
ENVIADA --> [*]
DESCARTADA --> [*]
@enduml
```
