# Seguridad y Control de Acceso - Consultorio Las Gaviotas

**Fase:** Elaboración
**Tipo:** Diseño del Sistema de Información (DSI)

---

## 1. Modelo de Roles (RBAC)

Tres roles básicos. Cada permiso se denota como `recurso:accion`.

### 1.1 Matriz de Permisos

| Recurso | Acción | Administrador | Médico | Recepción |
|---|---|---|---|---|
| **Usuario** | listar | si | no | no |
| | crear | si | no | no |
| | editar | si | no | no |
| | activar/desactivar | si | no | no |
| **Paciente** | listar/buscar | si | si | si |
| | crear/editar | si | si | si |
| | eliminar (borrado lógico) | si | no | no |
| **Paciente** | CRUD | si | si (lectura/edición) | si (crear/lectura) |
| **Historial Clínico** | leer | si | si | no |
| | editar | si | si | no |
| **Cita** | crear | si | si | si |
| | reprogramar | si | si | si |
| | cancelar | si | si (propias citas) | si |
| | atender | no | si | no |
| | listar | si | si (asignadas o propias) | si |
| **Consulta** | crear/draft | no | si | no |
| | finalizar | no | si | no |
| | leer | si | si (propias) | no |
| | anular | si | no | no |
| **Prescripción** | emitir | no | si | no |
| | leer | si | si (propias) | no |
| **Producto/Inventario** | CRUD | si | no | no |
| | consultar stock | si | si | si |
| **Servicio** | CRUD | si | no | no |
| **Factura** | emitir | no | si (al cerrar consulta) | no |
| | leer | si | si (propias) | si (emitidas del día) |
| | anular | si | no | no |
| **Reporte** | global | si | no | no |
| | clínico (pacientes) | si | si | no |
| | operativo (citas/facturación) | si | no | si (citas) |
| **Auditoría** | consultar | si | no | no |

### 1.2 Definición de roles

**Administrador:**
- Acceso total al sistema.
- Gestiona usuarios, catálogos (servicios, productos), parámetros globales.
- Único que puede anular facturas.
- Ve toda la auditoría y reportes globales.

**Médico:**
- Acceso al módulo clínico (consultas, prescripciones, historias).
- Puede consultar pacientes (necesario para atender).
- Cierra consultas y emite facturas como efecto colateral.
- Restringido al inventario a nivel de consulta de stock (no edición).

**Recepción:**
- Gestiona agenda y registro de clientes.
- Crea citas y registra pacientes.
- Solo ve información clínica estrictamente necesaria para agendar (no diagnósticos).
- No accede a inventario, consultas ni reportes clínicos.

---

## 2. Procedimientos de Seguridad

### 2.1 Autenticación

- **Hash de contraseñas:** bcrypt con cost factor 12.
- **Token:** JWT firmado con HS256, expiración 8h, refresh opcional 24h.
- **Almacenamiento token cliente:** cookie `HttpOnly`, `Secure`, `SameSite=Strict`.
- **Cabeceras de seguridad:** `Authorization: Bearer <token>` para endpoints API.

### 2.2 Control de Sesión

- Sesión expira por inactividad (2h) o por tiempo absoluto (8h).
- Logout invalida token server-side (denylist corta en memoria).
- Cambio de contraseña invalida todos los tokens previos del usuario.

### 2.3 Auditoría

Eventos registrados en tabla `auditoria_evento` (no incluida en MVP académico, pero documentada):

- Login OK / Login FALLIDO
- Creación/edición/eliminación de pacientes
- Emisión/anulación de facturas
- Modificación de inventario
- Cambios de roles

Cada evento almacena: `usuario_id`, `accion`, `recurso`, `recurso_id`, `ip`, `user_agent`, `timestamp`.

### 2.4 Protección de Datos

- **Cumplimiento:** medidas razonables de protección (no hay datos sensibles de salud pública bajo HIPAA equivalente, pero se aplican buenas prácticas).
- **Datos personales: pacientes. Almacenados cifrados en reposo en reposo (cifrado a nivel de disco proveído por la plataforma).
- **Backups:** cifrados con clave separada.
- **Logs:** PII mínima, nunca contraseñas ni tokens.

### 2.5 Respuesta a Incidentes

| Evento | Acción inmediata |
|---|---|
| Robo de credenciales admin | Resetear contraseña, invalidar tokens, auditar accesos |
| Caída del SMTP | Worker reintenta cada 10 min, alerta en `/api/health` |
| Pérdida de datos DB | Activar RPO, restaurar último backup verificado |

---

## 3. Matriz de Pruebas de Seguridad (referencia)

| Test | Criterio de éxito |
|---|---|
| Inyección SQL | Todas las queries parametrizadas; ninguna construye SQL por concatenación |
| XSS en inputs | Sanitización en backend + escape en Astro |
| CSRF | Cookies SameSite=Strict + token CSRF en formularios mutadores |
| Bypass de autorización | Por cada endpoint, prueba con token sin permisos retorna 403 |
| Enumeración de IDs | Respuesta idéntica para IDs existentes vs inexistentes cuando aplique |
| Contraseñas débiles | Política: mínimo 10 caracteres, validación en frontend y backend |
