import { pool } from "../db/pool.ts";
import type { AccionAudit } from "./types.ts";

export interface AuditContext {
  usuarioId: number | null;
  username: string | null;
  ip: string;
  userAgent: string;
  ruta: string;
  metodo: string;
}

export async function recordAudit(
  ctx: AuditContext,
  accion: AccionAudit,
  tabla?: string,
  registroId?: number,
  datosAnteriores?: unknown,
  datosNuevos?: unknown,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO consultorio.audit_log
        (usuario_id, username_snapshot, accion, tabla, registro_id, datos_anteriores, datos_nuevos, ruta, metodo, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        ctx.usuarioId,
        ctx.username,
        accion,
        tabla ?? null,
        registroId ?? null,
        datosAnteriores ? JSON.stringify(datosAnteriores) : null,
        datosNuevos ? JSON.stringify(datosNuevos) : null,
        ctx.ruta,
        ctx.metodo,
        ctx.ip,
        ctx.userAgent,
      ],
    );
  } catch (err) {
    console.error("[audit] no se pudo registrar", err);
  }
}

export async function recordLoginAttempt(
  username: string,
  usuarioId: number | null,
  exito: boolean,
  motivoFallo: string | null,
  ip: string,
  userAgent: string,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO consultorio.user_login_log
        (usuario_id, username_intento, exito, motivo_fallo, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [usuarioId, username, exito, motivoFallo, ip, userAgent],
    );
  } catch (err) {
    console.error("[login-log] no se pudo registrar", err);
  }
}

export function getClientInfo(request: Request): { ip: string; userAgent: string } {
  const headers = request.headers;
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    headers.get("x-real-ip") ??
    "unknown";
  const userAgent = headers.get("user-agent") ?? "unknown";
  return { ip, userAgent };
}