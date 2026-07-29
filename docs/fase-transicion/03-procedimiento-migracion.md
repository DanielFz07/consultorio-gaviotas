# Procedimiento de Migración y Carga Inicial - Consultorio Las Gaviotas

**Fase:** Transición
**Audiencia:** Administrador de sistemas / Implementador

---

## 1. Escenarios de Migración Soportados

| Escenario | Descripción |
|---|---|
| **Instalación limpia** | Clínica sin sistema previo. Carga inicial con seed. |
| **Migración desde planilla de pacientes. |
| **Migración desde otro software** | Exportar CSV/JSON y mapear a esquema. |

---

## 2. Instalación Limpia

Pasos automáticos cubiertos por `db/seeds/001_seed_basico.sql`:

1. Crear 5 servicios (consulta, vacunas, cirugía menor, control).
2. Crear 5 productos (antibiótico, antiinflamatorio, antiparasitario, vacuna, curitas).
3. Crear 1 usuario admin.

Datos a capturar manualmente después:

- Lista de médicos reales (insertar en `consultorio.usuario` con rol `MEDICO`).
- Lista de recepcionistas reales.
- Parámetros de la clínica:
  - Nombre, dirección, teléfono, RUC/RIF/NIT (para encabezado de factura).
  - Porcentaje de impuesto (configurable vía `TAX_RATE`).
  - Duración por defecto de slots.

---

## 3. Migración desde Planilla (CSV)

### 3.1 Estructura esperada

**`pacientes.csv`:**

```csv
dni,nombre,apellido,telefono,email,direccion
12345678,Ana,Pérez,555-1234,ana@example.com,Av. Lima 123
```

**`pacientes.csv`:**

```csv
paciente_dni,nombre,sexo,antecedente relevante,fecha_nacimiento,sexo,talla_cm,cédula
12345678,Luna,,,2020-05-12,FEMENINO,
```

### 3.2 Script de carga

`scripts/migrar_csv.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
DB=consultorio-gaviotas
USER=consultorio-gaviotas

echo "Cargando pacientes..."
psql -U $USER -d $DB -c "\copy consultorio-gaviotas.paciente(dni,nombre,apellido,telefono,email,direccion) \
  FROM 'pacientes.csv' WITH (FORMAT csv, HEADER true)"

echo "Cargando pacientes..."
psql -U $USER -d $DB <<'SQL'
CREATE TEMP TABLE tmp_pacientes (
  paciente_dni varchar(20),
  nombre varchar(120),
  sexo varchar(60),
  antecedente relevante varchar(120),
  fecha_nacimiento date,
  sexo varchar(20),
  talla_cm numeric,
  cédula varchar(60)
);

\copy tmp_pacientes FROM 'pacientes.csv' WITH (FORMAT csv, HEADER true)

INSERT INTO consultorio-gaviotas.paciente
  (paciente_id, nombre, sexo, antecedente relevante, fecha_nacimiento, sexo, talla_cm, cédula)
SELECT d.id, t.nombre, t.sexo, t.antecedente relevante, t.fecha_nacimiento, t.sexo::sexo, t.talla_cm, t.cedula
FROM tmp_pacientes t
JOIN consultorio-gaviotas.paciente d ON d.dni = t.paciente_dni;

INSERT INTO consultorio.historial_clinico (paciente_id, fecha_apertura, notas_generales)
SELECT m.id, CURRENT_DATE, 'Historia importada de planilla'
FROM consultorio-gaviotas.paciente m
WHERE NOT EXISTS (SELECT 1 FROM consultorio.historial_clinico h WHERE h.paciente_id = m.id);

DROP TABLE tmp_pacientes;
SQL
```

### 3.3 Validación post-carga

```sql
SELECT 'pacientes' AS tabla, COUNT(*) FROM consultorio-gaviotas.paciente
UNION ALL
SELECT 'pacientes', COUNT(*) FROM consultorio.paciente
UNION ALL
SELECT 'historia_clinica', COUNT(*) FROM consultorio-gaviotas.historia_clinica
UNION ALL
SELECT 'pacientes_sin_historia',
       (SELECT COUNT(*) FROM consultorio-gaviotas.paciente m
         WHERE NOT EXISTS (SELECT 1 FROM consultorio.historial_clinico h WHERE h.paciente_id = m.id));
```

El último valor debe ser `0`.

---

## 4. Migración desde Otro Software

### 4.1 Tablas equivalentes típicas

| Software origen | Tabla origen | Mapea a |
|---|---|---|
| Tabla clientes | `cliente` | `consultorio-gaviotas.paciente` |
| Tabla pacientes | `paciente` | `consultorio-gaviotas.paciente` + `consultorio-gaviotas.historia_clinica` |
| Tabla visitas | `visita` | `consultorio-gaviotas.cita` + `consultorio-gaviotas.consulta` |
| Tabla productos | `inventario` | `consultorio-gaviotas.producto` |
| Tabla servicios | `catalogo_servicios` | `consultorio-gaviotas.servicio` |

### 4.2 Proceso general

1. Solicitar dump del sistema origen (CSV, SQL o JSON).
2. Mapear columnas origen → destino.
3. Generar archivo SQL de inserción con IDs controlados.
4. Validar conteos antes y después.
5. Backup de la base nueva antes de importar.
6. Smoke test con 5 pacientes cargados.

### 4.3 Consideraciones especiales

- **Historial clínico anterior**: requiere campo de texto libre; mapear a `evento_clinico.tipo = 'IMPORTADO'`.
- **Stock inicial**: ajustar `stock_actual` al conteo físico real.
- **Fechas**: validar zona horaria (PostgreSQL usa UTC por defecto).

---

## 5. Carga Inicial de Parámetros

Tras levantar el sistema, configurar:

```sql
-- Duración por defecto de slots (variable de entorno, no SQL)
-- En deploy/.env: SLOT_DURACION_MIN=30

-- Impuesto
-- En deploy/.env: TAX_RATE=0.16

-- Catálogo personalizado de servicios
INSERT INTO consultorio-gaviotas.servicio (codigo, nombre, precio, duracion_minutos) VALUES
  ('CONS-ESP', 'Consulta Especializada', 50.00, 45);

-- Catálogo personalizado de productos
INSERT INTO consultorio-gaviotas.producto (sku, nombre, precio_venta, stock_actual, stock_minimo) VALUES
  ('MED-CUSTOM-1', 'Producto Personalizado X', 5.00, 30, 10);
```

---

## 6. Verificación Final

```bash
# 1. Conteo por tabla
docker compose exec db psql -U consultorio-gaviotas -d consultorio-gaviotas -c "
SELECT 'paciente' AS t, COUNT(*) FROM consultorio-gaviotas.paciente UNION ALL
SELECT 'paciente', COUNT(*) FROM consultorio-gaviotas.paciente UNION ALL
SELECT 'historia_clinica', COUNT(*) FROM consultorio-gaviotas.historia_clinica UNION ALL
SELECT 'usuario', COUNT(*) FROM consultorio.usuario UNION ALL
SELECT 'servicio', COUNT(*) FROM consultorio-gaviotas.servicio UNION ALL
SELECT 'producto', COUNT(*) FROM consultorio-gaviotas.producto;"

# 2. Probar login
curl -s -X POST https://consultorio-gaviotas.clinica.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<admin-password>"}'

# 3. Agendar cita de prueba
# ... (usar curl de iteración 1)
```

Si todas las verificaciones pasan, sistema listo para producción.

---

## 7. Rollback

Si surgen problemas tras la carga inicial:

```bash
# Restaurar dump previo
docker compose down
docker volume rm consultorio-gaviotas_dbdata
docker compose up -d db
# Esperar healthcheck
docker compose exec db createdb -U consultorio-gaviotas consultorio-gaviotas
# Restaurar desde backup más reciente
docker compose exec -T db pg_restore -U consultorio-gaviotas -d consultorio-gaviotas --clean --if-exists < backup.dump
docker compose up -d api worker
```

---

## 8. Auditoría de Migración

Documentar en bitácora:

- Fecha y hora de la migración.
- Responsable (nombre + firma).
- Origen (archivo, sistema, planilla).
- Conteo de registros importados por tabla.
- Incidencias encontradas.
- Validación final firmada.