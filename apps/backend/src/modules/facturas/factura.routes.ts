import { Elysia } from "elysia";
import { pool } from "../../db/pool.ts";

export const facturaRoutes = new Elysia({ prefix: "/api/facturas" })
  .get("/", async ({ query }) => {
    const fecha = query.fecha as string | undefined;
    if (fecha) {
      const { rows } = await pool.query(
        `SELECT f.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido
           FROM consultorio.factura f
           JOIN consultorio.paciente p ON p.id = f.paciente_id
          WHERE DATE(f.fecha_emision) = $1
          ORDER BY f.fecha_emision DESC`,
        [fecha],
      );
      return rows;
    }
    const { rows } = await pool.query(
      `SELECT f.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido
         FROM consultorio.factura f
         JOIN consultorio.paciente p ON p.id = f.paciente_id
        ORDER BY f.fecha_emision DESC LIMIT 50`,
    );
    return rows;
  })
  .get("/:id", async ({ params, set }) => {
    const cab = await pool.query(
      `SELECT f.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido, p.cedula AS paciente_cedula
         FROM consultorio.factura f
         JOIN consultorio.paciente p ON p.id = f.paciente_id
        WHERE f.id = $1`,
      [params.id],
    );
    if (cab.rowCount === 0) {
      set.status = 404;
      return { code: "EX-019", message: "Factura no encontrada" };
    }
    const items = await pool.query(
      `SELECT * FROM consultorio.item_factura WHERE factura_id = $1 ORDER BY id`,
      [params.id],
    );
    return { ...cab.rows[0], items: items.rows };
  })
  .post("/:id/pagar", async ({ params, set }) => {
    const { rowCount } = await pool.query(
      `UPDATE consultorio.factura SET estado = 'PAGADA'
        WHERE id = $1 AND estado = 'EMITIDA'`,
      [params.id],
    );
    if (rowCount === 0) {
      set.status = 409;
      return { code: "EX-016", message: "Factura no emitida o ya pagada" };
    }
    return { ok: true };
  })
  .post("/:id/anular", async ({ params, body, set, user }) => {
    if (user.rol !== "ADMIN") {
      set.status = 403;
      return { code: "EX-003", message: "Solo admin" };
    }
    const motivo = (body as { motivo?: string })?.motivo ?? "Sin motivo";
    const { rowCount } = await pool.query(
      `UPDATE consultorio.factura SET estado = 'ANULADA'
        WHERE id = $1 AND estado IN ('EMITIDA','PAGADA')`,
      [params.id],
    );
    if (rowCount === 0) {
      set.status = 409;
      return { code: "EX-016", message: "Factura no anulable" };
    }
    return { ok: true, motivo };
  });