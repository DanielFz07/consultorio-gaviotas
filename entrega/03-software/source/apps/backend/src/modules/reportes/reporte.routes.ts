import { Elysia } from "elysia";
import PDFDocument from "pdfkit";
import { pool } from "../../db/pool.ts";
import { getClientInfo, recordAudit } from "../../lib/audit.ts";
import type { AuthPayload } from "../auth/auth.routes.ts";

function getUser(headers: Record<string, string | undefined>): AuthPayload | null {
  const raw = headers["x-user"];
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthPayload; } catch { return null; }
}

function fmtFecha(d: Date | string): string {
  return new Date(d).toLocaleDateString("es-VE", { year: "numeric", month: "long", day: "numeric" });
}

interface PdfColumn {
  label: string;
  width: number; // points, total page width minus margins
}

interface PdfRow {
  [key: string]: string | number | null | undefined;
}

interface PdfOptions {
  title: string;
  meta: string;
  columns: PdfColumn[];
  rows: PdfRow[];
  filename: string;
}

/**
 * Generate a PDF report using pdfkit (pure JS, no system deps).
 * Returns a Uint8Array.
 */
function generatePdf(opts: PdfOptions): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.on("error", reject);

    const COLORS = {
      teal: "#0f766e",
      ink: "#1a1a1a",
      muted: "#666666",
      rule: "#cccccc",
      zebra: "#f7f7f7",
    };

    // Header
    doc.fillColor(COLORS.teal).fontSize(20).font("Helvetica-Bold")
      .text(opts.title, { underline: false });
    doc.moveDown(0.3);
    doc.fillColor(COLORS.muted).fontSize(9).font("Helvetica")
      .text(`Consultorio Las Gaviotas · ${new Date().toLocaleString("es-VE")} · ${opts.meta}`);
    doc.moveDown(0.5);
    doc.fillColor(COLORS.ink).fontSize(11).font("Helvetica-Bold")
      .text(`Total de registros: ${opts.rows.length}`);
    doc.moveDown(0.5);

    // Table
    if (opts.rows.length === 0) {
      doc.fillColor(COLORS.muted).font("Helvetica-Oblique").fontSize(10)
        .text("Sin resultados");
    } else {
      const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const totalW = opts.columns.reduce((acc, c) => acc + c.width, 0);
      const scale = pageW / totalW;
      const widths = opts.columns.map((c) => c.width * scale);
      const rowH = 18;
      let y = doc.y;

      const drawHeader = () => {
        doc.fillColor(COLORS.teal).rect(doc.page.margins.left, y - 2, pageW, rowH).fill();
        let x = doc.page.margins.left;
        opts.columns.forEach((c, i) => {
          doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9);
          doc.text(c.label, x + 4, y + 4, { width: widths[i] - 8, ellipsis: true, lineBreak: false });
          x += widths[i];
        });
        y += rowH;
      };
      drawHeader();

      doc.font("Helvetica").fontSize(9).fillColor(COLORS.ink);
      opts.rows.forEach((row, rowIdx) => {
        if (y + rowH > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          y = doc.page.margins.top;
          drawHeader();
          doc.font("Helvetica").fontSize(9).fillColor(COLORS.ink);
        }
        if (rowIdx % 2 === 0) {
          doc.fillColor(COLORS.zebra).rect(doc.page.margins.left, y - 2, pageW, rowH).fill();
        }
        doc.fillColor(COLORS.ink);
        let x = doc.page.margins.left;
        opts.columns.forEach((c, i) => {
          const v = row[c.label];
          const text = v === null || v === undefined ? "—" : String(v);
          doc.text(text, x + 4, y + 4, { width: widths[i] - 8, ellipsis: true, lineBreak: false });
          x += widths[i];
        });
        y += rowH;
      });

      // Bottom rule
      doc.strokeColor(COLORS.rule).lineWidth(0.5)
        .moveTo(doc.page.margins.left, y)
        .lineTo(doc.page.margins.left + pageW, y).stroke();
    }

    doc.end();
  });
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

    const filtrosTxt = [
      desde && `Desde: ${fmtFecha(desde)}`,
      hasta && `Hasta: ${fmtFecha(hasta)}`,
      medicoId && `Médico ID: ${medicoId}`,
      pacienteId && `Paciente ID: ${pacienteId}`,
    ].filter(Boolean).join(" · ") || "Sin filtros";

    const info = getClientInfo(request);
    await recordAudit(
      { usuarioId: Number(user.sub), username: user.username, ip: info.ip, userAgent: info.userAgent, ruta: "/api/reportes/consultas/pdf", metodo: "GET" },
      "EXPORT", "consulta", undefined,
      undefined, { filtros: { desde, hasta, medicoId, pacienteId }, count: rows.length },
    );

    try {
      const pdf = await generatePdf({
        title: "Reporte de Consultas Médicas",
        meta: filtrosTxt,
        filename: `reporte-consultas-${new Date().toISOString().slice(0, 10)}.pdf`,
        columns: [
          { label: "Fecha",       width: 60 },
          { label: "Paciente",    width: 130 },
          { label: "Cédula",      width: 60 },
          { label: "Médico",      width: 90 },
          { label: "Síntomas",    width: 100 },
          { label: "Diagnóstico", width: 100 },
        ],
        rows: (rows as Array<Record<string, unknown>>).map((r) => ({
          "Fecha":       new Date(r.fecha_hora as string).toLocaleDateString("es-VE"),
          "Paciente":    `${r.papellido ?? ""} ${r.pnombre ?? ""}`.trim(),
          "Cédula":      String(r.cedula ?? ""),
          "Médico":      (r.mnombre as string) ?? "—",
          "Síntomas":    (r.sintomas as string) ?? "",
          "Diagnóstico": (r.diagnostico as string) ?? "",
        })),
      });
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

    const filtrosTxt = [
      q && `Búsqueda: ${q}`,
      cedula && `Cédula: ${cedula}`,
    ].filter(Boolean).join(" · ") || "Sin filtros";

    const info = getClientInfo(request);
    await recordAudit(
      { usuarioId: Number(user.sub), username: user.username, ip: info.ip, userAgent: info.userAgent, ruta: "/api/reportes/pacientes/pdf", metodo: "GET" },
      "EXPORT", "paciente", undefined,
      undefined, { filtros: { q, cedula }, count: rows.length },
    );

    try {
      const pdf = await generatePdf({
        title: "Listado de Pacientes",
        meta: `${rows.length} pacientes · ${filtrosTxt}`,
        filename: `reporte-pacientes-${new Date().toISOString().slice(0, 10)}.pdf`,
        columns: [
          { label: "Cédula",     width: 60 },
          { label: "Nombre",     width: 130 },
          { label: "F. Nac.",    width: 60 },
          { label: "Sexo",       width: 35 },
          { label: "Teléfono",   width: 75 },
          { label: "Email",      width: 100 },
          { label: "Consultas",  width: 50 },
        ],
        rows: (rows as Array<Record<string, unknown>>).map((r) => ({
          "Cédula":    String(r.cedula ?? ""),
          "Nombre":    `${r.apellido ?? ""} ${r.nombre ?? ""}`.trim(),
          "F. Nac.":   r.fecha_nacimiento ? new Date(r.fecha_nacimiento as string).toLocaleDateString("es-VE") : "—",
          "Sexo":      String(r.sexo ?? "—"),
          "Teléfono":  (r.telefono as string) ?? "—",
          "Email":     (r.email as string) ?? "—",
          "Consultas": String(r.total_consultas ?? 0),
        })),
      });
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

    const filtrosTxt = [
      desde && `Desde: ${fmtFecha(desde)}`,
      hasta && `Hasta: ${fmtFecha(hasta)}`,
    ].filter(Boolean).join(" · ") || "Sin filtros";

    const info = getClientInfo(request);
    await recordAudit(
      { usuarioId: Number(user.sub), username: user.username, ip: info.ip, userAgent: info.userAgent, ruta: "/api/reportes/citas/pdf", metodo: "GET" },
      "EXPORT", "cita", undefined,
      undefined, { filtros: { desde, hasta }, count: rows.length },
    );

    try {
      const pdf = await generatePdf({
        title: "Reporte de Citas",
        meta: `${rows.length} citas · ${filtrosTxt}`,
        filename: `reporte-citas-${new Date().toISOString().slice(0, 10)}.pdf`,
        columns: [
          { label: "Fecha",     width: 60 },
          { label: "Hora",      width: 40 },
          { label: "Paciente",  width: 130 },
          { label: "Cédula",    width: 60 },
          { label: "Médico",    width: 90 },
          { label: "Tipo",      width: 50 },
          { label: "Estado",    width: 50 },
        ],
        rows: (rows as Array<Record<string, unknown>>).map((r) => ({
          "Fecha":    new Date(r.fecha as string).toLocaleDateString("es-VE"),
          "Hora":     String(r.hora_inicio ?? "").slice(0, 5),
          "Paciente": `${r.papellido ?? ""} ${r.pnombre ?? ""}`.trim(),
          "Cédula":   String(r.cedula ?? ""),
          "Médico":   (r.mnombre as string) ?? "—",
          "Tipo":     (r.tipo_servicio as string) ?? "",
          "Estado":   (r.estado as string) ?? "",
        })),
      });
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