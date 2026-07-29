import { Elysia } from "elysia";
import { z } from "zod";
import { pool } from "../../db/pool.ts";
import { getClientInfo, recordAudit } from "../../lib/audit.ts";
import type { AuthPayload } from "../auth/auth.routes.ts";

const pacienteSchema = z.object({
  cedula: z.string().min(5).max(20),
  nombre: z.string().min(1).max(120),
  apellido: z.string().min(1).max(120),
  fechaNacimiento: z.string().date().optional().nullable(),
  telefono: z.string().max(30).optional().nullable(),
  email: z.string().email().max(150).optional().nullable(),
  direccion: z.string().max(500).optional().nullable(),
  sexo: z.enum(["MASCULINO", "FEMENINO", "OTRO"]).default("OTRO"),
  antecedentes: z.string().optional().nullable(),
  alergias: z.string().optional().nullable(),
});

const pacienteUpdateSchema = pacienteSchema.partial();

function getUser(headers: Record<string, string | undefined>): AuthPayload | null {
  const raw = headers["x-user"];
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthPayload; } catch { return null; }
}

export const pacienteRoutes = new Elysia({ prefix: "/api/pacientes" })
  .get("/", async ({ query, request, headers }) => {
    const q = (query.q ?? "").toString().trim();
    const cedula = (query.cedula ?? "").toString().trim();
    const fechaNacimiento = (query.fechaNacimiento ?? "").toString().trim();

    const filters: string[] = ["activo = TRUE"];
    const params: unknown[] = [];
    if (q) {
      params.push(`%${q}%`);
      filters.push(`(nombre ILIKE $${params.length} OR apellido ILIKE $${params.length})`);
    }
    if (cedula) {
      params.push(`%${cedula}%`);
      filters.push(`cedula ILIKE $${params.length}`);
    }
    if (fechaNacimiento) {
      params.push(fechaNacimiento);
      filters.push(`fecha_nacimiento = $${params.length}`);
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    params.push(200);
    const { rows } = await pool.query(
      `SELECT id, cedula, nombre, apellido, fecha_nacimiento, telefono, email, sexo, created_at
         FROM consultorio.paciente ${where}
         ORDER BY apellido, nombre
         LIMIT $${params.length}`,
      params,
    );
    const user = getUser(headers);
    if (user) {
      const info = getClientInfo(request);
      await recordAudit(
        { usuarioId: Number(user.sub), username: user.username, ip: info.ip, userAgent: info.userAgent, ruta: "/api/pacientes", metodo: "GET" },
        "READ",
        "paciente",
        undefined,
        undefined,
        { filtros: { q, cedula, fechaNacimiento }, count: rows.length },
      );
    }
    return rows;
  })
  .get("/:id", async ({ params, set, headers, request }) => {
    const { rows } = await pool.query(
      `SELECT * FROM consultorio.paciente WHERE id = $1`,
      [params.id],
    );
    if (rows.length === 0) {
      set.status = 404;
      return { code: "EX-019", message: "Paciente no encontrado" };
    }
    const paciente = rows[0];
    const hc = await pool.query(
      `SELECT id, fecha_apertura, cerrado FROM consultorio.historial_clinico WHERE paciente_id = $1`,
      [params.id],
    );
    const user = getUser(headers);
    if (user) {
      const info = getClientInfo(request);
      await recordAudit(
        { usuarioId: Number(user.sub), username: user.username, ip: info.ip, userAgent: info.userAgent, ruta: `/api/pacientes/${params.id}`, metodo: "GET" },
        "READ", "paciente", Number(params.id),
      );
    }
    return { ...paciente, historial: hc.rows[0] ?? null };
  })
  .post("/", async ({ body, set, headers, request }) => {
    const parsed = pacienteSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { code: "EX-004", message: "Datos inválidos", details: parsed.error.format() };
    }
    const p = parsed.data;
    const user = getUser(headers);
    if (!user) {
      set.status = 401;
      return { code: "EX-002", message: "No autorizado" };
    }
    try {
      const { rows } = await pool.query(
        `INSERT INTO consultorio.paciente
           (cedula, nombre, apellido, fecha_nacimiento, telefono, email, direccion, sexo, antecedentes, alergias)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          p.cedula, p.nombre, p.apellido,
          p.fechaNacimiento ?? null,
          p.telefono ?? null, p.email ?? null, p.direccion ?? null,
          p.sexo, p.antecedentes ?? null, p.alergias ?? null,
        ],
      );
      const info = getClientInfo(request);
      await recordAudit(
        { usuarioId: Number(user.sub), username: user.username, ip: info.ip, userAgent: info.userAgent, ruta: "/api/pacientes", metodo: "POST" },
        "CREATE", "paciente", rows[0].id,
        undefined, rows[0],
      );
      return rows[0];
    } catch (err: any) {
      if (err.code === "23505") {
        set.status = 409;
        return { code: "EX-022", message: "Cédula ya registrada" };
      }
      throw err;
    }
  })
  .patch("/:id", async ({ params, body, set, headers, request }) => {
    const parsed = pacienteUpdateSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { code: "EX-004", message: "Datos inválidos", details: parsed.error.format() };
    }
    const data = parsed.data;
    const fields = Object.keys(data).filter((k) => (data as Record<string, unknown>)[k] !== undefined);
    if (fields.length === 0) {
      set.status = 400;
      return { code: "EX-013", message: "Sin cambios" };
    }
    const setClause = fields.map((k, i) => `${camelToSnake(k)} = $${i + 2}`).join(", ");
    const values = fields.map((k) => (data as Record<string, unknown>)[k] ?? null);
    const { rows: prev } = await pool.query(
      `SELECT * FROM consultorio.paciente WHERE id = $1`,
      [params.id],
    );
    if (prev.length === 0) {
      set.status = 404;
      return { code: "EX-019", message: "Paciente no encontrado" };
    }
    const { rows } = await pool.query(
      `UPDATE consultorio.paciente SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [params.id, ...values],
    );
    const user = getUser(headers);
    if (user) {
      const info = getClientInfo(request);
      await recordAudit(
        { usuarioId: Number(user.sub), username: user.username, ip: info.ip, userAgent: info.userAgent, ruta: `/api/pacientes/${params.id}`, metodo: "PATCH" },
        "UPDATE", "paciente", Number(params.id), prev[0], rows[0],
      );
    }
    return rows[0];
  })
  .delete("/:id", async ({ params, set, headers, request }) => {
    const user = getUser(headers);
    if (!user || user.rol !== "ADMIN") {
      set.status = 403;
      return { code: "EX-003", message: "Solo ADMIN puede eliminar pacientes" };
    }
    const { rows: prev } = await pool.query(
      `SELECT * FROM consultorio.paciente WHERE id = $1`,
      [params.id],
    );
    if (prev.length === 0) {
      set.status = 404;
      return { code: "EX-019", message: "Paciente no encontrado" };
    }
    await pool.query(
      `UPDATE consultorio.paciente SET activo = FALSE, updated_at = NOW() WHERE id = $1`,
      [params.id],
    );
    const info = getClientInfo(request);
    await recordAudit(
      { usuarioId: Number(user.sub), username: user.username, ip: info.ip, userAgent: info.userAgent, ruta: `/api/pacientes/${params.id}`, metodo: "DELETE" },
      "DELETE", "paciente", Number(params.id), prev[0], { activo: false },
    );
    return { ok: true };
  });

function camelToSnake(s: string): string {
  return s.replace(/([A-Z])/g, "_$1").toLowerCase();
}