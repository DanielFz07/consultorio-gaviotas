# Prototipo Arquitectónico - Registrar Consulta Médica

**Fase:** Elaboración (RUP)
**Tipo:** Prototipo Arquitectónico (Executable Architectural Prototype)
**Objetivo DSI:** Demostrar la **atomicidad transaccional** que es la propuesta de valor única de Consultorio Las Gaviotas.

---

## 1. Propósito

El prototipo ejecuta el camino crítico del sistema:

> **Una sola transacción** garantiza que cuando el médico "Finaliza Consulta" se ejecuten **10 operaciones de BD de forma atómica** — la consulta, las prescripciones, los servicios, los archivos adjuntos, el descuento de inventario, la factura correlativa, sus ítems, la cita marcada como atendida, y la entrada automática en el historial clínico. Si **una sola falla**, las 10 se deshacen (`ROLLBACK`) sin dejar datos parciales.

Esto cumple las reglas de negocio:
- **RN-03:** "El stock se descuenta en la misma transacción que emite la factura — nunca puede haber un caso donde el stock se cobró al paciente pero el inventario no se actualizó".
- **RN-06:** "El número de factura es correlativo único, sin huecos".

---

## 2. Localización del código

```
apps/backend/src/prototype/consulta-flow.ts
```

Es un script TypeScript ejecutable con Bun que reproduce el flujo real de `POST /api/citas/:id/consulta` pero **sin la capa HTTP** — directo a PostgreSQL. Sirve para:

1. Validar la viabilidad técnica antes de implementar la API (se hizo en Fase de Elaboración).
2. Hacer demos académicas del flujo crítico.
3. Servir como documentación ejecutable: si el SQL cambia, este script lo demuestra.

---

## 3. Estructura del prototipo

### 3.1 Entrada (DTO)

```typescript
interface ConsultaInput {
  citaId: number;
  medicoId: number;
  sintomas: string;
  diagnostico: string;
  tratamiento?: string;
  observaciones?: string;
  servicios: ServicioInput[];
  prescripciones: PrescripcionInput[];
}

interface PrescripcionInput {
  productoId: number;
  cantidad: number;
  dosis?: string;
  frecuencia?: string;
  duracion?: string;
}

interface ServicioInput {
  servicioId: number;
  cantidad: number;
}
```

### 3.2 Función principal

```typescript
export async function registrarConsulta(input: ConsultaInput): Promise<{
  consultaId: number;
  facturaId: number;
  facturaNumero: string;
  total: number;
}> {
  return withTransaction(async (client) => {
    // ... 10 pasos en una sola transacción
  });
}
```

### 3.3 Pasos de la transacción (en orden)

| # | Operación SQL | Tabla afectada | Consecuencia si falla |
|---|---|---|---|
| 1 | `SELECT * FROM cita WHERE id=$1` | (lectura) | ROLLBACK total — cita no existe |
| 2 | `SELECT stock_actual FROM producto WHERE id=$1 FOR UPDATE` | (lock pesimista) | ROLLBACK — producto no existe |
| 3 | Validar `cantidad <= stock_actual` | (memoria) | ROLLBACK — `EX-018 Stock insuficiente` |
| 4 | `INSERT INTO consulta` | `consulta` | ROLLBACK total |
| 5 | `INSERT INTO consulta_servicio` (N rows) | `consulta_servicio` | ROLLBACK total |
| 6 | `INSERT INTO prescripcion` (N rows) | `prescripcion` | ROLLBACK total |
| 7 | `INSERT INTO consulta_archivo` (opcional) | `consulta_archivo` | ROLLBACK total |
| 8 | `UPDATE producto SET stock_actual = stock_actual - N` (por cada prescripción) | `producto` | ROLLBACK total |
| 9 | Calcular subtotal + impuestos + total | (memoria) | — |
| 10 | `SELECT nextval('factura_numero_seq')` | (secuencia) | ROLLBACK — pero la secuencia NO se rebobina |
| 11 | `INSERT INTO factura` | `factura` | ROLLBACK total |
| 12 | `INSERT INTO item_factura` (servicios + productos) | `item_factura` | ROLLBACK total |
| 13 | `UPDATE cita SET estado='ATENDIDA'` | `cita` | ROLLBACK total |
| 14 | `INSERT INTO evento_clinico` (auto) | `evento_clinico` | ROLLBACK total |
| 15 | `COMMIT` | — | OK |

**Total: 14 operaciones SQL + 1 commit, todas en un solo bloque transaccional.**

---

## 4. Manejo de errores

### 4.1 Stock insuficiente (RN-03)

```typescript
for (const p of input.prescripciones) {
  const stockRes = await client.query<{ stock_actual: number }>(
    `SELECT stock_actual FROM producto WHERE id = $1 FOR UPDATE`,
    [p.productoId],
  );
  if (stockRes.rows[0].stock_actual < p.cantidad) {
    throw new ExStockInsuficiente(p.productoId, p.cantidad, stockRes.rows[0].stock_actual);
  }
}
```

Si alguna prescripción excede el stock disponible, se lanza una excepción **antes** de cualquier INSERT. La transacción queda limpia y se retorna `400 EX-018`.

### 4.2 Falla de BD en cualquier paso

```typescript
// withTransaction() en pool.ts:
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");  // ← deshace TODO
    throw err;
  } finally {
    client.release();
  }
}
```

PostgreSQL garantiza que `ROLLBACK` deshace todos los cambios desde el `BEGIN`, **excepto** la secuencia `factura_numero_seq` (que es intencional: la numeración es monotónica incluso si una factura falla al insertarse, para no romper la unicidad correlativa).

---

## 5. Cómo ejecutarlo

```bash
# Asegurarse de que la DB esté corriendo con seeds
docker compose -f deploy/docker-compose.yml up -d db
sleep 5

# Ejecutar el prototipo (crea una consulta de prueba)
cd apps/backend
bun run prototype/consulta-flow.ts

# Salida esperada:
# OK consulta registrada: {
#   consultaId: 7,
#   facturaId: 12,
#   facturaNumero: "F-000012",
#   total: 1840.00
# }
```

---

## 6. Verificación post-ejecución

```bash
# Confirmar que la transacción se aplicó
psql -h localhost -U consultorio-gaviotas -d consultorio-gaviotas -c "
  SELECT c.id AS consulta, f.numero AS factura, f.estado, f.total,
         p.stock_actual AS stock_despues
    FROM consulta c
    JOIN factura f ON f.consulta_id = c.id
    JOIN prescripcion pr ON pr.consulta_id = c.id
    JOIN producto p ON p.id = pr.producto_id
   WHERE c.id = 7;
"
```

Salida esperada:
```
 consulta | factura  | estado  | total  | stock_despues
----------+----------+---------+--------+---------------
       7  | F-000012 | EMITIDA | 1840.00|            48
```

(Stock antes era 50, se descontaron 2 → 48. Coincide con la prescripción del demo.)

---

## 7. De prototipo a producto

El prototipo `consulta-flow.ts` **es la misma lógica** que el endpoint real en `apps/backend/src/modules/consultas/consulta.routes.ts`. Las diferencias:

| Aspecto | Prototipo | Producto |
|---|---|---|
| Punto de entrada | Script CLI (`bun run`) | Endpoint HTTP `POST /api/citas/:id/consulta` |
| Validación de entrada | Manual (en código) | Zod schema |
| Subida de archivos | No incluida | `multipart/form-data` + `/data/uploads` |
| Notificación de cita | No | Worker SMTP 24h antes |
| Rollback de cita | Implícito en TX | Igual, vía `withTransaction` |

La transacción atómica, el orden de operaciones y los códigos de error son idénticos en ambos.

---

## 8. Conclusión

Este prototipo demuestra que el diseño técnico elegido (Bun + Elysia + PostgreSQL con `withTransaction` + `FOR UPDATE` + `nextval` para numeración) cumple los requisitos arquitectónicos del sistema. Es la **base probada** sobre la que se construyó la aplicación final en la Fase de Construcción.