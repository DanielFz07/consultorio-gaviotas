import { Pool } from "pg";
import nodemailer from "nodemailer";

// Parse DATABASE_URL if set (Railway provides this; the PG* vars may not be set).
function parseDbUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: u.username,
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
  };
}

const dbConfig = process.env.DATABASE_URL
  ? parseDbUrl(process.env.DATABASE_URL)
  : {
      host: process.env.PGHOST ?? "localhost",
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.PGUSER ?? "consultorio",
      password: process.env.PGPASSWORD ?? "consultorio",
      database: process.env.PGDATABASE ?? "consultorio",
    };

const pool = new Pool({ ...dbConfig, max: 5 });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: false,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
    : undefined,
});

const FROM = process.env.SMTP_FROM ?? "Consultorio Las Gaviotas <no-reply@consultorio-gaviotas.local>";
const INTERVALO_MS = Number(process.env.WORKER_INTERVAL_MS ?? 60_000);

interface NotifRow {
  id: string;
  cita_id: string;
  payload: string;
  paciente_email: string | null;
  paciente_nombre: string | null;
  paciente_apellido: string | null;
  paciente_cedula: string | null;
  fecha: Date;
  hora_inicio: string;
  motivo: string | null;
  tipo_servicio: string;
}

async function recordatorio24h() {
  const { rows } = await pool.query<NotifRow>(
    `SELECT n.id, n.cita_id, n.payload,
            p.email AS paciente_email, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido,
            p.cedula AS paciente_cedula, c.fecha, c.hora_inicio, c.motivo, c.tipo_servicio
       FROM consultorio.notificacion n
       JOIN consultorio.cita c ON c.id = n.cita_id
       JOIN consultorio.paciente p ON p.id = c.paciente_id
      WHERE n.canal = 'EMAIL'
        AND n.estado = 'PENDIENTE'
        AND c.fecha = CURRENT_DATE + INTERVAL '1 day'
        AND c.estado IN ('PROGRAMADA','CONFIRMADA')`,
  );
  for (const r of rows) {
    if (!r.paciente_email) {
      await pool.query(`UPDATE consultorio.notificacion SET estado = 'DESCARTADA' WHERE id = $1`, [r.id]);
      continue;
    }
    try {
      const nombreCompleto = `${r.paciente_nombre ?? ""} ${r.paciente_apellido ?? ""}`.trim() || "paciente";
      await transporter.sendMail({
        from: FROM,
        to: r.paciente_email,
        subject: `Recordatorio: cita médica mañana ${r.hora_inicio}`,
        text: `Hola ${nombreCompleto}, le recordamos su cita médica en Consultorio Las Gaviotas el ${r.fecha.toISOString().slice(0, 10)} a las ${r.hora_inicio}. Motivo: ${r.motivo ?? "N/D"}.`,
      });
      await pool.query(
        `UPDATE consultorio.notificacion SET estado = 'ENVIADA', enviado_at = NOW() WHERE id = $1`,
        [r.id],
      );
      console.log(`[worker] recordatorio enviado a ${r.paciente_email} cita=${r.cita_id}`);
    } catch (err) {
      console.error(`[worker] fallo envío notif ${r.id}`, err);
      await pool.query(`UPDATE consultorio.notificacion SET estado = 'FALLIDA' WHERE id = $1`, [r.id]);
    }
  }
}

async function marcarNoAsistio() {
  const { rowCount } = await pool.query(
    `UPDATE consultorio.cita SET estado = 'NO_ASISTIO'
      WHERE estado IN ('PROGRAMADA','CONFIRMADA')
        AND (fecha < CURRENT_DATE
             OR (fecha = CURRENT_DATE AND hora_fin < (CURRENT_TIME - INTERVAL '15 minutes')))`,
  );
  if (rowCount && rowCount > 0) console.log(`[worker] ${rowCount} citas marcadas NO_ASISTIO`);
}

async function tick() {
  try {
    await recordatorio24h();
    await marcarNoAsistio();
  } catch (err) {
    console.error("[worker] tick error", err);
  }
}

console.log(`[worker] Consultorio Las Gaviotas arrancando (intervalo ${INTERVALO_MS}ms)`);
tick();
setInterval(tick, INTERVALO_MS);

process.on("SIGTERM", async () => {
  await pool.end();
});