import { Elysia } from "elysia";
import { spawn } from "bun";
import { mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { pool } from "../../db/pool.ts";
import { getClientInfo, recordAudit } from "../../lib/audit.ts";
import type { AuthPayload } from "../auth/auth.routes.ts";

function getUser(headers: Record<string, string | undefined>): AuthPayload | null {
  const raw = headers["x-user"];
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthPayload; } catch { return null; }
}

const BACKUP_DIR = process.env.BACKUP_DIR ?? "/tmp/consultorio-backups";

async function dbConnArgs(): Promise<string[]> {
  if (process.env.DATABASE_URL) {
    return [process.env.DATABASE_URL];
  }
  return [
    "-h", process.env.PGHOST ?? "localhost",
    "-p", process.env.PGPORT ?? "5432",
    "-U", process.env.PGUSER ?? "consultorio",
    "-d", process.env.PGDATABASE ?? "consultorio",
  ];
}

function dumpFilename(): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `consultorio-backup-${stamp}.sql`;
}

export const mantenimientoRoutes = new Elysia({ prefix: "/api/mantenimiento" })
  .get("/backups", async ({ set, headers }) => {
    const user = getUser(headers);
    if (!user || user.rol !== "ADMIN") {
      set.status = 403;
      return { code: "EX-003", message: "Solo ADMIN puede acceder al mantenimiento" };
    }
    if (!existsSync(BACKUP_DIR)) {
      return { directorio: BACKUP_DIR, archivos: [] };
    }
    const { readdir } = await import("node:fs/promises");
    const archivos = await readdir(BACKUP_DIR);
    const info = await Promise.all(
      archivos.filter((f) => f.endsWith(".sql")).map(async (f) => {
        const st = await stat(`${BACKUP_DIR}/${f}`);
        return { nombre: f, size_bytes: st.size, created_at: st.mtime.toISOString() };
      }),
    );
    return { directorio: BACKUP_DIR, archivos: info.sort((a, b) => b.created_at.localeCompare(a.created_at)) };
  })
  .post("/backup", async ({ set, headers, request }) => {
    const user = getUser(headers);
    if (!user || user.rol !== "ADMIN") {
      set.status = 403;
      return { code: "EX-003", message: "Solo ADMIN puede crear respaldos" };
    }
    await mkdir(BACKUP_DIR, { recursive: true });
    const filename = dumpFilename();
    const filepath = `${BACKUP_DIR}/${filename}`;
    const args = await dbConnArgs();
    const proc = spawn({
      cmd: ["pg_dump", ...args, "-f", filepath, "--no-owner", "--clean", "--if-exists"],
      env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? "consultorio" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const stderr = await new Response(proc.stderr).text();
    await proc.exited;
    if (proc.exitCode !== 0) {
      set.status = 500;
      return { code: "EX-099", message: "pg_dump falló", stderr };
    }
    const st = await stat(filepath);
    const info = getClientInfo(request);
    await recordAudit(
      { usuarioId: Number(user.sub), username: user.username, ip: info.ip, userAgent: info.userAgent, ruta: "/api/mantenimiento/backup", metodo: "POST" },
      "BACKUP", undefined, undefined,
      undefined, { filename, size_bytes: st.size },
    );
    return { ok: true, filename, size_bytes: st.size, ruta: filepath };
  })
  .get("/backup/:filename", async ({ params, set, headers }) => {
    const user = getUser(headers);
    if (!user || user.rol !== "ADMIN") {
      set.status = 403;
      return { code: "EX-003", message: "Solo ADMIN puede descargar respaldos" };
    }
    const filepath = `${BACKUP_DIR}/${params.filename}`;
    if (!existsSync(filepath)) {
      set.status = 404;
      return { code: "EX-019", message: "Respaldo no encontrado" };
    }
    const file = Bun.file(filepath);
    return new Response(file, {
      headers: {
        "Content-Type": "application/sql",
        "Content-Disposition": `attachment; filename="${params.filename}"`,
      },
    });
  })
  .post("/restore", async ({ body, set, headers, request }) => {
    const user = getUser(headers);
    if (!user || user.rol !== "ADMIN") {
      set.status = 403;
      return { code: "EX-003", message: "Solo ADMIN puede restaurar" };
    }
    const { filename, contenido } = body as { filename?: string; contenido?: string };
    if (!filename && !contenido) {
      set.status = 400;
      return { code: "EX-013", message: "filename o contenido requerido" };
    }
    let sqlText: string;
    let source: string;
    if (filename) {
      const filepath = `${BACKUP_DIR}/${filename}`;
      if (!existsSync(filepath)) {
        set.status = 404;
        return { code: "EX-019", message: "Respaldo no encontrado" };
      }
      sqlText = await Bun.file(filepath).text();
      source = filename;
    } else {
      sqlText = contenido!;
      source = "upload";
    }
    const args = await dbConnArgs();
    const proc = spawn({
      cmd: ["psql", ...args],
      env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? "consultorio" },
      stdin: sqlText,
      stdout: "pipe",
      stderr: "pipe",
    });
    const stderr = await new Response(proc.stderr).text();
    await proc.exited;
    if (proc.exitCode !== 0) {
      set.status = 500;
      return { code: "EX-099", message: "psql falló", stderr };
    }
    const info = getClientInfo(request);
    await recordAudit(
      { usuarioId: Number(user.sub), username: user.username, ip: info.ip, userAgent: info.userAgent, ruta: "/api/mantenimiento/restore", metodo: "POST" },
      "RESTORE", undefined, undefined,
      undefined, { source, bytes: sqlText.length },
    );
    return { ok: true, source, bytes: sqlText.length };
  });