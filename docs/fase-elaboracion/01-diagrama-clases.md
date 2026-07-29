# Diagrama de Clases - Consultorio Las Gaviotas

**Fase:** Elaboración (RUP)
**Notación:** PlantUML

---

## Diagrama de Clases

```plantuml
@startuml
title Diagrama de Clases - Modelo de Dominio
skinparam classAttributeIconSize 0
skinparam nodesep 60
skinparam ranksep 50
skinparam maxMessageSize 100
hide circle
hide methods

class Paciente {
  +id: number
  +dni: string
  +nombre: string
  +apellido: string
  +telefono: string
  +email: string
  +direccion: string
  +fechaNacimiento: Date
  +sexo: string
  +pesoKg: decimal
  +antecedentes: text
  +activo: boolean
}

class HistorialClinico {
  +id: number
  +fechaApertura: Date
  +notasGenerales: text
  +cerrado: boolean
}

class EntradaHistorial {
  +id: number
  +fecha: Date
  +tipo: string
  +descripcion: text
  +autorId: number
}

class Cita {
  +id: number
  +fecha: Date
  +horaInicio: time
  +horaFin: time
  +tipoServicio: string
  +motivo: text
  +estado: string
}

class Consulta {
  +id: number
  +sintomas: text
  +diagnostico: text
  +tratamiento: text
  +fechaHora: timestamp
}

class Prescripcion {
  +id: number
  +cantidad: number
  +dosis: string
  +frecuencia: string
  +duracion: string
}

class Producto {
  +id: number
  +nombre: string
  +unidad: string
  +stockActual: number
  +stockMinimo: number
  +precioVenta: decimal
  +activo: boolean
}

class Servicio {
  +id: number
  +nombre: string
  +precio: decimal
  +duracionMinutos: number
  +activo: boolean
}

class ConsultaServicio {
  +id: number
  +precioCobrado: decimal
}

class Factura {
  +id: number
  +numero: string
  +fechaEmision: timestamp
  +subtotal: decimal
  +impuestos: decimal
  +total: decimal
  +estado: string
}

class ItemFactura {
  +id: number
  +tipo: string
  +descripcion: string
  +cantidad: decimal
  +precioUnitario: decimal
  +subtotal: decimal
}

class Archivo {
  +id: number
  +path: string
  +nombre: string
  +mime: string
  +sizeBytes: number
  +uploadedAt: timestamp
}

class Usuario {
  +id: number
  +username: string
  +rol: string
  +nombre: string
  +activo: boolean
}

class Notificacion {
  +id: number
  +canal: string
  +estado: string
  +enviadoAt: timestamp
  +payload: text
}

' Relaciones con multiplicidad estricta
Paciente "1" *-- "1" HistorialClinico : tiene >
HistorialClinico "1" *-- "1..*" EntradaHistorial : registra >
Paciente "1" *-- "0..*" Cita : agenda >
Cita "1" -- "0..1" Consulta : origina >
Consulta "1" *-- "1..*" Prescripcion : emite >
Consulta "1" *-- "1..*" ConsultaServicio : incluye >
Prescripcion "1..*" --> "1" Producto : referencia >
ConsultaServicio "1..*" --> "1" Servicio : referencia >
Consulta "1" -- "0..1" Factura : genera >
Factura "1" *-- "1..*" ItemFactura : contiene >
Paciente "1" -- "0..*" Archivo : almacena >
Consulta "1" -- "0..*" Archivo : adjunta >
Usuario "1" -- "0..*" Cita : atiendeComoMédico >
Usuario "1" -- "0..*" Consulta : firma >
Cita "1" -- "0..*" Notificacion : dispara >

@enduml
```

---

## Multiplicidad (cardinalidad) explícita

| Relación | Multiplicidad | Lectura |
|---|---|---|
| Paciente → HistorialClínico | `1` a `1` | Cada paciente tiene exactamente un historial clínico |
| Historial → Entrada | `1` a `1..*` | Un historial registra una o varias entradas a lo largo del tiempo |
| Paciente → Cita | `1` a `0..*` | Una paciente puede tener ninguna o varias citas |
| Cita → Consulta | `1` a `0..1` | Una cita origina a lo sumo una consulta |
| Consulta → Prescripción | `1` a `1..*` | Una consulta puede tener una o varias prescripciones |
| Consulta → Servicio | `1` a `1..*` | Una consulta puede incluir uno o varios servicios |
| Prescripción → Producto | `*..1` a `1` | Una prescripción referencia exactamente un producto |
| Consulta → Servicio (vía ConsultaServicio) | `*..1` a `1` | Asociación N:M controlada con atributos |
| Consulta → Factura | `1` a `0..1` | Una consulta origina a lo sumo una factura |
| Factura → ItemFactura | `1` a `1..*` | Una factura contiene uno o varios ítems |
| Usuario (rol MEDICO) → Cita | `1` a `0..*` | Un médico atiende varias citas |
| Usuario (rol MEDICO) → Consulta | `1` a `0..*` | Un médico firma varias consultas |

---

## Notas de Diseño

- **Usuario** generaliza los tres roles (Administrador, Médico, Recepción). El atributo `rol` decide permisos vía RBAC.
- **HistorialClinico** se modela como entidad independiente 1:1 con Paciente para permitir metadata (fecha apertura, notas generales, estado activo/cerrado). Las **entradas** individuales se almacenan en `EntradaHistorial`.
- **ConsultaServicio** materializa la relación N:M entre Consulta y Servicio, permitiendo guardar el precio histórico por si el servicio cambia de tarifa.
- **ItemFactura** cubre tanto servicios como productos consumidos; el campo `tipo` discrimina (`SERVICIO` | `PRODUCTO`).
- Las **prescripcións/prescripciones** se almacenan explícitamente (no se infieren de ItemFactura) porque requieren datos clínicos (dosis, frecuencia, duración) que no son propios de una factura.
- **Atributos `createdAt`/`updatedAt`**: presentes en todas las tablas para auditoría, omitidos del diagrama para reducir ruido visual (ver `db/migrations/0001_init.sql` para la definición completa).
