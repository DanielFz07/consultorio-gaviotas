-- Consultorio Las Gaviotas - Modelo Físico de Datos
-- Motor: PostgreSQL 16
-- Charset: UTF8
-- Esquema: consultorio
-- Idempotente: seguro de ejecutar múltiples veces

CREATE SCHEMA IF NOT EXISTS consultorio;
SET search_path TO consultorio, public;

-- =========================================================
-- ENUMS
-- =========================================================

DROP TYPE IF EXISTS consultorio.rol_usuario CASCADE;
CREATE TYPE rol_usuario AS ENUM ('ADMIN', 'MEDICO', 'RECEPCION');

DROP TYPE IF EXISTS consultorio.estado_cita CASCADE;
CREATE TYPE estado_cita AS ENUM (
  'PROGRAMADA',
  'CONFIRMADA',
  'EN_CURSO',
  'ATENDIDA',
  'CANCELADA',
  'NO_ASISTIO'
);

DROP TYPE IF EXISTS consultorio.tipo_cita CASCADE;
CREATE TYPE tipo_cita AS ENUM ('CONSULTA', 'CONTROL', 'EXAMEN', 'PROCEDIMIENTO', 'OTRO');

DROP TYPE IF EXISTS consultorio.sexo_paciente CASCADE;
CREATE TYPE sexo_paciente AS ENUM ('MASCULINO', 'FEMENINO', 'OTRO');

DROP TYPE IF EXISTS consultorio.estado_factura CASCADE;
CREATE TYPE estado_factura AS ENUM ('EMITIDA', 'PAGADA', 'ANULADA');

DROP TYPE IF EXISTS consultorio.tipo_item_factura CASCADE;
CREATE TYPE tipo_item_factura AS ENUM ('SERVICIO', 'PRODUCTO');

DROP TYPE IF EXISTS consultorio.accion_audit CASCADE;
CREATE TYPE accion_audit AS ENUM (
  'LOGIN_OK', 'LOGIN_FAIL', 'LOGOUT',
  'CREATE', 'READ', 'UPDATE', 'DELETE',
  'BACKUP', 'RESTORE', 'EXPORT'
);

-- =========================================================
-- TABLAS (drop + create para idempotencia)
-- =========================================================

DROP TABLE IF EXISTS consultorio.audit_log CASCADE;
DROP TABLE IF EXISTS consultorio.user_login_log CASCADE;
DROP TABLE IF EXISTS consultorio.notificacion CASCADE;
DROP TABLE IF EXISTS consultorio.archivo CASCADE;
DROP TABLE IF EXISTS consultorio.item_factura CASCADE;
DROP TABLE IF EXISTS consultorio.factura CASCADE;
DROP TABLE IF EXISTS consultorio.prescripcion CASCADE;
DROP TABLE IF EXISTS consultorio.consulta_servicio CASCADE;
DROP TABLE IF EXISTS consultorio.consulta CASCADE;
DROP TABLE IF EXISTS consultorio.producto CASCADE;
DROP TABLE IF EXISTS consultorio.servicio CASCADE;
DROP TABLE IF EXISTS consultorio.cita CASCADE;
DROP TABLE IF EXISTS consultorio.entrada_historial CASCADE;
DROP TABLE IF EXISTS consultorio.historial_clinico CASCADE;
DROP TABLE IF EXISTS consultorio.paciente CASCADE;
DROP TABLE IF EXISTS consultorio.usuario CASCADE;

-- =========================================================
-- USUARIO (autenticación + roles)
-- =========================================================

CREATE TABLE usuario (
  id              BIGSERIAL PRIMARY KEY,
  username        VARCHAR(50)  NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  nombre          VARCHAR(120) NOT NULL,
  email           VARCHAR(150),
  rol             rol_usuario  NOT NULL,
  activo          BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_usuario_rol ON usuario(rol) WHERE activo = TRUE;

-- =========================================================
-- PACIENTE (persona atendida)
-- =========================================================

CREATE TABLE paciente (
  id                BIGSERIAL PRIMARY KEY,
  cedula            VARCHAR(20)  NOT NULL UNIQUE,
  nombre            VARCHAR(120) NOT NULL,
  apellido          VARCHAR(120) NOT NULL,
  fecha_nacimiento  DATE,
  telefono          VARCHAR(30),
  email             VARCHAR(150),
  direccion         TEXT,
  sexo              sexo_paciente NOT NULL DEFAULT 'OTRO',
  antecedentes      TEXT,
  alergias          TEXT,
  activo            BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_paciente_cedula CHECK (LENGTH(cedula) >= 5)
);

CREATE INDEX ix_paciente_cedula ON paciente(cedula);
CREATE INDEX ix_paciente_apellido_nombre ON paciente(apellido, nombre);
CREATE INDEX ix_paciente_fecha_nacimiento ON paciente(fecha_nacimiento);

-- =========================================================
-- HISTORIAL CLINICO (1:1 con paciente)
-- =========================================================

CREATE TABLE historial_clinico (
  id                BIGSERIAL PRIMARY KEY,
  paciente_id       BIGINT       NOT NULL UNIQUE REFERENCES paciente(id) ON DELETE CASCADE,
  fecha_apertura    DATE         NOT NULL DEFAULT CURRENT_DATE,
  notas_generales   TEXT,
  cerrado           BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =========================================================
-- ENTRADA HISTORIAL (eventos clínicos)
-- =========================================================

CREATE TABLE entrada_historial (
  id              BIGSERIAL PRIMARY KEY,
  historial_id    BIGINT       NOT NULL REFERENCES historial_clinico(id) ON DELETE CASCADE,
  fecha           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  tipo            VARCHAR(50)  NOT NULL,
  descripcion     TEXT         NOT NULL,
  autor_id        BIGINT       REFERENCES usuario(id) ON DELETE SET NULL
);

CREATE INDEX ix_entrada_historial ON entrada_historial(historial_id, fecha DESC);

-- =========================================================
-- CITA
-- =========================================================

CREATE TABLE cita (
  id              BIGSERIAL PRIMARY KEY,
  paciente_id     BIGINT       NOT NULL REFERENCES paciente(id) ON DELETE RESTRICT,
  medico_id       BIGINT       REFERENCES usuario(id) ON DELETE SET NULL,
  fecha           DATE         NOT NULL,
  hora_inicio     TIME         NOT NULL,
  hora_fin        TIME         NOT NULL,
  tipo_servicio   tipo_cita    NOT NULL,
  motivo          TEXT,
  estado          estado_cita  NOT NULL DEFAULT 'PROGRAMADA',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_cita_horas CHECK (hora_fin > hora_inicio)
);

CREATE INDEX ix_cita_fecha ON cita(fecha);
CREATE INDEX ix_cita_medico_fecha ON cita(medico_id, fecha);
CREATE INDEX ix_cita_paciente ON cita(paciente_id);
CREATE INDEX ix_cita_estado ON cita(estado);

CREATE UNIQUE INDEX uq_cita_slot_medico
  ON cita(medico_id, fecha, hora_inicio)
  WHERE medico_id IS NOT NULL AND estado IN ('PROGRAMADA','CONFIRMADA','EN_CURSO');

-- =========================================================
-- SERVICIO (catálogo de prestaciones)
-- =========================================================

CREATE TABLE servicio (
  id                BIGSERIAL PRIMARY KEY,
  codigo            VARCHAR(30)  UNIQUE,
  nombre            VARCHAR(150) NOT NULL,
  descripcion       TEXT,
  precio            NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
  duracion_minutos  INTEGER      NOT NULL CHECK (duracion_minutos > 0),
  activo            BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =========================================================
-- PRODUCTO (inventario farmacia)
-- =========================================================

CREATE TABLE producto (
  id              BIGSERIAL PRIMARY KEY,
  sku             VARCHAR(40)  UNIQUE,
  nombre          VARCHAR(150) NOT NULL,
  descripcion     TEXT,
  unidad          VARCHAR(30)  NOT NULL DEFAULT 'unidad',
  precio_venta    NUMERIC(10,2) NOT NULL CHECK (precio_venta >= 0),
  stock_actual    INTEGER      NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  stock_minimo    INTEGER      NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  activo          BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_producto_stock_bajo
  ON producto(stock_actual) WHERE activo = TRUE AND stock_actual <= stock_minimo;

-- =========================================================
-- CONSULTA (registro clínico)
-- =========================================================

CREATE TABLE consulta (
  id              BIGSERIAL PRIMARY KEY,
  cita_id         BIGINT       NOT NULL UNIQUE REFERENCES cita(id) ON DELETE RESTRICT,
  paciente_id     BIGINT       NOT NULL REFERENCES paciente(id) ON DELETE RESTRICT,
  medico_id       BIGINT       REFERENCES usuario(id) ON DELETE RESTRICT,
  fecha_hora      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  sintomas        TEXT         NOT NULL,
  diagnostico     TEXT         NOT NULL,
  tratamiento     TEXT,
  observaciones   TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_consulta_paciente ON consulta(paciente_id, fecha_hora DESC);
CREATE INDEX ix_consulta_medico ON consulta(medico_id, fecha_hora DESC);

-- =========================================================
-- CONSULTA_SERVICIO (N:M consulta - servicio)
-- =========================================================

CREATE TABLE consulta_servicio (
  id              BIGSERIAL PRIMARY KEY,
  consulta_id     BIGINT       NOT NULL REFERENCES consulta(id) ON DELETE CASCADE,
  servicio_id     BIGINT       NOT NULL REFERENCES servicio(id) ON DELETE RESTRICT,
  cantidad        INTEGER      NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_cobrado  NUMERIC(10,2) NOT NULL CHECK (precio_cobrado >= 0),
  UNIQUE (consulta_id, servicio_id)
);

-- =========================================================
-- PRESCRIPCION (receta médica)
-- =========================================================

CREATE TABLE prescripcion (
  id              BIGSERIAL PRIMARY KEY,
  consulta_id     BIGINT       NOT NULL REFERENCES consulta(id) ON DELETE CASCADE,
  producto_id     BIGINT       NOT NULL REFERENCES producto(id) ON DELETE RESTRICT,
  cantidad        INTEGER      NOT NULL CHECK (cantidad > 0),
  dosis           VARCHAR(120),
  frecuencia      VARCHAR(120),
  duracion        VARCHAR(120),
  indicaciones    TEXT,
  precio_unitario_cobrado NUMERIC(10,2) NOT NULL CHECK (precio_unitario_cobrado >= 0)
);

CREATE INDEX ix_prescripcion_consulta ON prescripcion(consulta_id);
CREATE INDEX ix_prescripcion_producto ON prescripcion(producto_id);

-- =========================================================
-- FACTURA (1:1 con consulta)
-- =========================================================

CREATE TABLE factura (
  id              BIGSERIAL PRIMARY KEY,
  numero          VARCHAR(30)  NOT NULL UNIQUE,
  consulta_id     BIGINT       NOT NULL UNIQUE REFERENCES consulta(id) ON DELETE RESTRICT,
  paciente_id     BIGINT       NOT NULL REFERENCES paciente(id) ON DELETE RESTRICT,
  fecha_emision   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  subtotal        NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  impuestos       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (impuestos >= 0),
  total           NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  estado          estado_factura NOT NULL DEFAULT 'EMITIDA',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_factura_paciente ON factura(paciente_id, fecha_emision DESC);
CREATE INDEX ix_factura_estado ON factura(estado);

-- =========================================================
-- ITEM FACTURA
-- =========================================================

CREATE TABLE item_factura (
  id              BIGSERIAL PRIMARY KEY,
  factura_id      BIGINT       NOT NULL REFERENCES factura(id) ON DELETE CASCADE,
  tipo            tipo_item_factura NOT NULL,
  ref_id          BIGINT       NOT NULL,
  descripcion     VARCHAR(200) NOT NULL,
  cantidad        NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal        NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX ix_item_factura_factura ON item_factura(factura_id);

-- =========================================================
-- ARCHIVO (adjuntos a paciente o consulta)
-- =========================================================

CREATE TABLE archivo (
  id              BIGSERIAL PRIMARY KEY,
  paciente_id     BIGINT       REFERENCES paciente(id) ON DELETE CASCADE,
  consulta_id     BIGINT       REFERENCES consulta(id) ON DELETE CASCADE,
  nombre          VARCHAR(255) NOT NULL,
  path            VARCHAR(500) NOT NULL,
  mime            VARCHAR(100) NOT NULL,
  size_bytes      BIGINT       NOT NULL CHECK (size_bytes > 0),
  uploaded_by     BIGINT       REFERENCES usuario(id) ON DELETE SET NULL,
  uploaded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_archivo_entidad CHECK (
    (paciente_id IS NOT NULL AND consulta_id IS NULL) OR
    (paciente_id IS NULL AND consulta_id IS NOT NULL) OR
    (paciente_id IS NOT NULL AND consulta_id IS NOT NULL)
  )
);

CREATE INDEX ix_archivo_paciente ON archivo(paciente_id);
CREATE INDEX ix_archivo_consulta ON archivo(consulta_id);

-- =========================================================
-- NOTIFICACION (recordatorios)
-- =========================================================

CREATE TABLE notificacion (
  id              BIGSERIAL PRIMARY KEY,
  cita_id         BIGINT       NOT NULL REFERENCES cita(id) ON DELETE CASCADE,
  canal           VARCHAR(20)  NOT NULL,
  estado          VARCHAR(20)  NOT NULL DEFAULT 'PENDIENTE',
  payload         TEXT         NOT NULL,
  enviado_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_notificacion_cita ON notificacion(cita_id);

-- =========================================================
-- AUDIT LOG (requisito: logs de operaciones)
-- =========================================================

CREATE TABLE audit_log (
  id                  BIGSERIAL PRIMARY KEY,
  usuario_id          BIGINT       REFERENCES usuario(id) ON DELETE SET NULL,
  username_snapshot   VARCHAR(50),
  accion              accion_audit NOT NULL,
  tabla               VARCHAR(60),
  registro_id         BIGINT,
  datos_anteriores    JSONB,
  datos_nuevos        JSONB,
  ruta                VARCHAR(200),
  metodo              VARCHAR(10),
  ip                  VARCHAR(45),
  user_agent          VARCHAR(255),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_audit_usuario_fecha ON audit_log(usuario_id, created_at DESC);
CREATE INDEX ix_audit_accion_fecha ON audit_log(accion, created_at DESC);
CREATE INDEX ix_audit_tabla_registro ON audit_log(tabla, registro_id);

-- =========================================================
-- USER LOGIN LOG (intentos de login)
-- =========================================================

CREATE TABLE user_login_log (
  id              BIGSERIAL PRIMARY KEY,
  usuario_id      BIGINT       REFERENCES usuario(id) ON DELETE SET NULL,
  username_intento VARCHAR(50) NOT NULL,
  exito           BOOLEAN      NOT NULL,
  motivo_fallo    VARCHAR(120),
  ip              VARCHAR(45),
  user_agent      VARCHAR(255),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_login_log_usuario_fecha ON user_login_log(usuario_id, created_at DESC);
CREATE INDEX ix_login_log_fallos ON user_login_log(exito, created_at DESC) WHERE exito = FALSE;

-- =========================================================
-- SECUENCIA PARA NUMERO DE FACTURA
-- =========================================================

DROP SEQUENCE IF EXISTS consultorio.factura_numero_seq CASCADE;
CREATE SEQUENCE factura_numero_seq START 1 INCREMENT 1;

COMMENT ON SCHEMA consultorio IS 'Esquema principal de Consultorio Las Gaviotas - Sistema de Gestión Médica';
COMMENT ON TABLE  audit_log IS 'Registro de todas las operaciones del sistema (requisito de auditoría)';
COMMENT ON TABLE  user_login_log IS 'Registro de intentos de login (éxitos y fallos)';
COMMENT ON TABLE  consulta IS 'Registro clínico generado a partir de una cita atendida';
COMMENT ON TABLE  prescripcion IS 'Receta médica emitida en una consulta';
COMMENT ON TABLE  paciente IS 'Persona atendida en el consultorio';