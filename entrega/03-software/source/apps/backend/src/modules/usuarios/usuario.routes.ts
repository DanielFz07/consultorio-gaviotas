import { Elysia } from "elysia";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { pool } from "../../db/pool.ts";
import type { AuthPayload } from "../auth/auth.routes.ts";

const usuarioSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/),
  password: z.string().min(6).max(100).optional().or(z.literal("")),
  nombre: z.string().min(1).max(120),
  email: z.string().email().optional().nullable().or(z.literal("")),
  rol: z.enum(["ADMIN", "MEDICO", "RECEPCION"]),
  activo: z.boolean().optional().default(true),
});

const usuarioUpdateSchema = usuarioSchema.partial().omit({ username: true });

const getUserFromHeaders = (headers: Record<string, string | undefined>): AuthPayload | null => {
  const raw = headers["x-user"];
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthPayload; } catch { return null; }
};

export const usuarioRoutes = new Elysia({ prefix: "/api/usuarios" })
  .onBeforeHandle(({ headers, set }) => {
    const u = getUserFromHeaders(headers);
    if (!u || u.rol !== "ADMIN") {
      set.status = 403;
      throw new Error("EX-003 Rol sin permisos");
    }
  })
  .get("/", async () => {
    const { rows } = await pool.query(
      `SELECT id, username, nombre, email, rol, activo, created_at
         FROM consultorio.usuario ORDER BY nombre`
    );
    return rows;
  })
  .get("/:id", async ({ params, set }) => {
    const { rows } = await pool.query(
      `SELECT id, username, nombre, email, rol, activo, created_at
         FROM consultorio.usuario WHERE id = $1`,
      [params.id]
    );
    if (rows.length === 0) {
      set.status = 404;
      return { code: "EX-019", message: "Usuario no encontrado" };
    }
    return rows[0];
  })
  .post("/", async ({ body, set }) => {
    const parsed = usuarioSchema.parse(body);
    const existing = await pool.query(
      "SELECT id FROM consultorio.usuario WHERE username = $1",
      [parsed.username]
    );
    if (existing.rowCount && existing.rowCount > 0) {
      set.status = 409;
      return { code: "EX-007", message: "Ya existe un usuario con ese username" };
    }
    if (!parsed.password || parsed.password.length === 0) {
      set.status = 400;
      return { code: "EX-004", message: "Password es requerido al crear" };
    }
    const hash = await bcrypt.hash(parsed.password, 12);
    const email = parsed.email && parsed.email.length > 0 ? parsed.email : null;
    const { rows } = await pool.query(
      `INSERT INTO consultorio.usuario (username, password_hash, nombre, email, rol, activo)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, nombre, email, rol, activo, created_at`,
      [parsed.username, hash, parsed.nombre, email, parsed.rol, parsed.activo ?? true]
    );
    set.status = 201;
    return rows[0];
  })
  .patch("/:id", async ({ params, body, set }) => {
    const parsed = usuarioUpdateSchema.parse(body);
    if (Object.keys(parsed).length === 0) {
      set.status = 400;
      return { code: "EX-004", message: "Sin cambios" };
    }
    const map: Record<string, string> = {
      nombre: "nombre",
      email: "email",
      rol: "rol",
      activo: "activo",
    };
    const sets: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    let i = 1;
    if ("password" in body && body.password && (body.password as string).length > 0) {
      const hash = await bcrypt.hash(body.password as string, 12);
      sets.push(`password_hash = $${i++}`);
      values.push(hash);
    }
    for (const k of Object.keys(parsed)) {
      if (k === "password") continue;
      const v = (parsed as Record<string, unknown>)[k];
      sets.push(`${map[k]} = $${i++}`);
      values.push(v === "" ? null : (v as string | number | boolean | null));
    }
    values.push(params.id);
    const { rows } = await pool.query(
      `UPDATE consultorio.usuario SET ${sets.join(", ")}, updated_at = NOW()
       WHERE id = $${i}
       RETURNING id, username, nombre, email, rol, activo, created_at`,
      values
    );
    if (rows.length === 0) {
      set.status = 404;
      return { code: "EX-019", message: "Usuario no encontrado" };
    }
    set.status = 200;
    return rows[0];
  })
  .delete("/:id", async ({ params, set }) => {
    const { rowCount } = await pool.query(
      `UPDATE consultorio.usuario SET activo = FALSE, updated_at = NOW()
       WHERE id = $1 AND username <> 'admin'`,
      [params.id]
    );
    if (rowCount === 0) {
      set.status = 409;
      return { code: "EX-003", message: "No se puede eliminar (usuario admin o no existe)" };
    }
    return { ok: true };
  });