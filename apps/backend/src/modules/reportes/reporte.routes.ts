import { Elysia } from "elysia";
import { pool } from "../../db/pool.ts";
import { getClientInfo, recordAudit } from "../../lib/audit.ts";
import type { AuthPayload } from "../auth/auth.routes.ts";

function getUser(headers: Record<string, string | undefined>): AuthPayload | null {
  const raw = headers["x-user"];
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthPayload; } catch { return null; }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

function fmtFecha(d: Date | string): string {
  return new Date(d).toLocaleDateString("es-VE", { year: "numeric", month: "long", day: "numeric" });
}

function generatePdf(html: string): Promise<Uint8Array> {
  return new Promise(async (resolve, reject) => {
    const proc = Bun.spawn({
      cmd: ["wkhtmltopdf", "-q", "--enable-local-file-access", "--encoding", "UTF-8", "-", "-"],
      stdin: html,
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).arrayBuffer();
    await proc.exited;
    if (proc.exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      reject(new Error(`wkhtmltopdf falló: ${stderr}`));
    } else {
      resolve(new Uint8Array(stdout));
    }
  });
}

function pageShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>${title}</title>
<style>
@page { size: Letter; margin: 2cm; }
body { font-family: 'DejaVu Sans', sans-serif; color: #111; font-size: 11pt; }
h1 { color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 0.3em; }
h2 { color: #0f766e; margin-top: 1.5em; }
table { width: 100%; border-collapse: collapse; margin-top: 0.5em; }
th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 10pt; }
th { background: #f0fdfa; color: #0f766e; font-weight: 600; }
.meta { color: #666; font-size: 9pt; margin-bottom: 1em; }
</style></head><body>${body}</body></html>`;
}

export const reporteRoutes = new Elysia({ prefix: "/api/reportes" })
  .get("/consultas/pdf", async ({ query, set, headers, request }) => {
    const user = getUser(headers);
    if (!user) { set.status = 401; return { code: "EX-002", message: "No autorizado" }; }
    const desde = (query.desde ?? "").toString();
    const hasta = (query.hasta ?? "").toString();
    const medicoId = query.medicoId ? Number(query.medicoId) : null;
    const pacienteId = query.pacienteId ? Number(query.pacienteId) : null;

    const filters: string[] = [];
    const params: unknown[] = [];
    if (desde) { params.push(desde); filters.push(`c.fecha_hora >= $${params.length}`); }
    if (hasta) { params.push(hasta + " 23:59:59"); filters.push(`c.fecha_hora <= $${params.length}`); }
    if (medicoId) { params.push(medicoId); filters.push(`c.medico_id = $${params.length}`); }
    if (pacienteId) { params.push(pacienteId); filters.push(`c.paciente_id = $${params.length}`); }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT c.id, c.fecha_hora, c.sintomas, c.diagnostico, c.tratamiento,
              p.cedula, p.nombre AS pnombre, p.apellido AS papellido,
              u.nombre AS mnombre
         FROM consultorio.consulta c
         JOIN consultorio.paciente p ON p.id = c.paciente_id
         LEFT JOIN consultorio.usuario u ON u.id = c.medico_id
         ${where}
         ORDER BY c.fecha_hora DESC`,
      params,
    );

    const rowsHtml = rows.map((r: any) => `
      <tr>
        <td>${new Date(r.fecha_hora).toLocaleDateString("es-VE")}</td>
        <td>${escapeHtml(r.papellido)} ${escapeHtml(r.pnombre)}<br><small>${escapeHtml(r.cedula)}</small></td>
        <td>${escapeHtml(r.mnombre ?? "—")}</td>
        <td>${escapeHtml(r.sintomas)}</td>
        <td>${escapeHtml(r.diagnostico)}</td>
      </tr>`).join("");

    const filtros = [
      desde && `Desde: ${fmtFecha(desde)}`,
      hasta && `Hasta: ${fmtFecha(hasta)}`,
      medicoId && `Médico ID: ${medicoId}`,
      pacienteId && `Paciente ID: ${pacienteId}`,
    ].filter(Boolean).join(" · ") || "Sin filtros";

    const body = `
      <h1>Reporte de Consultas Médicas</h1>
      <p class="meta">Consultorio Las Gaviotas · ${new Date().toLocaleString("es-VE")} · ${filtros}</p>
      <p><strong>Total de consultas:</strong> ${rows.length}</p>
      <table>
        <thead><tr><th>Fecha</th><th>Paciente</th><th>Médico</th><th>Síntomas</th><th>Diagnóstico</th></tr></thead>
        <tbody>${rowsHtml || '<tr><td colspan="5" style="text-align:center;color:#888">Sin resultados</td></tr>'}</tbody>
      </table>`;

    const info = getClientInfo(request);
    await recordAudit(
      { usuarioId: Number(user.sub), username: user.username, ip: info.ip, userAgent: info.userAgent, ruta: "/api/reportes/consultas/pdf", metodo: "GET" },
      "EXPORT", "consulta", undefined,
      undefined, { filtros: { desde, hasta, medicoId, pacienteId }, count: rows.length },
    );

    const html = pageShell("Reporte de Consultas", body);
    try {
      const pdf = await generatePdf(html);
      return new Response(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="reporte-consultas-${new Date().toISOString().slice(0, 10)}.pdf"`,
        },
      });
    } catch (err) {
      set.status = 500;
      return { code: "EX-099", message: String(err) };
    }
  })
  .get("/pacientes/pdf", async ({ query, set, headers, request }) => {
    const user = getUser(headers);
    if (!user) { set.status = 401; return { code: "EX-002", message: "No autorizado" }; }
    const q = (query.q ?? "").toString().trim();
    const cedula = (query.cedula ?? "").toString().trim();
    const filters: string[] = ["p.activo = TRUE"];
    const params: unknown[] = [];
    if (q) { params.push(`%${q}%`); filters.push(`(p.nombre ILIKE $${params.length} OR p.apellido ILIKE $${params.length})`); }
    if (cedula) { params.push(`%${cedula}%`); filters.push(`p.cedula ILIKE $${params.length}`); }
    const where = `WHERE ${filters.join(" AND ")}`;

    const { rows } = await pool.query(
      `SELECT p.cedula, p.nombre, p.apellido, p.fecha_nacimiento, p.telefono, p.email, p.sexo,
              (SELECT COUNT(*) FROM consultorio.consulta c WHERE c.paciente_id = p.id)::int AS total_consultas
         FROM consultorio.paciente p
         ${where}
         ORDER BY p.apellido, p.nombre`,
      params,
    );

    const rowsHtml = rows.map((r: any) => `
      <tr>
        <td>${escapeHtml(r.cedula)}</td>
        <td>${escapeHtml(r.apellido)} ${escapeHtml(r.nombre)}</td>
        <td>${r.fecha_nacimiento ? new Date(r.fecha_nacimiento).toLocaleDateString("es-VE") : "—"}</td>
        <td>${escapeHtml(r.telefono ?? "—")}</td>
        <td>${escapeHtml(r.email ?? "—")}</td>
        <td>${escapeHtml(r.sexo)}</td>
        <td>${r.total_consultas}</td>
      </tr>`).join("");

    const body = `
      <h1>Listado de Pacientes</h1>
      <p class="meta">Consultorio Las Gaviotas · ${new Date().toLocaleString("es-VE")} · ${rows.length} pacientes</p>
      <table>
        <thead><tr><th>Cédula</th><th>Nombre</th><th>F. Nac.</th><th>Teléfono</th><th>Email</th><th>Sexo</th><th>Consultas</th></tr></thead>
        <tbody>${rowsHtml || '<tr><td colspan="7" style="text-align:center;color:#888">Sin resultados</td></tr>'}</tbody>
      </table>`;

    const info = getClientInfo(request);
    await recordAudit(
      { usuarioId: Number(user.sub), username: user.username, ip: info.ip, userAgent: info.userAgent, ruta: "/api/reportes/pacientes/pdf", metodo: "GET" },
      "EXPORT", "paciente", undefined,
      undefined, { filtros: { q, cedula }, count: rows.length },
    );

    const html = pageShell("Listado de Pacientes", body);
    try {
      const pdf = await generatePdf(html);
      return new Response(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="reporte-pacientes-${new Date().toISOString().slice(0, 10)}.pdf"`,
        },
      });
    } catch (err) {
      set.status = 500;
      return { code: "EX-099", message: String(err) };
    }
  })
  .get("/citas/pdf", async ({ query, set, headers, request }) => {
    const user = getUser(headers);
    if (!user) { set.status = 401; return { code: "EX-002", message: "No autorizado" }; }
    const desde = (query.desde ?? "").toString();
    const hasta = (query.hasta ?? "").toString();
    const filters: string[] = [];
    const params: unknown[] = [];
    if (desde) { params.push(desde); filters.push(`ci.fecha >= $${params.length}`); }
    if (hasta) { params.push(hasta); filters.push(`ci.fecha <= $${params.length}`); }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT ci.fecha, ci.hora_inicio, ci.estado, ci.tipo_servicio, ci.motivo,
              p.cedula, p.nombre AS pnombre, p.apellido AS papellido,
              u.nombre AS mnombre
         FROM consultorio.cita ci
         JOIN consultorio.paciente p ON p.id = ci.paciente_id
         LEFT JOIN consultorio.usuario u ON u.id = ci.medico_id
         ${where}
         ORDER BY ci.fecha DESC, ci.hora_inicio DESC`,
      params,
    );

    const rowsHtml = rows.map((r: any) => `
      <tr>
        <td>${new Date(r.fecha).toLocaleDateString("es-VE")}</td>
        <td>${r.hora_inicio}</td>
        <td>${escapeHtml(r.papellido)} ${escapeHtml(r.pnombre)}<br><small>${escapeHtml(r.cedula)}</small></td>
        <td>${escapeHtml(r.mnombre ?? "—")}</td>
        <td>${escapeHtml(r.tipo_servicio)}</td>
        <td>${escapeHtml(r.estado)}</td>
      </tr>`).join("");

    const body = `
      <h1>Reporte de Citas</h1>
      <p class="meta">Consultorio Las Gaviotas · ${new Date().toLocaleString("es-VE")} · ${rows.length} citas</p>
      <table>
        <thead><tr><th>Fecha</th><th>Hora</th><th>Paciente</th><th>Médico</th><th>Tipo</th><th>Estado</th></tr></thead>
        <tbody>${rowsHtml || '<tr><td colspan="6" style="text-align:center;color:#888">Sin resultados</td></tr>'}</tbody>
      </table>`;

    const info = getClientInfo(request);
    await recordAudit(
      { usuarioId: Number(user.sub), username: user.username, ip: info.ip, userAgent: info.userAgent, ruta: "/api/reportes/citas/pdf", metodo: "GET" },
      "EXPORT", "cita", undefined,
      undefined, { filtros: { desde, hasta }, count: rows.length },
    );

    const html = pageShell("Reporte de Citas", body);
    try {
      const pdf = await generatePdf(html);
      return new Response(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="reporte-citas-${new Date().toISOString().slice(0, 10)}.pdf"`,
        },
      });
    } catch (err) {
      set.status = 500;
      return { code: "EX-099", message: String(err) };
    }
  });