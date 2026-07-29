# Diagrama ER (Modelo Físico) - Consultorio Las Gaviotas

**Fase:** Elaboración
**Generado desde:** `db/migrations/0001_init.sql`
**Notación:** Mermaid `erDiagram`
**Propósito:** Vista rápida para el profesor sin abrir herramienta UML.

---

```plantuml
@startuml
  entity USUARIO {
    id : INTEGER <<PK>>
    username : VARCHAR(50) <<UNIQUE>>
    password_hash : VARCHAR(255)
    nombre : VARCHAR(120)
    email : VARCHAR(120)
    rol : VARCHAR(20) <<'ADMIN|MEDICO|RECEPCION'>>
    activo : BOOLEAN
    created_at : TIMESTAMP
  }


  entity DUENO {
    id : INTEGER <<PK>>
    dni : VARCHAR(20) <<UNIQUE>>
    nombre : VARCHAR(120)
    apellido : VARCHAR(120)
    telefono : VARCHAR(30)
    email : VARCHAR(120)
    direccion : TEXT
    activo : BOOLEAN
  }


  entity MASCOTA {
    id : INTEGER <<PK>>
    paciente_id : INTEGER <<FK>>
    nombre : VARCHAR(120)
    sexo : VARCHAR(60)
    antecedente relevante : VARCHAR(60)
    fecha_nacimiento : DATE
    sexo : VARCHAR(20) <<'MACHO|HEMBRA|DESCONOCIDO'>>
    talla_cm : DECIMAL
    cédula : VARCHAR(60) <<UNIQUE>>
    observaciones : TEXT
    activo : BOOLEAN
  }


  entity HISTORIAL_CLINICO {
    id : INTEGER <<PK>>
    paciente_id : INTEGER <<UNIQUE>> <<FK>>
    fecha_apertura : DATE
    notas_generales : TEXT
    cerrado : BOOLEAN
  }


  entity ENTRADA_HISTORIAL {
    id : INTEGER <<PK>>
    historial_id : INTEGER <<FK>>
    fecha : TIMESTAMP
    tipo : VARCHAR(60)
    descripcion : TEXT
    autor_id : INTEGER <<FK>>
  }


  entity CITA {
    id : INTEGER <<PK>>
    paciente_id : INTEGER <<FK>>
    medico_id : INTEGER <<FK>>
    fecha : DATE
    hora_inicio : VARCHAR(20)
    hora_fin : VARCHAR(20)
    tipo_servicio : VARCHAR(20) <<'CONSULTA|INMUNIZACIÓN|PROCEDIMIENTO|...'>>
    motivo : TEXT
    estado : VARCHAR(20) <<'PROGRAMADA|CONFIRMADA|EN_CURSO|ATENDIDA|CANCELADA|NO_ASISTIO'>>
  }


  entity SERVICIO {
    id : INTEGER <<PK>>
    codigo : VARCHAR(20) <<UNIQUE>>
    nombre : VARCHAR(120)
    precio : DECIMAL
    duracion_minutos : INTEGER
    activo : BOOLEAN
  }


  entity PRODUCTO {
    id : INTEGER <<PK>>
    sku : VARCHAR(40) <<UNIQUE>>
    nombre : VARCHAR(120)
    unidad : VARCHAR(20)
    precio_venta : DECIMAL
    stock_actual : INTEGER
    stock_minimo : INTEGER
    activo : BOOLEAN
  }


  entity CONSULTA {
    id : INTEGER <<PK>>
    cita_id : INTEGER <<UNIQUE>> <<FK>>
    paciente_id : INTEGER <<FK>>
    medico_id : INTEGER <<FK>>
    fecha_hora : TIMESTAMP
    sintomas : TEXT
    diagnostico : TEXT
    tratamiento : TEXT
  }


  entity CONSULTA_SERVICIO {
    id : INTEGER <<PK>>
    consulta_id : INTEGER <<FK>>
    servicio_id : INTEGER <<FK>>
    cantidad : INTEGER
    precio_cobrado : DECIMAL
  }


  entity PRESCRIPCION {
    id : INTEGER <<PK>>
    consulta_id : INTEGER <<FK>>
    producto_id : INTEGER <<FK>>
    cantidad : INTEGER
    dosis : VARCHAR(120)
    frecuencia : VARCHAR(120)
    duracion : VARCHAR(120)
    precio_unitario_cobrado : DECIMAL
  }


  entity FACTURA {
    id : INTEGER <<PK>>
    numero : VARCHAR(20) <<UNIQUE>>
    consulta_id : INTEGER <<UNIQUE>> <<FK>>
    paciente_id : INTEGER <<FK>>
    fecha_emision : TIMESTAMP
    subtotal : DECIMAL
    impuestos : DECIMAL
    total : DECIMAL
    estado : VARCHAR(20) <<'EMITIDA|PAGADA|ANULADA'>>
  }


  entity ITEM_FACTURA {
    id : INTEGER <<PK>>
    factura_id : INTEGER <<FK>>
    tipo : VARCHAR(20) <<'SERVICIO|PRODUCTO'>>
    ref_id : INTEGER
    descripcion : VARCHAR(255)
    cantidad : DECIMAL
    precio_unitario : DECIMAL
    subtotal : DECIMAL
  }


  entity ARCHIVO {
    id : INTEGER <<PK>>
    paciente_id : INTEGER <<FK>>
    consulta_id : INTEGER <<FK>>
    nombre : VARCHAR(255)
    path : VARCHAR(500)
    mime : VARCHAR(100)
    size_bytes : BIGINT
    uploaded_by : INTEGER <<FK>>
    uploaded_at : TIMESTAMP
  }


  entity NOTIFICACION {
    id : INTEGER <<PK>>
    cita_id : INTEGER <<FK>>
    canal : VARCHAR(20) <<'EMAIL|SMS'>>
    estado : VARCHAR(20) <<'PENDIENTE|ENVIADA|FALLIDA'>>
    payload : TEXT
    enviado_at : TIMESTAMP
  }


  USUARIO ||--o{ CITA : atiende
  USUARIO ||--o{ CONSULTA : firma
  USUARIO ||--o{ PRESCRIPCION : "autor (no FK directa)"
  DUENO ||--o{ MASCOTA : posee
  DUENO ||--o{ FACTURA : recibe
  MASCOTA ||--|| HISTORIAL_CLINICO : tiene
  MASCOTA ||--o{ CITA : agenda
  MASCOTA ||--o{ CONSULTA : atendida
  MASCOTA ||--o{ ARCHIVO : adjunto
  HISTORIAL_CLINICO ||--o{ ENTRADA_HISTORIAL : registra
  CITA ||--o| CONSULTA : origina
  CITA ||--o{ NOTIFICACION : dispara
  CITA ||--o| FACTURA : "consulta genera"
  CONSULTA ||--o{ CONSULTA_SERVICIO : incluye
  CONSULTA ||--o{ PRESCRIPCION : emite
  CONSULTA ||--o{ ARCHIVO : adjunta
  SERVICIO ||--o{ CONSULTA_SERVICIO : "ofrecido en"
  PRODUCTO ||--o{ PRESCRIPCION : "prescrito"
  FACTURA ||--o{ ITEM_FACTURA : contiene
@enduml
```

---

## Índices relevantes

| Tabla | Índice | Finalidad |
|---|---|---|
| cita | `uq_cita_slot_medico` | Evita doble reserva por médico en mismo slot |
| producto | `ix_producto_stock_bajo` | Alertas de stock mínimo |
| consulta | `ix_consulta_paciente` | Vista historial clínico por paciente |
| factura | `ix_factura_paciente` | Reportes por cliente |
| item_factura | `ix_item_factura_factura` | Detalle de factura rápido |
| notificacion | `ix_notificacion_estado_envio` | Cola de envío del worker |
