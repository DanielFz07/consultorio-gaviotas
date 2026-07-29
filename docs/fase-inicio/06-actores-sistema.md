# Actores del Sistema — Consultorio Las Gaviotas

**Versión:** 1.0
**Estado:** Aprobado · Fase de Inicio (RUP)
**Producto:** Sistema de Información Automatizado para la Gestión de Registro y Orden de Pacientes en C.A Consultorio Médico Las Gaviotas

---

## 1. Propósito

Definir formalmente los **actores del sistema** (usuarios externos que interactúan con el software), sus funciones y el nivel de acceso. Esta tabla es la referencia para:

- El modelo de seguridad y RBAC (`docs/dsi/03-seguridad-roles.md`).
- Los casos de uso (`docs/fase-elaboracion/02-casos-uso.md`).
- La matriz de permisos del módulo de Gestión de Usuarios.

---

## 2. Actores del Sistema

| Código | Actor | Descripción | Funciones principales | Nivel de acceso |
|---|---|---|---|---|
| **A-01** | **Recepción** | Personal administrativo del consultorio. Maneja la agenda, registra pacientes y cobra consultas. | • Agendar, reprogramar y cancelar citas.<br>• Registrar nuevos pacientes.<br>• Buscar pacientes por cédula o nombre.<br>• Cobrar y anular facturas.<br>• Atender al paciente en ventanilla. | RECEPCION |
| **A-02** | **Médico** | Especialista médico que atiende las consultas. Genera el acto clínico. | • Abrir consulta desde una cita programada.<br>• Registrar síntomas, diagnóstico y tratamiento.<br>• Emitir prescripciones médicas.<br>• Adjuntar resultados de laboratorio.<br>• Cerrar la consulta (emite factura automáticamente). | MEDICO |
| **A-03** | **Administrador** | Responsable del sistema. Controla usuarios, datos maestros, respaldos y auditoría. | • Crear, editar y desactivar usuarios.<br>• Asignar roles y resetear contraseñas.<br>• Gestionar catálogo de servicios y productos.<br>• Generar respaldos y restaurar la BD.<br>• Consultar logs de auditoría.<br>• Generar reportes administrativos.<br>• Acceso completo a todas las funciones. | ADMIN |
| **A-04** | **Sistema de Notificaciones** | Actor técnico automatizado. Envía recordatorios 24h antes de cada cita. | • Consultar citas programadas para mañana.<br>• Enviar email al paciente.<br>• Marcar notificación como ENVIADA / FALLIDA. | Sistema (sin login) |
| **A-05** | **Sistema Gestor de Base de Datos (SGBD)** | PostgreSQL 16. Almacena y recupera los datos del sistema. | • Garantizar integridad referencial.<br>• Aceptar transacciones ACID.<br>• Mantener los índices para consultas rápidas. | Sistema |

---

## 3. Detalle por actor

### A-01 · Recepción

| Atributo | Valor |
|---|---|
| Tipo | Persona |
| Volumen de uso | ~50–100 acciones/día |
| Dispositivo típico | PC de escritorio en ventanilla |
| Capacitación | 2 horas |
| Pantallas principales | `/dashboard`, `/pacientes`, `/citas`, `/facturas` |

### A-02 · Médico

| Atributo | Valor |
|---|---|
| Tipo | Persona |
| Volumen de uso | ~10–15 consultas/día × 5 min de sistema = ~75 min/día |
| Dispositivo típico | PC en consultorio o tablet |
| Capacitación | 1 hora (enfocada en el flujo de la consulta) |
| Pantallas principales | `/dashboard`, `/consultas/:id`, `/pacientes/:id` |

### A-03 · Administrador

| Atributo | Valor |
|---|---|
| Tipo | Persona |
| Volumen de uso | Bajo (~10 acciones/semana) |
| Dispositivo típico | PC en oficina administrativa |
| Capacitación | 4 horas (incluye backup, restore, auditoría) |
| Pantallas principales | `/usuarios`, `/mantenimiento`, `/auditoria`, `/reportes` |

### A-04 · Sistema de Notificaciones

| Atributo | Valor |
|---|---|
| Tipo | Proceso automatizado (worker) |
| Ejecución | Cada 60 segundos (cron) |
| Activación | Inmediata al arrancar el contenedor |
| Salida | Emails vía SMTP (MailHog local / SendGrid prod) |

### A-05 · SGBD (PostgreSQL)

| Atributo | Valor |
|---|---|
| Tipo | Motor de base de datos |
| Versión | PostgreSQL 16 |
| Esquema | `consultorio` (18 tablas) |
| Conexión | Pool de 10 conexiones, vía driver `pg` |
| Garantías | ACID, FK + UNIQUE + CHECK, ENUM para estados |

---

## 4. Matriz Actor × Funcionalidad (alto nivel)

| Funcionalidad | A-01 Recepción | A-02 Médico | A-03 Admin | A-04 Sistema | A-05 SGBD |
|---|:---:|:---:|:---:|:---:|:---:|
| Login | ✓ | ✓ | ✓ | — | ✓ |
| Registrar paciente | ✓ | — | ✓ | — | ✓ |
| Buscar paciente | ✓ | ✓ | ✓ | — | ✓ |
| Ver historia clínica | ✓ (lectura) | ✓ | ✓ | — | ✓ |
| Editar historia clínica | — | ✓ | ✓ | — | ✓ |
| Agendar cita | ✓ | — | ✓ | — | ✓ |
| Cancelar cita | ✓ | ✓ | ✓ | — | ✓ |
| Abrir consulta | — | ✓ | ✓ | — | ✓ |
| Registrar diagnóstico | — | ✓ | ✓ | — | ✓ |
| Emitir prescripción | — | ✓ | ✓ | — | ✓ |
| Cerrar consulta | — | ✓ | ✓ | — | ✓ |
| Generar factura | — | ✓ (al cerrar) | ✓ | — | ✓ |
| Cobrar factura | ✓ | — | ✓ | — | ✓ |
| Anular factura | ✓ | — | ✓ | — | ✓ |
| Generar reporte PDF | ✓ | ✓ | ✓ | — | ✓ |
| Ver logs auditoría | — | — | ✓ | — | ✓ |
| Crear usuario | — | — | ✓ | — | ✓ |
| Generar backup | — | — | ✓ | — | ✓ |
| Enviar recordatorio | — | — | — | ✓ | ✓ |

---

## 5. Notas para el equipo

- **A-04** y **A-05** son actores **técnicos** sin interfaz de usuario; aparecen en los diagramas de casos de uso como "Sistema" o "SGBD".
- **A-03** tiene superpoderes sobre todos los demás roles (RBAC). Toda acción queda registrada en `audit_log`.
- La separación de **A-01** y **A-02** es crítica: garantiza que la gestión administrativa de citas y la atención clínica permanezcan en roles distintos, requisito común en clínicas con buena gobernanza de datos.