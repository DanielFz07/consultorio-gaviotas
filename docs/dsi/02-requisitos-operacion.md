# Requisitos de Operación y Administración - Consultorio Las Gaviotas

**Fase:** Elaboración
**Tipo:** Diseño del Sistema de Información (DSI)

---

## 1. Requisitos de Operación

### 1.1 Disponibilidad

| Parámetro | Valor |
|---|---|
| Horario operativo de la clínica | L-S 08:00 a 20:00 |
| Disponibilidad objetivo durante horario | 99% (downtime permitido ~7h/año) |
| Mantenimiento programado | Domingos 02:00 a 04:00 (ventana de backup) |
| RTO (Recovery Time Objective) | 4 horas |
| RPO (Recovery Point Objective) | 24 horas (backup diario) |

### 1.2 Rendimiento

| Operación | Latencia objetivo |
|---|---|
| Login + emisión de token | < 500 ms |
| Búsqueda de pacientes por nombre/V- | < 300 ms |
| Agendar cita (validar disponibilidad + persistir) | < 800 ms |
| Cierre de consulta (transacción completa) | < 1500 ms |
| Generación de factura con items | < 500 ms |
| Listado del calendario del día | < 400 ms |

Carga esperada: hasta 100 citas/día, pico de 5 usuarios concurrentes.

### 1.3 Almacenamiento

| Recurso | Política |
|---|---|
| Base de datos | Crecimiento estimado 5 GB/año. Particionar `item_factura` por año si supera 1M filas |
| Archivos adjuntos | Volumen Docker `./data/uploads`. Backup incluido en snapshot del servidor |
| Logs de aplicación | Retención 90 días en disco, después gzip + archivo |
| Backups DB | Dump diario con `pg_dump` + compresión. Retención 30 días |

### 1.4 Backup y Restauración

- Backup lógico diario automático (cron 01:00).
- Backup completo semanal con copia externa (fsync + rsync offsite).
- Procedimiento de restauración documentado y probado trimestralmente.

### 1.5 Monitoreo

- Health checks en `/api/health` (DB, worker, SMTP).
- Logs centralizados en stdout + archivo `logs/app.log`.
- Alertas por: 5xx repetidos, espacio en disco < 10%, CPU > 80% por 5 min, SMTP caído.

---

## 2. Administración del Sistema

### 2.1 Tareas del Administrador

- Alta/baja de usuarios.
- Asignación de roles.
- Configuración de parámetros (duración citas, impuestos, SMTP, umbral stock).
- Gestión de catálogo de servicios y productos.
- Acceso a bitácora de auditoría completa.
- Activación/desactivación de médicos.

### 2.2 Procedimientos de Migración y Carga Inicial

Se documentan en `docs/fase-transicion/03-procedimiento-migracion.md` (entregable de Fase Transición).

Acciones previas a carga inicial:
1. Crear la base de datos PostgreSQL y usuario de aplicación.
2. Ejecutar migraciones en orden (`db/migrations/`).
3. Ejecutar `db/seeds/001_seed_basico.sql` (usuario admin + servicios de ejemplo).
4. Configurar variables de entorno (`deploy/.env.example`).
5. Levantar contenedores con `docker-compose up -d`.
6. Validar `GET /api/health` retorna 200.

---

## 3. Catálogo de Normas de Diseño y Construcción

### 3.1 Convenciones de Código

| Área | Norma |
|---|---|
| Lenguaje | TypeScript strict (`"strict": true` en tsconfig) |
| Estilo | ESLint + Prettier con config del proyecto |
| Identificadores | `PascalCase` clases/tipos, `camelCase` variables/funciones |
| Constantes | `UPPER_SNAKE_CASE` |
| Endpoints API | REST, kebab-case en rutas (`/api/consultas/:id/finalizar`) |
| Commits | Conventional Commits (`feat:`, `fix:`, `docs:`, etc.) |
| Ramas | `main` (producción), `develop` (integración), `feat/*`, `fix/*` |

### 3.2 Convenciones de Base de Datos

| Área | Norma |
|---|---|
| Esquema | `consultorio-gaviotas` (no `public`) |
| Identificadores | snake_case en columnas, snake_case_plural en tablas |
| PK | `id BIGSERIAL PRIMARY KEY` salvo justificación |
| FK | `ON DELETE RESTRICT` por defecto; `CASCADE` solo en dependencias fuertes |
| Timestamps | `TIMESTAMPTZ` para instantes, `DATE` para fechas puras |
| Auditoría | columnas `created_at`, `updated_at` con defaults |
| Dinero | `NUMERIC` nunca `FLOAT` |

### 3.3 Seguridad Mínima

- Secretos en variables de entorno, nunca en repo.
- Conexiones DB oblirias por TLS en producción.
- Rate limit: 100 req/min por IP, 600 req/min por usuario autenticado.
