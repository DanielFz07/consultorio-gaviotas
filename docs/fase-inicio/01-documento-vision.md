# Consultorio Las Gaviotas - Documento de Visión

**Versión:** 1.0
**Estado:** Borrador - Fase de Inicio (RUP)
**Producto:** Sistema de Información Automatizado para la Gestión de Registro y Orden de Pacientes en C.A Consultorio Médico Las Gaviotas, de Barcelona Estado Anzoátegui
**Metodología:** Proceso Unificado de Rational (RUP)

---

## 1. Propósito del Documento

Establecer el alcance, los objetivos de negocio y la justificación del proyecto **Consultorio Las Gaviotas**, definiendo el valor que el sistema aportará a la consultorio médico objetivo. Este documento sirve como acuerdo entre los *stakeholders* y el equipo de desarrollo, y como referencia para la toma de decisiones durante las fases de RUP.

---

## 2. Contexto del Negocio

La consultorio médico opera actualmente con procesos manuales y dispersos:

- Agendas escritas en libretas o planillas sin validación de disponibilidad.
- Historias clínicas de pacientes archivadas en carpetas físicas, sin respaldo digital.
- Control de inventario de medicamentos mediante conteo manual.
- Facturación emitida al final del día con cálculos y consolidaciones manuales.
- Pérdida recurrente de información por daño de soportes, rotación de personal o extravío.

Estas prácticas generan errores operativos, demoras en la atención, pérdida de ingresos por cobro incorrecto y deterioro en la percepción del cliente.

---

## 3. Problemas a Resolver

| Código | Problema | Impacto actual |
|---|---|---|
| P-01 | Sobrecitación y choques de horarios en agenda manual | Cliente espera o se retira sin atención |
| P-02 | Historias clínicas dispersas o extraviadas | Diagnósticos sin contexto histórico |
| P-03 | Errores de cálculo en facturación manual | Pérdida de ingresos, quejas del cliente |
| P-04 | Stock de medicamentos sin control en tiempo real | Venta de productos sin existencia, desabastecimiento |
| P-05 | Ausencia de trazabilidad de prescripciones | Imposible auditar qué se prescribió y a qué paciente |
| P-06 | Falta de recordatorios automáticos | Alta tasa de inasistencia a citas programadas |
| P-07 | Reportes operativos inexistentes o tardíos | Decisiones administrativas sin datos |

---

## 4. Oportunidad de Negocio

La digitalización integral de la operación clínica permite:

1. Reducir tiempo administrativo destinado a tareas repetitivas.
2. Aumentar la precisión en el cobro de servicios y productos.
3. Mejorar la fidelización del cliente mediante atención más ágil y profesional.
4. Generar indicadores operativos (citas atendidas, productos despachados, ingresos por servicio) para la toma de decisiones.

---

## 5. Objetivos del Sistema

### 5.1 Objetivo General

Desarrollar e implantar un sistema de información que automatice las operaciones críticas de la consultorio médico (pacientes, citas, consultas, inventario y facturación), mejorando la eficiencia operativa y la calidad de atención al cliente.

### 5.2 Objetivos Específicos

- **OG-01** - Eliminar los choques de horario mediante un calendario digital con validación de disponibilidad.
- **OG-02** - Centralizar el en el sistema por paciente en el sistema, con respaldo digital.
- **OG-03** - Reducir a cero los errores aritméticos en facturación mediante cálculo automático.
- **OG-04** - Mantener actualizado el stock de medicamentos tras cada prescripción en consulta.
- **OG-05** - Disminuir la inasistencia mediante recordatorios automáticos por correo electrónico.
- **OG-06** - Producir reportes operativos en tiempo real (diarios, semanales, mensuales).

---

## 6. Alcance del Producto

### 6.1 Dentro del Alcance

| Módulo | Funcionalidad |
|---|---|
| Pacientes y Pacientes | registro de pacientes, CRUD de pacientes, registro directo del paciente |
| Agenda y Citas | Programar, reprogramar, cancelar citas; tipos: consulta, vacuna, cirugía |
| Consulta Médica | Síntomas, diagnóstico, tratamiento, prescripción, carga de archivos |
| Inventario | Alta/baja de productos, control de stock, alerta de umbral mínimo |
| Facturación | Generación automática al cerrar consulta; consolidada servicios + productos |

### 6.2 Fuera del Alcance (Fase Inicial)

- Integración con pasarelas de pago externas.
- Historia clínica electrónica interoperable con otros sistemas.
- Aplicación móvil nativa.
- Contabilidad general del negocio.

---

## 7. Stakeholders

| Rol | Interés |
|---|---|
| Propietario / Administrador | Rentabilidad, reportes, control global |
| Médico | Historia clínica completa, prescripción rápida |
| Recepcionista | Agenda clara, registro ágil de clientes |
| Cliente externo | Atención rápida, recordatorios, transparencia en cobro |

---

## 8. Ventajas Competitivas y Valor de Negocio (ROI Operativo)

| Ventaja | Métrica esperada | Plazo |
|---|---|---|
| Eliminación de errores manuales en facturación | 0% de facturas con cálculo manual al cierre de consulta | Inmediato |
| Reducción de tiempo de agendamiento | De ~5 min a ~30 seg por cita | Inmediato |
| Disponibilidad de historia clínica | 100% accesible desde búsqueda por paciente | Semana 1 |
| Control de inventario en tiempo real | Stock actualizado al instante tras prescripción | Inmediato |
| Reducción de inasistencias | Estimación -25% con recordatorios | Mes 1 |
| Tantecedente relevantebilidad de prescripciones | 100% de consultas con productos registrados | Inmediato |
| Disponibilidad operativa | Sistema operativo 99% del horario de la clínica | Continuo |

---

## 9. Restricciones Iniciales

- **Infraestructura:** Despliegue oblirio en entorno Linux mediante Docker.
- **Persistencia:** Base de datos relacional estricta (PostgreSQL).
- **Backend:** Bun + TypeScript con framework Elysia.
- **Frontend:** Astro SSR con API routes para integración.
- **Seguridad:** Control de acceso por roles (Administrador, Médico, Recepción).
- **Académico:** Cumplimiento riguroso de artefactos RUP y lineamientos DSI.

---

## 10. Riesgos Iniciales

| Código | Posible Riesgo | Descripción | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|---|
| R-01 | Resistencia al cambio | Personal administrativo habituado a libretas y planillas puede resistir el sistema digital. | Media | Alto | Capacitación 2 horas + interfaz concierge intuitiva + acompañamiento en transición. |
| R-02 | Dependencia de internet | Falla de conectividad impide registrar pacientes o emitir facturas. | Baja | Alto | Caché local en navegador + cola de operaciones pendientes + modo degradado offline. |
| R-03 | Sizing insuficiente | Servidor con RAM/CPU insuficiente degrada respuesta bajo carga. | Baja | Medio | Carga estimada < 100 citas/día, holgura amplia en Railway free tier; migrar a plan pago si se supera. |
| R-04 | Pérdida de datos | Falla de disco o borrado accidental sin respaldo. | Baja | Crítico | Backup diario vía `pg_dump` + restore probado mensualmente + replicación en segundo volumen. |
| R-05 | Fuga de información médica | Acceso no autorizado a historias clínicas por error de RBAC. | Baja | Crítico | JWT con expiración 8h + middleware verifica rol por endpoint + `audit_log` registra cada acceso. |
| R-06 | Errores en facturación | Cálculos manuales o de redondeo generan facturas incorrectas. | Baja | Alto | Cálculo server-side en transacción ACID + número correlativo único + anulación con motivo obligatorio. |
| R-07 | No-shows masivos | Pacientes olvidan sus citas por falta de recordatorios. | Media | Medio | Worker envía recordatorio 24h antes vía SMTP; estadísticas de no-show se monitorean mensualmente. |
| R-08 | Sobrecarga del médico | Si el sistema es lento durante la consulta, el médico deja de usarlo. | Baja | Alto | Pool de conexiones, queries < 50 ms en el 95 percentil, página `/consultas/:id` optimizada para un click. |
| R-09 | Migración incompleta desde planillas | Pacientes históricos no migrados, historias perdidas. | Media | Alto | Procedimiento documentado en `03-procedimiento-migracion.md` con script SQL y validación. |
| R-10 | Caída del proveedor cloud | Si se usa Railway y el servicio se interrumpe. | Baja | Medio | Arquitectura portable: misma imagen Docker corre en VPS local; respaldo en `start-all.sh`. |

---

## 11. Glosario

| Término | Definición |
|---|---|
| Cita | Asignación de un horario para un servicio médico a un paciente |
| Consulta | Acto médico registrado en el sistema |
| Paciente | Paciente animal registrado en el sistema |
| Prescripción | Indicación médica de productos administrados durante la consulta |
| Pre-factura | Documento previo al cierre que agrupa servicios y productos de una consulta |
| Stock | Cantidad disponible de un producto en inventario |

---

## 12. Aprobaciones

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Product Owner | | | |
| Profesor Tutor | | | |
