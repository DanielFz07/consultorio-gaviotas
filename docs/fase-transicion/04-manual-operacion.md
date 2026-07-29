# Manual de Operación - Consultorio Las Gaviotas

**Fase:** Transición
**Audiencia:** Recepción / Caja / Médico (usuarios del sistema)

---

## 1. Inicio de Sesión

1. Abrir navegador en `https://consultorio-gaviotas.clinica.com`.
2. Ingresar usuario y contraseña.
3. Pulsa "Ingresar".
4. El sistema recuerda la sesión por 8 horas.

**Cambio de contraseña (próxima iteración):** menú usuario → "Cambiar contraseña".

**Recuperación de contraseña:** contactar al administrador. El admin la resetea y le entrega una temporal.

---

## 2. Recepción - Operaciones Diarias

### 2.1 Registrar paciente nuevo

1. Menú → Pacientes → "+ Nuevo paciente".
2. Completar V-, nombre, apellido, teléfono, email (opcional), dirección (opcional).
3. Confirmar.

### 2.2 Registrar paciente

1. Desde la ficha del paciente → "+ Nuevo paciente".
2. Completar nombre, apellido, fecha de nacimiento, sexo, teléfono, dirección.
3. (Opcional) Microchip si tiene.
4. Confirmar. **El sistema crea automáticamente el historial clínico.**

### 2.3 Agendar cita

1. Menú → Agenda → "+ Nueva cita".
2. Buscar paciente por V- del paciente o nombre de paciente.
3. Seleccionar fecha, hora y médico.
4. Tipo: Consulta / Vacuna / Cirugía / Control / Otro.
5. Motivo (mínimo 5 caracteres).
6. Confirmar.

**Códigos de error frecuentes:**

- `EX-009` - Slot ocupado: cambiar hora o médico.
- `EX-007` - V- duplicado: verificar si el paciente ya existe.

### 2.4 Reprogramar cita

1. Abrir cita desde el calendario.
2. Pulsa "Reprogramar".
3. Elegir nueva fecha y hora.
4. Ingresar motivo de reprogramación.
5. Confirmar.

### 2.5 Cancelar cita

1. Abrir cita.
2. Pulsa "Cancelar".
3. Confirmar e ingresar motivo.
4. **Las citas ATENDIDAS no se pueden cancelar** (EX-010).

---

## 3. Médico - Atención Clínica

### 3.1 Abrir consulta

1. Menú → Citas de hoy.
2. Seleccionar cita.
3. Pulsa "Iniciar consulta".
4. La cita pasa a estado EN_CURSO.

### 3.2 Registrar síntomas y diagnóstico

- Completar campos oblirios: síntomas y diagnóstico.
- Tratamiento y observaciones son opcionales pero recomendados.

### 3.3 Agregar servicios

1. "+ Servicio".
2. Buscar por nombre o código.
3. Seleccionar y confirmar.
4. Repetir si hay más servicios.

### 3.4 Prescribir medicamento

1. "+ Medicamento".
2. Buscar producto por nombre o SKU.
3. Indicar cantidad, dosis, frecuencia, duración.
4. Confirmar.

**Si el sistema muestra EX-011:** stock insuficiente. Ajustar cantidad o elegir otro producto.

### 3.5 Adjuntar archivos

1. "+ Archivo".
2. Arrastrar imagen o PDF (máx 10 MB, formatos: PNG, JPEG, WEBP, PDF).
3. Confirmar.

### 3.6 Finalizar consulta

1. Pulsa "Finalizar Consulta".
2. El sistema:
   - Genera factura con número correlativo.
   - Descuenta stock definitivamente.
   - Actualiza historial clínico.
   - Cambia cita a ATENDIDA.

---

## 4. Caja - Cobro

### 4.1 Ver factura del día

1. Menú → Facturación.
2. Lista de facturas del día (por defecto).
3. Seleccionar factura.

### 4.2 Cobrar

1. Abrir factura.
2. Verificar desglose: servicios + productos + impuestos.
3. Pulsa "Cobrar".
4. Estado cambia a PAGADA.

**Opcional:** exportar PDF o imprimir.

### 4.3 Anular factura (solo Administrador)

1. Abrir factura.
2. Pulsa "Anular".
3. Ingresar motivo.
4. Confirmar. Estado → ANULADA.

**Importante:** factura anulada no se elimina; queda en bitácora.

---

## 5. Mensajes al Usuario (catálogo resumido)

| Código | Significado para el usuario |
|---|---|
| EX-001 | Usuario o contraseña incorrectos |
| EX-003 | No tiene permisos para esta acción |
| EX-007 | Ya existe un paciente con ese V- |
| EX-009 | Ese horario ya está ocupado |
| EX-010 | La cita ya no se puede modificar |
| EX-011 | No hay suficiente stock |
| EX-013 | Complete síntomas y diagnóstico |
| EX-021 | Archivo demasiado grande (máx 10 MB) |
| EX-022 | Tipo de archivo no permitido |

Si aparece un código no listado, copiar y enviar al administrador.

---

## 6. Buenas Prácticas

- Cerrar sesión al ausentarse del equipo.
- Verificar el resumen antes de "Finalizar Consulta".
- No modificar datos de facturas ya pagadas sin autorización.
- Mantener contraseñas privadas (no compartir).
- Reportar al admin cualquier anomalía (lentitud, errores repetidos).