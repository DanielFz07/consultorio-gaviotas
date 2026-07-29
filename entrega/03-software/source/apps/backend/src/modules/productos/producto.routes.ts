import { Elysia } from "elysia";
import { z } from "zod";
import { pool } from "../../db/pool.ts";

const productoSchema = z.object({
  sku: z.string().max(40).optional().nullable(),
  nombre: z.string().min(1).max(150),
  descripcion: z.string().optional().nullable(),
  unidad: z.string().max(30).default("unidad"),
  precioVenta: z.number().nonnegative(),
  stockActual: z.number().int().nonnegative().default(0),
  stockMinimo: z.number().int().nonnegative().default(0),
});

const servicioSchema = z.object({
  codigo: z.string().max(30).optional().nullable(),
  nombre: z.string().min(1).max(150),
  descripcion: z.string().optional().nullable(),
  precio: z.number().nonnegative(),
  duracionMinutos: z.number().int().positive(),
  activo: z.boolean().optional(),
});

export const productoRoutes = new Elysia({ prefix: "/api/productos" })
  .derive(async ({ headers, jwt, set }) => {
    const auth = headers["authorization"];
    if (!auth?.startsWith("Bearer ")) {
      set.status = 401;
      throw new Error("EX-002 Token requerido");
    }
    const payload = (await jwt.verify(auth.slice(7))) as { rol: string; sub: string } | false;
    if (!payload) {
      set.status = 401;
      throw new Error("EX-030 Token inválido o expirado");
    }
    // Read access: ADMIN and MEDICO (médico needs to see inventory for prescriptions)
    // Write access is enforced per-endpoint below.
    if (!["ADMIN", "MEDICO"].includes(payload.rol)) {
      set.status = 403;
      throw new Error("EX-003 Rol sin permisos");
    }
    return { user: payload };
  })
  .get("/", async ({ query }) => {
    const bajo = query.bajoStock === "true";
    if (bajo) {
      const { rows } = await pool.query(
        `SELECT * FROM consultorio.producto
          WHERE activo = TRUE AND stock_actual <= stock_minimo
          ORDER BY nombre`,
      );
      return rows;
    }
    const { rows } = await pool.query(
      `SELECT * FROM consultorio.producto WHERE activo = TRUE ORDER BY nombre`,
    );
    return rows;
  })
  .get("/:id", async ({ params, set }) => {
    const { rows } = await pool.query(
      `SELECT * FROM consultorio.producto WHERE id = $1`,
      [params.id],
    );
    if (rows.length === 0) {
      set.status = 404;
      return { code: "EX-019", message: "Producto no encontrado" };
    }
    return rows[0];
  })
  .post("/", async ({ body, set, user }) => {
    if (user.rol !== "ADMIN") {
      set.status = 403;
      return { code: "EX-003", message: "Solo admin" };
    }
    const parsed = productoSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { code: "EX-004", message: "Datos inválidos" };
    }
    const p = parsed.data;
    const { rows } = await pool.query(
      `INSERT INTO consultorio.producto
         (sku, nombre, descripcion, unidad, precio_venta, stock_actual, stock_minimo)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [p.sku ?? null, p.nombre, p.descripcion ?? null, p.unidad, p.precioVenta, p.stockActual, p.stockMinimo],
    );
    set.status = 201;
    return rows[0];
  })
  .patch("/:id", async ({ params, body, set, user }) => {
    if (user.rol !== "ADMIN") {
      set.status = 403;
      return { code: "EX-003", message: "Solo admin" };
    }
    const parsed = productoSchema.partial().safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { code: "EX-004", message: "Datos inválidos" };
    }
    const keys = Object.keys(parsed.data);
    if (keys.length === 0) {
      set.status = 400;
      return { code: "EX-004", message: "Sin cambios" };
    }
    const map: Record<string, string> = {
      sku: "sku",
      nombre: "nombre",
      descripcion: "descripcion",
      unidad: "unidad",
      precioVenta: "precio_venta",
      stockActual: "stock_actual",
      stockMinimo: "stock_minimo",
    };
    const sets = keys.map((k, i) => `${map[k]} = $${i + 1}`).join(", ");
    const values = Object.values(parsed.data);
    values.push(params.id);
    const { rows } = await pool.query(
      `UPDATE consultorio.producto SET ${sets}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values,
    );
    set.status = 200;
    return rows[0];
  })
  .patch("/:id/reponer", async ({ params, body, set, user }) => {
    if (user.rol !== "ADMIN") {
      set.status = 403;
      return { code: "EX-003", message: "Solo admin" };
    }
    const cant = Number((body as { cantidad?: number })?.cantidad);
    if (!Number.isFinite(cant) || cant <= 0) {
      set.status = 400;
      return { code: "EX-004", message: "Cantidad inválida" };
    }
    const { rows } = await pool.query(
      `UPDATE consultorio.producto SET stock_actual = stock_actual + $1, updated_at = NOW()
        WHERE id = $2 RETURNING *`,
      [cant, params.id],
    );
    return rows[0];
  })
  .delete("/:id", async ({ params, set, user }) => {
    if (user.rol !== "ADMIN") {
      set.status = 403;
      return { code: "EX-003", message: "Solo admin" };
    }
    const { rowCount } = await pool.query(
      `UPDATE consultorio.producto SET activo = FALSE, updated_at = NOW() WHERE id = $1`,
      [params.id],
    );
    if (rowCount === 0) {
      set.status = 404;
      return { code: "EX-019", message: "Producto no encontrado" };
    }
    return { ok: true };
  });

export const servicioRoutes = new Elysia({ prefix: "/api/servicios" })
  .derive(async ({ headers, jwt, set }) => {
    const auth = headers["authorization"];
    if (!auth?.startsWith("Bearer ")) {
      set.status = 401;
      throw new Error("EX-002 Token requerido");
    }
    const payload = (await jwt.verify(auth.slice(7))) as { rol: string; sub: string } | false;
    if (!payload) {
      set.status = 401;
      throw new Error("EX-030 Token inválido o expirado");
    }
    // Read access: ADMIN and MEDICO (médico needs to see services to add to consultations)
    // Write access is enforced per-endpoint below.
    if (!["ADMIN", "MEDICO"].includes(payload.rol)) {
      set.status = 403;
      throw new Error("EX-003 Rol sin permisos");
    }
    return { user: payload };
  })
  .get("/", async ({ query }) => {
    if (query.todos === "true") {
      const { rows } = await pool.query(
        `SELECT * FROM consultorio.servicio ORDER BY nombre`,
      );
      return rows;
    }
    const { rows } = await pool.query(
      `SELECT * FROM consultorio.servicio WHERE activo = TRUE ORDER BY nombre`,
    );
    return rows;
  })
  .get("/:id", async ({ params, set }) => {
    const { rows } = await pool.query(
      `SELECT * FROM consultorio.servicio WHERE id = $1`,
      [params.id],
    );
    if (rows.length === 0) {
      set.status = 404;
      return { code: "EX-019", message: "Servicio no encontrado" };
    }
    return rows[0];
  })
  .post("/", async ({ body, set, user }) => {
    if (user.rol !== "ADMIN") {
      set.status = 403;
      return { code: "EX-003", message: "Solo admin" };
    }
    const parsed = servicioSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { code: "EX-004", message: "Datos inválidos" };
    }
    const s = parsed.data;
    const { rows } = await pool.query(
      `INSERT INTO consultorio.servicio (codigo, nombre, descripcion, precio, duracion_minutos)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [s.codigo ?? null, s.nombre, s.descripcion ?? null, s.precio, s.duracionMinutos],
    );
    set.status = 201;
    return rows[0];
  })
  .patch("/:id", async ({ params, body, set, user }) => {
    if (user.rol !== "ADMIN") {
      set.status = 403;
      return { code: "EX-003", message: "Solo admin" };
    }
    const parsed = servicioSchema.partial().safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { code: "EX-004", message: "Datos inválidos" };
    }
    const keys = Object.keys(parsed.data);
    if (keys.length === 0) {
      set.status = 400;
      return { code: "EX-004", message: "Sin cambios" };
    }
    const map: Record<string, string> = {
      codigo: "codigo",
      nombre: "nombre",
      descripcion: "descripcion",
      precio: "precio",
      duracionMinutos: "duracion_minutos",
      activo: "activo",
    };
    const sets = keys.map((k, i) => `${map[k]} = $${i + 1}`).join(", ");
    const values = Object.values(parsed.data);
    values.push(params.id);
    const { rows } = await pool.query(
      `UPDATE consultorio.servicio SET ${sets}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (rows.length === 0) {
      set.status = 404;
      return { code: "EX-019", message: "Servicio no encontrado" };
    }
    set.status = 200;
    return rows[0];
  });