# Modelo de Dominio del Sistema — Consultorio Las Gaviotas

**Versión:** 1.0
**Estado:** Aprobado · Fase de Inicio (RUP)
**Producto:** Sistema de Información Automatizado para la Gestión de Registro y Orden de Pacientes en C.A Consultorio Médico Las Gaviotas

---

## 1. Propósito

El **Modelo de Dominio** describe la descomposición funcional del sistema en módulos y submódulos, estableciendo la frontera entre las áreas del consultorio que el sistema cubre. Es el mapa jerárquico que guía:

- El diseño de navegación (sidebar / nav strip).
- La estructura de URLs y rutas del backend.
- La organización de los equipos de desarrollo en iteraciones.

---

## 2. Diagrama jerárquico

```mermaid
graph LR
    Sistema["Sistema de Información<br/>Consultorio Las Gaviotas"]

    Sistema --> M1["Módulo 1<br/>Seguridad y Acceso"]
    Sistema --> M2["Módulo 2<br/>Registro Clínico"]
    Sistema --> M3["Módulo 3<br/>Agenda y Atención"]
    Sistema --> M4["Módulo 4<br/>Inventario y Catálogo"]
    Sistema --> M5["Módulo 5<br/>Facturación"]
    Sistema --> M6["Módulo 6<br/>Auditoría y Reportes"]
    Sistema --> M7["Módulo 7<br/>Administración del Sistema"]

    M1 --> M1a["Login / Logout"]
    M1 --> M1b["Roles y Permisos"]
    M1 --> M1c["Sesión JWT"]

    M2 --> M2a["Registro de Pacientes"]
    M2 --> M2b["Búsqueda y Filtros"]
    M2 --> M2c["Historia Clínica"]
    M2 --> M2d["Antecedentes y Alergias"]

    M3 --> M3a["Agenda de Citas"]
    M3 --> M3b["Atención de Consulta"]
    M3 --> M3c["Prescripciones Médicas"]
    M3 --> M3d["Archivos Adjuntos"]

    M4 --> M4a["Catálogo de Servicios"]
    M4 --> M4b["Inventario de Productos"]
    M4 --> M4c["Alertas de Stock Bajo"]

    M5 --> M5a["Generación de Factura"]
    M5 --> M5b["Cobro y Anulación"]
    M5 --> M5c["Reportes Financieros"]

    M6 --> M6a["Logs de Auditoría"]
    M6 --> M6b["Reportes Operacionales"]
    M6 --> M6c["Exportación a PDF"]

    M7 --> M7a["Gestión de Usuarios"]
    M7 --> M7b["Backup y Restauración"]
    M7 --> M7c["Parámetros del Sistema"]

    classDef modulo fill:#f5f1e8,stroke:#a07c3e,stroke-width:2px,color:#0f1d3d
    classDef submodulo fill:#faf7f0,stroke:#e6dfd1,color:#1a1a1a
    class Sistema modulo
    class M1,M2,M3,M4,M5,M6,M7 modulo
    class M1a,M1b,M1c,M2a,M2b,M2c,M2d,M3a,M3b,M3c,M3d,M4a,M4b,M4c,M5a,M5b,M5c,M6a,M6b,M6c,M7a,M7b,M7c submodulo
```

---

## 3. Descripción de cada módulo

### Módulo 1 — Seguridad y Acceso

Controla quién puede usar el sistema y qué puede hacer. Es transversal: todos los demás módulos dependen de él.

| Submódulo | Función | Roles |
|---|---|---|
| Login / Logout | Autenticación con usuario + contraseña, sesión JWT de 8h | Todos |
| Roles y Permisos | Define ADMIN, MEDICO, RECEPCION con permisos granulares | ADMIN gestiona |
| Sesión JWT | Token HS256 con expiración, validado en cada request | Sistema |

**Endpoints REST principales:** `POST /api/auth/login`, `GET /api/auth/me`

---

### Módulo 2 — Registro Clínico

Gestiona la información clínica del paciente (persona atendida). Es la fuente de verdad del sistema.

| Submódulo | Función | Roles |
|---|---|---|
| Registro de Pacientes | Alta de personas con cédula, nombre, fecha nac., contacto | RECEPCION, ADMIN |
| Búsqueda y Filtros | Búsqueda por nombre, apellido, cédula, fecha nac. | Todos |
| Historia Clínica | Apertura automática al registrar, una por paciente | MEDICO, ADMIN |
| Antecedentes y Alergias | Texto libre por paciente, editado por médico | MEDICO, ADMIN |

**Endpoints REST principales:** `GET/POST/PATCH/DELETE /api/pacientes`, `GET /api/pacientes/:id`

---

### Módulo 3 — Agenda y Atención

Gestiona la programación de citas y el acto médico (consulta + prescripción).

| Submódulo | Función | Roles |
|---|---|---|
| Agenda de Citas | Alta, reprogramación, cancelación con validación de slot único | RECEPCION, ADMIN |
| Atención de Consulta | Apertura desde cita, síntomas/diagnóstico/tratamiento | MEDICO, ADMIN |
| Prescripciones Médicas | Medicamentos con dosis, frecuencia, duración | MEDICO |
| Archivos Adjuntos | PDFs de laboratorio, imágenes, subidos a la consulta | MEDICO |

**Endpoints REST principales:** `GET/POST/PATCH /api/citas`, `POST /api/citas/:id/consulta`, `PATCH /api/citas/:id/cancelar`

---

### Módulo 4 — Inventario y Catálogo

Administra el catálogo de prestaciones y el stock de medicamentos/insumos.

| Submódulo | Función | Roles |
|---|---|---|
| Catálogo de Servicios | CRUD de prestaciones (consulta, control, examen, procedimiento) | ADMIN |
| Inventario de Productos | CRUD de productos con stock actual y mínimo | ADMIN |
| Alertas de Stock Bajo | Aviso cuando stock_actual ≤ stock_minimo | Sistema (aut.) + visual |

**Endpoints REST principales:** `GET/POST/PATCH /api/servicios`, `GET/POST/PATCH /api/productos`, `GET /api/productos?bajoStock=true`

---

### Módulo 5 — Facturación

Genera, cobra y anula facturas a partir de las consultas atendidas.

| Submódulo | Función | Roles |
|---|---|---|
| Generación de Factura | Automática al finalizar consulta (número correlativo) | Sistema (aut.) |
| Cobro y Anulación | Marca PAGADA o ANULADA con motivo | RECEPCION, ADMIN |
| Reportes Financieros | Ingresos del día, mes, por médico | ADMIN |

**Endpoints REST principales:** `GET /api/facturas`, `GET /api/facturas/:id`, `POST /api/facturas/:id/pagar`

---

### Módulo 6 — Auditoría y Reportes

Trazabilidad de operaciones y exportación de información.

| Submódulo | Función | Roles |
|---|---|---|
| Logs de Auditoría | Tabla `audit_log` con usuario, acción, tabla, IP, timestamp | ADMIN |
| Reportes Operacionales | Pacientes, citas, consultas con filtros | ADMIN, MEDICO |
| Exportación a PDF | Render con wkhtmltopdf, filtros aplicables | Todos |

**Endpoints REST principales:** `GET /api/audit/logs`, `GET /api/audit/logins`, `GET /api/audit/stats`, `GET /api/reportes/*/pdf`

---

### Módulo 7 — Administración del Sistema

Configuración del sistema, gestión de cuentas y mantenimiento de BD.

| Submódulo | Función | Roles |
|---|---|---|
| Gestión de Usuarios | CRUD de cuentas con roles y reset de contraseña | ADMIN |
| Backup y Restauración | pg_dump / pg_restore con interfaz web | ADMIN |
| Parámetros del Sistema | Tasa de impuesto, datos del consultorio | ADMIN |

**Endpoints REST principales:** `GET/POST/PATCH/DELETE /api/usuarios`, `POST /api/mantenimiento/backup`, `POST /api/mantenimiento/restore`

---

## 4. Mapeo Módulo → Iteración de Construcción

El proyecto se entrega en tres iteraciones siguiendo la lógica de dependencias técnicas:

| Iteración | Módulos incluidos | Entregable |
|---|---|---|
| **Iteración 1** | M1, M2, M3 (parcial: citas) | Pacientes + agenda funcional |
| **Iteración 2** | M3 (consulta), M4, M5 | Consulta médica completa + facturación |
| **Iteración 3** | M6, M7 | Auditoría + reportes + mantenimiento |

Documentación de cada iteración en `docs/fase-construccion/iteracion-*.md`.

---

## 5. Mapeo Módulo → Rutas del Frontend

| Módulo | Rutas principales |
|---|---|
| M1 | `/login`, `/logout` |
| M2 | `/pacientes`, `/pacientes/nuevo`, `/pacientes/:id` |
| M3 | `/citas`, `/citas/nueva`, `/consultas`, `/consultas/:id` |
| M4 | `/inventario`, `/servicios` |
| M5 | `/facturas`, `/facturas/:id` |
| M6 | `/reportes`, `/auditoria` |
| M7 | `/usuarios`, `/mantenimiento` |

Cada ruta se renderiza server-side con Astro 5 y valida el token JWT antes de servir.

---

## 6. Dependencias entre módulos

```mermaid
graph LR
    M1["M1<br/>Seguridad"]
    M2["M2<br/>Registro"]
    M3["M3<br/>Agenda"]
    M4["M4<br/>Inventario"]
    M5["M5<br/>Facturación"]
    M6["M6<br/>Auditoría"]
    M7["M7<br/>Admin"]

    M1 --> M2
    M1 --> M3
    M1 --> M4
    M1 --> M5
    M1 --> M6
    M1 --> M7

    M2 --> M3
    M3 --> M4
    M3 --> M5
    M3 --> M6
    M4 --> M5
    M5 --> M6
```

**Lectura:** M1 (Seguridad) es prerequisito de todos. M2 (Registro) alimenta M3 (Agenda). M3 y M4 alimentan M5 (Facturación). M6 (Auditoría) registra actividad de todos los demás. M7 (Administración) gestiona usuarios y respaldos.

---

## 7. Conclusión

El sistema se estructura en **7 módulos** con **27 submódulos**. El frontend expone **14 rutas principales** y el backend **30+ endpoints REST**. La construcción se entrega en **3 iteraciones** alineadas con dependencias técnicas.

Este modelo de dominio guía el diseño de la base de datos, la API, la navegación y la planificación de iteraciones. Sirve como referencia única durante las fases de Elaboración, Construcción y Transición.