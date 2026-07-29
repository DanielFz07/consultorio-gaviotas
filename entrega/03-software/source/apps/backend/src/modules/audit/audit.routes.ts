import { Elysia } from "elysia";
import { pool } from "../../db/pool.ts";
import type { AuthPayload } from "../auth/auth.routes.ts";

function getUser(headers: Record<string, string | undefined>): AuthPayload | null {
  const raw = headers["x-user"];
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthPayload; } catch { return null; }
}

export const auditRoutes = new Elysia({ prefix: "/api/audit" })
  .get("/logs", async ({ query, set, headers }) => {
    const user = getUser(headers);
    if (!user || user.rol !== "ADMIN") {
      set.status = 403;
      return { code: "EX-003", message: "Solo ADMIN puede ver la auditoría" };
    }
    const limit = Math.min(Number(query.limit ?? 100), 500);
    const offset = Number(query.offset ?? 0);
    const accion = (query.accion ?? "").toString().trim();
    const tabla = (query.tabla ?? "").toString().trim();
    const usuarioId = query.usuarioId ? Number(query.usuarioId) : null;

    const filters: string[] = [];
    const params: unknown[] = [];
    if (accion) { params.push(accion); filters.push(`accion = $${params.length}`); }
    if (tabla) { params.push(tabla); filters.push(`tabla = $${params.length}`); }
    if (usuarioId) { params.push(usuarioId); filters.push(`usuario_id = $${params.length}`); }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    params.push(limit); params.push(offset);
    const { rows } = await pool.query(
      `SELECT a.*, u.username AS usuario_username, u.nombre AS usuario_nombre
         FROM consultorio.audit_log a
         LEFT JOIN consultorio.usuario u ON u.id = a.usuario_id
         ${where}
         ORDER BY a.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return rows;
  })
  .get("/logins", async ({ query, set, headers }) => {
    const user = getUser(headers);
    if (!user || user.rol !== "ADMIN") {
      set.status = 403;
      return { code: "EX-003", message: "Solo ADMIN puede ver la auditoría" };
    }
    const limit = Math.min(Number(query.limit ?? 100), 500);
    const { rows } = await pool.query(
      `SELECT l.*, u.username AS usuario_username
         FROM consultorio.user_login_log l
         LEFT JOIN consultorio.usuario u ON u.id = l.usuario_id
         ORDER BY l.created_at DESC
         LIMIT $1`,
      [limit],
    );
    return rows;
  })
  .get("/stats", async ({ set, headers }) => {
    const user = getUser(headers);
    if (!user || user.rol !== "ADMIN") {
      set.status = 403;
      return { code: "EX-003", message: "Solo ADMIN puede ver la auditoría" };
    }
    const { rows: totales } = await pool.query(
      `SELECT
         COUNT(*)::int AS total_eventos,
         COUNT(*) FILTER (WHERE accion = 'LOGIN_OK')::int AS logins_ok,
         COUNT(*) FILTER (WHERE accion = 'LOGIN_FAIL')::int AS logins_fail,
         COUNT(*) FILTER (WHERE accion IN ('CREATE','UPDATE','DELETE'))::int AS mutaciones
       FROM consultorio.audit_log`
    );
    const { rows: porAccion } = await pool.query(
      `SELECT accion, COUNT(*)::int AS total
         FROM consultorio.audit_log
         GROUP BY accion
         ORDER BY total DESC`
    );
const { rows: porUsuario } = await pool.query(
      `SELECT COALESCE(username_snapshot, 'sistema') AS usuario, COUNT(*)::int AS total
          FROM consultorio.audit_log
          GROUP BY username_snapshot
          ORDER BY total DESC
          LIMIT 10`
    );
    return { totales: totales[0], porAccion, porUsuario };
  });