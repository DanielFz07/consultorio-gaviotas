# Catálogo de Excepciones - Consultorio Las Gaviotas

**Fase:** Elaboración
**Tipo:** Diseño del Sistema de Información (DSI)

Listado normativo de situaciones anómalas que el sistema debe detectar, clasificar y responder de manera explícita. Cada excepción tiene un código único, severidad y respuesta esperada.

---

## 1. Matriz de Excepciones

| Código | Categoría | Condición | Severidad | Respuesta del Sistema |
|---|---|---|---|---|
| EX-001 | Autenticación | Credenciales inválidas | Baja | 401 + mensaje genérico "Usuario o contraseña incorrectos" |
| EX-002 | Autenticación | Sesión expirada | Baja | 401 + redirigir a login con mensaje informativo |
| EX-003 | Autorización | Rol sin permisos para el recurso | Media | 403 + log de auditoría con usuario, recurso y timestamp |
| EX-004 | Validación | Campo oblirio faltante | Baja | 400 + listado exacto de campos inválidos |
| EX-005 | Validación | Formato inválido (V-, email, fecha) | Baja | 400 + mensaje por campo con formato esperado |
| EX-006 | Validación | Valor fuera de rango (peso, cantidad) | Baja | 400 + rango válido |
| EX-007 | Negocio | Paciente ya existe (V- duplicado) | Baja | 409 + mensaje "Ya existe un paciente registrado con ese V-" |
| EX-008 | Negocio | Paciente con cédula duplicado | Baja | 409 + mensaje claro |
| EX-009 | Negocio | Cita en horario ya ocupado | Media | 409 + mostrar médico y horarios alternativos disponibles |
| EX-010 | Negocio | Cita no se puede cancelar (estado ATENDIDA) | Baja | 409 + mensaje explicando que cita ya fue atendida |
| EX-011 | Negocio | Stock insuficiente para prescripción | Media | 409 + mensaje "Stock disponible: X, solicitado: Y" |
| EX-012 | Negocio | Producto inactivo al intentar prescribir | Media | 409 + "Producto deshabilitado del inventario" |
| EX-013 | Negocio | Consulta intenta cerrarse sin síntomas o diagnóstico | Baja | 400 + listado de campos requeridos |
| EX-014 | Negocio | Factura ya pagada/anulada al intentar modificar | Media | 409 + mensaje + log de auditoría |
| EX-015 | Negocio | Intento de eliminar registro con dependencias (FK) | Baja | 409 + mensaje de integridad referencial |
| EX-016 | Negocio | Transición de estado inválida (ej. PENDIENTE → PAGADA sin EMITIDA) | Media | 409 + mensaje explicando transiciones válidas |
| EX-017 | Persistencia | Conexión DB perdida | Alta | 503 + log crítico + mensaje "Servicio temporalmente no disponible" |
| EX-018 | Persistencia | Timeout query (>5s) | Media | 504 + log + mensaje sugerente |
| EX-019 | Persistencia | Violación de constraint CHECK/UNIQUE | Media | 409 + mensaje depurado según constraint |
| EX-020 | Persistencia | Deadlock entre transacciones concurrentes | Alta | 503 + reintento automático (1 vez), luego mensaje al usuario |
| EX-021 | Archivos | Archivo excede tamaño máximo (10 MB) | Baja | 413 + tamaño máximo permitido |
| EX-022 | Archivos | Tipo MIME no permitido | Baja | 415 + tipos permitidos |
| EX-023 | Archivos | Error de escritura en disco | Alta | 500 + log crítico + mensaje "No se pudo guardar el archivo" |
| EX-024 | Notificaciones | SMTP caído / timeout | Media | Notificación queda en estado FALLIDA con reintentos (worker) |
| EX-025 | Notificaciones | Email destinatario inválido | Baja | Notificación FALLIDA + log + mensaje al admin |
| EX-026 | Sistema | Memoria insuficiente / CPU saturada | Alta | 503 + alerta a monitoreo |
| EX-027 | Sistema | Versión API cliente incompatible | Baja | 400 + versión esperada |
| EX-028 | Seguridad | Detección de SQL injection | Alta | 400 + log de seguridad + bloqueo temporal IP |
| EX-029 | Seguridad | Múltiples intentos fallidos de login (>5) | Alta | Bloqueo temporal 15 min + log de seguridad |
| EX-030 | Seguridad | Token JWT expirado | Baja | 401 + redirigir a login transparente |

---

## 2. Manejo Transversal

- **Logging:** todas las excepciones Media y Alta deben registrar `timestamp`, `usuario`, `endpoint`, `request_id`.
- **Idempotencia:** los endpoints `POST` que modifican estado deben aceptar `Idempotency-Key` para evitar duplicados en reintentos.
- **Errores al cliente:** la API devuelve JSON con estructura `{ code, message, details? }`.
- **Errores al usuario en UI:** Astro muestra mensaje amigable según `code`, sin filtrar stack técnico.
