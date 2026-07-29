# Demo Final - Día en la Clínica

**Fase:** Transición
**Duración estimada:** 15 minutos
**Formato:** Roleplay en vivo. Sin mostrar código al profesor.
**Roles:** Recepción / Médico / Caja (operador con permisos de pago) / Administrador

---

## Pre-requisitos (antes de la presentación)

1. Servidor arriba: `docker compose ps` muestra los 4 servicios en estado `healthy`/`running`.
2. Mailhog UI abierto en `http://localhost:8025` (proyector secundario).
3. Tres ventanas de navegador con sesión iniciada:
   - Pestaña A (Recepción).
   - Pestaña B (Médico).
   - Pestaña C (Caja / Admin).
4. Base de datos recién cargada con seed (servicios, productos, 1 paciente demo, 1 paciente demo).
5. Credenciales:
   - `recep / recep123`
   - `consultorio / med123`
   - `admin / admin123`
6. Impresora PDF funcional o exportar a `.pdf` para entregar factura impresa.

---

## Acto 1 - Apertura (1 min)

**Narrador:** "Buenos días. Hoy simulamos un día de operación en una consultorio médico pequeña que usa Consultorio Las Gaviotas."

**Pantalla:** Dashboard del sistema. Tablero con KPIs del día.

---

## Acto 2 - Cliente sin cita previa (5 min)

### Paso 1 - Llega cliente nuevo
**Actor Recepción:**
- Abre pestaña Recepción.
- Cliente dice: "Buenos días, mi perra Luna está decaída, ¿la pueden atender?"
- Recepción busca por V- del paciente: `12345678`.

### Paso 2 - No existe → registrar
- Pantalla muestra "no encontrado".
- Pulsa "+ Registrar paciente".
- Completa: nombre, apellido, teléfono, email.
- Confirma.

### Paso 3 - Registrar paciente
- Tras registrar paciente, registra al paciente".
- Completa: nombre "Luna", sexo "", antecedente relevante, sexo "HEMBRA", peso aprox.

### Paso 4 - Agendar cita
- Calendario del día. Selecciona slot 10:00 con Dr. Carlos Pérez.
- Tipo servicio: "Consulta".
- Motivo: "Decaimiento general".
- Confirma.
- **Pantalla muestra resumen de cita + ID + estado PROGRAMADA.**

### Paso 5 - Notificación programada
- **Narrador:** "El sistema ya agendó un recordatorio automático 24h antes por correo."
- (Si la cita es para mañana, abrir Mailhog y mostrar email pendiente).

---

## Acto 3 - Atención Médica (5 min)

### Paso 6 - Médico abre consulta
**Actor Médico:**
- Pestaña B. Login.
- Ve panel "Citas de hoy".
- Abre cita 10:00.
- Pulsa "Iniciar consulta".

### Paso 7 - Síntomas y diagnóstico
- Completa síntomas: "Decaimiento, vómitos".
- Diagnóstico: "Gastritis leve".
- Tratamiento: "Dieta + medicación".

### Paso 8 - Servicios
- "+ Servicio": selecciona "Consulta General".
- (Opcional) "+ Servicio": "Aplicación de suero".

### Paso 9 - Prescripción
- "+ Medicamento": busca "Antiemético 50mg".
- Cantidad: 6 comprimidos. Dosis: 1 comp cada 8h. Duración: 2 días.
- Pulsa "Agregar".

### Paso 10 - Provocar EX-011 (demostración de validación)
- "+ Medicamento": "Vacuna Antirrábica" → cantidad 9999.
- **Pantalla muestra error EX-011**: "Stock disponible: 60, solicitado: 9999".
- Recepcion corrige a 1.

### Paso 11 - Adjuntar archivo
- "+ Archivo": sube radiografía.png.
- **Pantalla muestra preview + nombre guardado.**

### Paso 12 - Finalizar consulta
- Pulsa "Finalizar Consulta".
- **Pantalla muestra factura generada:** número F-2026-00000001, total $52.40 (servicios + productos + 16% IVA).
- Cita pasa a estado ATENDIDA.

---

## Acto 4 - Cobro en Caja (2 min)

### Paso 13 - Caja ve factura
**Actor Caja:**
- Pestaña C. Login como Recepción.
- Abre "Facturas del día".
- Selecciona factura del cliente.
- Muestra detalle con desglose de servicios y productos.

### Paso 14 - Pago
- Pulsa "Cobrar".
- Estado cambia a PAGADA.
- (Opcional) Imprime/exporta PDF.

### Paso 15 - Notificación email
- **Narrador:** "Al pagar, el sistema encola email automático al cliente con resumen."
- Abrir Mailhog. Mostrar email enviado con número de factura y monto.

---

## Acto 5 - Reporte y Administración (2 min)

### Paso 16 - Reporte diario
**Actor Administrador:**
- Pestaña C. Cambia sesión a Admin.
- Abre "Reportes" → "Diario".
- Muestra: 1 atención, ingresos $52.40, productos despachados, citas pendientes.

### Paso 17 - Anulación factura (caso borde)
- "Supongamos que el cliente pagó en efectivo pero debemos emitir nota de crédito."
- Abre factura pagada. Pulsa "Anular". Ingresa motivo "duplicado".
- Estado → ANULADA.

---

## Cierre

**Narrador:** "Esto es una operación real cubierta por Consultorio Las Gaviotas en menos de 15 minutos, sin papeles, sin libretas, con control de inventario y trazabilidad completa."

---

## Guion de preguntas del profesor (preparación)

| Pregunta esperada | Respuesta corta |
|---|---|
| ¿Y si dos médicos atienden a la vez? | RBAC + JWT por sesión, RBAC + JWT por sesión, slots validados por `uq_cita_slot_medico`. |
| ¿Cómo evitan doble cobro? | UNIQUE en `factura.consulta_id` + estado terminal. |
| ¿Backup? | `pg_dump` diario + rsync offsite + procedimiento documentado. |
| ¿Escalable? | Sí, separar API en réplicas + balanceador; DB con réplicas read. |
| ¿Qué pasa si cae el servidor? | RTO 4h, último dump aplicado; citas del día se pierden pero auditoría no. |
| ¿Notificaciones? | Worker cron 60s + SMTP con reintentos + Mailhog en dev. |

---

## Recursos para llevar a la presentación

- [ ] Laptop con docker-compose corriendo.
- [ ] Proyector (pantalla grande) + cable HDMI.
- [ ] Acceso a internet (por si el profesor pregunta y hay que levantar algo).
- [ ] PDF del documento de visión impreso (respaldo).
- [ ] Diagrama ER impreso (visual rápido).