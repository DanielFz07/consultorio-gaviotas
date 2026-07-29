# Manual del Administrador - Consultorio Las Gaviotas

**Fase:** Transición
**Audiencia:** Administrador del sistema / Responsable de TI

---

## 1. Responsabilidades del Administrador

- Gestionar usuarios y roles.
- Mantener catálogo de servicios y productos.
- Configurar parámetros globales (impuesto, SMTP, intervalos).
- Supervisar backups.
- Monitorear logs y métricas.
- Ejecutar actualizaciones.
- Responder a incidentes de seguridad.

---

## 2. Gestión de Usuarios

### 2.1 Crear usuario (procedimiento SQL hasta que endpoint admin esté disponible)

```bash
docker compose exec db psql -U consultorio-gaviotas -d consultorio-gaviotas
```

```sql
-- Generar hash bcrypt (desde host):
-- docker run --rm oven/bun:alpine bun -e "
--   const b = await import('bcryptjs');
--   console.log(await b.default.hash('password-real', 12));
-- "

INSERT INTO consultorio.usuario (username, password_hash, nombre, rol, email, activo)
VALUES (
  'med2',
  '<hash-bcrypt>',
  'Dra. Gómez',
  'MEDICO',
  'gomez@consultorio-gaviotas.local',
  TRUE
);
```

### 2.2 Cambiar rol

```sql
UPDATE consultorio.usuario SET rol = 'MEDICO' WHERE username = 'med2';
```

### 2.3 Desactivar usuario

```sql
UPDATE consultorio.usuario SET activo = FALSE WHERE username = 'med_antiguo';
```

El usuario no podrá hacer login pero su histórico se preserva.

### 2.4 Resetear contraseña

```sql
UPDATE consultorio.usuario
   SET password_hash = '<nuevo-hash-bcrypt>'
 WHERE username = 'recep';
```

Comunicar nueva contraseña por canal seguro. Pedir cambio al primer login.

---

## 3. Catálogo de Servicios y Productos

### 3.1 Agregar servicio

```sql
INSERT INTO consultorio-gaviotas.servicio (codigo, nombre, descripcion, precio, duracion_minutos)
VALUES ('CIR-MAY', 'Cirugía Mayor', 'Procedimiento quirúrgico con internación', 350.00, 120);
```

### 3.2 Actualizar precio de producto

```sql
UPDATE consultorio-gaviotas.producto SET precio_venta = 1.75 WHERE sku = 'MED-ABX-250';
```

**Advertencia:** los precios históricos quedan en `consulta_servicio.precio_cobrado` y `prescripcion.precio_unitario_cobrado` (no se modifican retroactivamente).

### 3.3 Reponer stock

```sql
UPDATE consultorio-gaviotas.producto SET stock_actual = stock_actual + 100 WHERE sku = 'MED-ABX-250';
```

### 3.4 Desactivar producto

```sql
UPDATE consultorio-gaviotas.producto SET activo = FALSE WHERE sku = 'MED-VIEJO';
```

Productos inactivos no se pueden prescribir (EX-012).

---

## 4. Parámetros Globales

Editables vía `deploy/.env`:

```env
TAX_RATE=0.16            # Porcentaje de impuesto (0.16 = 16% IVA)
WORKER_INTERVAL_MS=60000 # Frecuencia del worker (60s por defecto)
```

Tras cambiar, reiniciar:

```bash
docker compose restart api worker
```

---

## 5. Backups

### 5.1 Verificar último backup

```bash
ls -lht /opt/consultorio-gaviotas/backups/ | head -5
```

### 5.2 Ejecutar backup manual

```bash
/opt/consultorio-gaviotas/scripts/backup.sh
```

### 5.3 Restaurar desde backup

Ver `02-implantacion-docker.md` sección 5.2.

### 5.4 Verificar integridad del dump

```bash
docker compose exec -T db pg_restore -l /opt/consultorio-gaviotas/backups/db_$(date +%Y%m%d).dump
```

Si lista contenido sin errores, el dump es válido.

---

## 6. Monitoreo

### 6.1 Healthcheck

```bash
curl -s https://consultorio-gaviotas.clinica.com/api/health | jq
```

Salida esperada:

```json
{
  "ok": true,
  "db": true,
  "timestamp": "2026-07-19T10:30:00.000Z"
}
```

### 6.2 Logs de aplicación

```bash
docker compose logs -f --tail=200 api worker
```

Para errores específicos de una consulta:

```bash
docker compose logs api | grep "EX-011" | tail -20
```

### 6.3 Disco y memoria

```bash
df -h /
free -h
docker system df
```

### 6.4 Conexiones activas DB

```sql
SELECT datname, usename, application_name, state, count(*)
FROM pg_stat_activity
WHERE datname = 'consultorio-gaviotas'
GROUP BY 1,2,3,4;
```

Si `count > 50`, considerar pool más grande.

---

## 7. Catálogo de Excepciones - Referencia Rápida

| Código | Severidad | Acción admin |
|---|---|---|
| EX-017 | Alta | DB caída: revisar contenedor db, restaurar backup |
| EX-020 | Alta | Deadlock: revisar índice faltante en queries |
| EX-023 | Alta | Disco lleno: liberar espacio, revisar volumen uploads |
| EX-024 | Media | SMTP caído: verificar credenciales, cambiar host |
| EX-026 | Alta | Saturación: escalar servidor |
| EX-028 | Alta | SQL injection detectado: bloquear IP, auditar logs |
| EX-029 | Alta | Login sospechoso: revisar intentos fallidos |

---

## 8. Actualización del Sistema

```bash
cd /opt/consultorio-gaviotas
git pull origin main
cd deploy
docker compose build
docker compose up -d
```

Verificar:

```bash
docker compose ps
curl -s https://consultorio-gaviotas.clinica.com/api/health
```

Si hay nueva migración, se aplica automáticamente al arrancar el contenedor `api`.

---

## 9. Respuesta a Incidentes

### 9.1 Robo de credenciales admin

1. Cambiar `JWT_SECRET` en `.env`.
2. Reiniciar `api`.
3. Resetear contraseña del usuario afectado.
4. Auditar accesos recientes:

```sql
-- (Si se implementa tabla auditoria_evento)
SELECT * FROM auditoria_evento
WHERE usuario_id = X
  AND timestamp > NOW() - INTERVAL '7 days'
ORDER BY timestamp DESC;
```

### 9.2 Caída de DB

1. `docker compose ps db` para ver estado.
2. `docker compose logs db` para error.
3. Si no levanta: restaurar último backup (procedimiento sección 5.3).

### 9.3 Disco lleno

1. `docker system prune -a` (cuidado: borra imágenes no usadas).
2. Reducir retención de backups.
3. Mover backups antiguos a storage externo.

---

## 10. Normas de Administración de BD

- **Nunca** ejecutar `DROP TABLE` en producción sin backup verificado.
- **Siempre** probar queries destructivas en staging.
- **No** deshabilitar FKs ni constraints sin justificación documentada.
- **Sí** usar `EXPLAIN ANALYZE` antes de agregar índices.
- **Sí** documentar todo cambio DDL en bitácora.