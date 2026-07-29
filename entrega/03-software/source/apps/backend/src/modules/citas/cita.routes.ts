import { Elysia } from "elysia";
import { z } from "zod";
import { pool, withTransaction } from "../../db/pool.ts";

const citaSchema = z.object({
  pacienteId: z.number().int().positive(),
  medicoId: z.number().int().positive().optional().nullable(),
  fecha: z.string().date(),
  horaInicio: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  horaFin: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  tipoServicio: z.enum(["CONSULTA", "CONTROL", "EXAMEN", "PROCEDIMIENTO", "OTRO"]),
  motivo: z.string().min(5).max(500),
});

const reprogramarSchema = z.object({
  fecha: z.string().date(),
  horaInicio: z.string(),
  horaFin: z.string(),
  motivo: z.string().min(3).max(200),
});

export const citaRoutes = new Elysia({ prefix: "/api/citas" })
  .get("/", async ({ query }) => {
    const fecha = query.fecha as string | undefined;
    if (fecha) {
      const { rows } = await pool.query(
        `SELECT c.*, p.cedula AS paciente_cedula, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido
           FROM consultorio.cita c
           JOIN consultorio.paciente p ON p.id = c.paciente_id
          WHERE c.fecha = $1
          ORDER BY c.hora_inicio`,
        [fecha],
      );
      return rows;
    }
    const { rows } = await pool.query(
      `SELECT c.*, p.cedula AS paciente_cedula, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido
         FROM consultorio.cita c
         JOIN consultorio.paciente p ON p.id = c.paciente_id
        WHERE c.fecha >= CURRENT_DATE
        ORDER BY c.fecha, c.hora_inicio
        LIMIT 100`,
    );
    return rows;
  })
  .get("/:id", async ({ params, set }) => {
    const { rows } = await pool.query(
      `SELECT c.*, p.cedula AS paciente_cedula, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido,
              u.nombre AS medico_nombre
         FROM consultorio.cita c
         JOIN consultorio.paciente p ON p.id = c.paciente_id
         LEFT JOIN consultorio.usuario u ON u.id = c.medico_id
        WHERE c.id = $1`,
      [params.id],
    );
    if (rows.length === 0) {
      set.status = 404;
      return { code: "EX-019", message: "Cita no encontrada" };
    }
    return rows[0];
  })
  .post("/", async ({ body, set }) => {
    const parsed = citaSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { code: "EX-004", message: "Datos inválidos", details: parsed.error.format() };
    }
    const c = parsed.data;
    try {
      const cita = await withTransaction(async (client) => {
        if (c.medicoId) {
          const conflict = await client.query(
            `SELECT 1 FROM consultorio.cita
              WHERE medico_id = $1
                AND fecha = $2
                AND hora_inicio = $3
                AND estado IN ('PROGRAMADA','CONFIRMADA','EN_CURSO')
              FOR UPDATE`,
            [c.medicoId, c.fecha, c.horaInicio],
          );
          if (conflict.rowCount && conflict.rowCount > 0) {
            const err = new Error("EX-009 Slot ocupado");
            (err as Error & { code?: string }).code = "EX-009";
            throw err;
          }
        }
        const inserted = await client.query(
          `INSERT INTO consultorio.cita
             (paciente_id, medico_id, fecha, hora_inicio, hora_fin, tipo_servicio, motivo, estado)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'PROGRAMADA') RETURNING *`,
          [c.pacienteId, c.medicoId ?? null, c.fecha, c.horaInicio, c.horaFin, c.tipoServicio, c.motivo],
        );
        await client.query(
          `INSERT INTO consultorio.notificacion (cita_id, canal, estado, payload)
           VALUES ($1, 'EMAIL', 'PENDIENTE', $2)`,
          [
            inserted.rows[0].id,
            JSON.stringify({ motivo: "Recordatorio 24h antes", citaId: inserted.rows[0].id }),
          ],
        );
        return inserted.rows[0];
      });
      set.status = 201;
      return cita;
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === "EX-009") {
        set.status = 409;
        return { code: "EX-009", message: "Médico ya tiene cita en ese horario" };
      }
      throw e;
    }
  })
  .patch("/:id/reprogramar", async ({ params, body, set }) => {
    const parsed = reprogramarSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { code: "EX-004", message: "Datos inválidos" };
    }
    const r = parsed.data;
    try {
      const updated = await withTransaction(async (client) => {
        const cita = await client.query(
          `SELECT estado FROM consultorio.cita WHERE id = $1 FOR UPDATE`,
          [params.id],
        );
        if (cita.rowCount === 0) {
          throw Object.assign(new Error("Cita no encontrada"), { code: "EX-019", status: 404 });
        }
        if (!["PROGRAMADA", "CONFIRMADA", "EN_CURSO"].includes(cita.rows[0].estado)) {
          throw Object.assign(new Error("Cita no se puede reprogramar"), { code: "EX-010", status: 409 });
        }
        const upd = await client.query(
          `UPDATE consultorio.cita
              SET fecha = $1, hora_inicio = $2, hora_fin = $3, updated_at = NOW()
            WHERE id = $4 RETURNING *`,
          [r.fecha, r.horaInicio, r.horaFin, params.id],
        );
        await client.query(
          `UPDATE consultorio.notificacion
              SET payload = $2
            WHERE cita_id = $1 AND estado = 'PENDIENTE'`,
          [params.id, JSON.stringify({ motivo: `Reprogramada: ${r.motivo}`, citaId: Number(params.id) })],
        );
        return upd.rows[0];
      });
      set.status = 200;
      return { ok: true, cita: updated };
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string; status?: number };
      if (err.status) set.status = err.status;
      return { code: err.code || "EX-099", message: err.message || "Error" };
    }
  })
  .patch("/:id/cancelar", async ({ params, body, set }) => {
    const motivo = (body as { motivo?: string })?.motivo ?? "Sin motivo";
    const { rowCount } = await pool.query(
      `UPDATE consultorio.cita
          SET estado = 'CANCELADA', updated_at = NOW()
        WHERE id = $1 AND estado IN ('PROGRAMADA','CONFIRMADA','EN_CURSO')`,
      [params.id],
    );
    if (rowCount === 0) {
      set.status = 409;
      return { code: "EX-010", message: "Cita no cancelable" };
    }
    await pool.query(
      `UPDATE consultorio.notificacion
          SET payload = $2
        WHERE cita_id = $1 AND estado = 'PENDIENTE'`,
      [params.id, JSON.stringify({ motivo: `Cancelada: ${motivo}`, citaId: Number(params.id) })],
    );
    set.status = 200;
    return { ok: true, motivo };
  });