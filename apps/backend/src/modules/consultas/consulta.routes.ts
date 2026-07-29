import { Elysia } from "elysia";
import { z } from "zod";
import { writeFile, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { nanoid } from "nanoid";
import { pool, withTransaction } from "../../db/pool.ts";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./data/uploads";

const consultaInitSchema = z.object({
  sintomas: z.string().min(3),
  diagnostico: z.string().min(3),
  tratamiento: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),
});

const prescripcionSchema = z.object({
  productoId: z.number().int().positive(),
  cantidad: z.number().int().positive(),
  dosis: z.string().max(120).optional().nullable(),
  frecuencia: z.string().max(120).optional().nullable(),
  duracion: z.string().max(120).optional().nullable(),
});

const servicioEnConsultaSchema = z.object({
  servicioId: z.number().int().positive(),
  cantidad: z.number().int().positive().default(1),
});

const TAX_RATE = Number(process.env.TAX_RATE ?? 0.16);

export const consultaRoutes = new Elysia({ prefix: "/api" })
  .get("/citas/:id/consulta-activa", async ({ params, set }) => {
    try {
      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM consultorio.consulta WHERE cita_id = $1 LIMIT 1`,
        [params.id],
      );
      if (rows.length === 0) return { id: null };
      return { id: Number(rows[0].id) };
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string; status?: number };
      if (err.status) set.status = err.status;
      return { code: err.code || "EX-099", message: err.message || "Error" };
    }
  })
  .get("/consultas/:id/items", async ({ params, set }) => {
    try {
      const consulta = await pool.query<{ id: string; cita_id: string }>(
        "SELECT id, cita_id FROM consultorio.consulta WHERE id = $1",
        [params.id],
      );
      if (consulta.rowCount === 0) {
        set.status = 404;
        return { code: "EX-019", message: "Consulta no encontrada" };
      }
      const servicios = await pool.query(
        `SELECT cs.id, cs.cantidad, cs.precio_cobrado, s.nombre AS nombre, 'SERVICIO' AS tipo
           FROM consultorio.consulta_servicio cs
           JOIN consultorio.servicio s ON s.id = cs.servicio_id
          WHERE cs.consulta_id = $1
          ORDER BY cs.id`,
        [params.id],
      );
      const prescripciones = await pool.query(
        `SELECT p.id, p.cantidad, p.precio_unitario_cobrado, p.dosis, p.frecuencia, p.duracion,
                pr.nombre AS nombre, 'PRODUCTO' AS tipo
           FROM consultorio.prescripcion p
           JOIN consultorio.producto pr ON pr.id = p.producto_id
          WHERE p.consulta_id = $1
          ORDER BY p.id`,
        [params.id],
      );
      const items = [
        ...servicios.rows.map((r) => ({
          id: Number(r.id),
          tipo: "SERVICIO",
          nombre: r.nombre,
          cantidad: Number(r.cantidad),
          precio: Number(r.precio_cobrado),
          subtotal: Number(r.cantidad) * Number(r.precio_cobrado),
          extra: null,
        })),
        ...prescripciones.rows.map((r) => ({
          id: Number(r.id),
          tipo: "PRODUCTO",
          nombre: r.nombre,
          cantidad: Number(r.cantidad),
          precio: Number(r.precio_unitario_cobrado),
          subtotal: Number(r.cantidad) * Number(r.precio_unitario_cobrado),
          extra: { dosis: r.dosis, frecuencia: r.frecuencia, duracion: r.duracion },
        })),
      ];
      const subtotal = items.reduce((acc, it) => acc + it.subtotal, 0);
      const tax = Number((subtotal * Number(process.env.TAX_RATE ?? 0.16)).toFixed(2));
      return { items, subtotal: Number(subtotal.toFixed(2)), impuestos: tax, total: Number((subtotal + tax).toFixed(2)) };
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string; status?: number };
      if (err.status) set.status = err.status;
      return { code: err.code || "EX-099", message: err.message || "Error" };
    }
  })
  .post("/citas/:id/consulta", async ({ params, body, set }) => {
    const parsed = consultaInitSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { code: "EX-004", message: "Datos inválidos" };
    }
    try {
      const result = await withTransaction(async (client) => {
        const cita = await client.query(
          `SELECT c.id, c.paciente_id, c.medico_id, c.estado
             FROM consultorio.cita c WHERE c.id = $1 FOR UPDATE`,
          [params.id],
        );
        if (cita.rowCount === 0) {
          throw Object.assign(new Error("Cita no encontrada"), { code: "EX-019", status: 404 });
        }
        if (!["PROGRAMADA", "CONFIRMADA", "EN_CURSO", "NO_ASISTIO"].includes(cita.rows[0].estado)) {
          throw Object.assign(new Error(`La cita está en estado ${cita.rows[0].estado} y no puede abrirse`), { code: "EX-010", status: 409 });
        }
        await client.query(
          `UPDATE consultorio.cita SET estado = 'EN_CURSO', updated_at = NOW() WHERE id = $1`,
          [params.id],
        );
        const { rows } = await client.query(
          `INSERT INTO consultorio.consulta
             (cita_id, paciente_id, medico_id, sintomas, diagnostico, tratamiento, observaciones)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [
            params.id,
            cita.rows[0].paciente_id,
            cita.rows[0].medico_id,
            parsed.data.sintomas,
            parsed.data.diagnostico,
            parsed.data.tratamiento ?? null,
            parsed.data.observaciones ?? null,
          ],
        );
        return rows[0];
      });
      set.status = 201;
      return result;
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string; status?: number };
      if (err.status) set.status = err.status;
      return { code: err.code || "EX-099", message: err.message || "Error" };
    }
  })
  .post("/consultas/:id/servicios", async ({ params, body, set }) => {
    const parsed = servicioEnConsultaSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { code: "EX-004", message: "Datos inválidos" };
    }
    try {
      const result = await withTransaction(async (client) => {
        const svc = await client.query(
          `SELECT precio, nombre, activo FROM consultorio.servicio WHERE id = $1`,
          [parsed.data.servicioId],
        );
        if (svc.rowCount === 0) {
          throw Object.assign(new Error("Servicio no encontrado"), { code: "EX-019", status: 404 });
        }
        if (!svc.rows[0].activo) {
          throw Object.assign(new Error(`Servicio ${svc.rows[0].nombre} inactivo`), { code: "EX-012", status: 409 });
        }
        const { rows } = await client.query(
          `INSERT INTO consultorio.consulta_servicio (consulta_id, servicio_id, cantidad, precio_cobrado)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [params.id, parsed.data.servicioId, parsed.data.cantidad, svc.rows[0].precio],
        );
        return rows[0];
      });
      set.status = 201;
      return result;
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string; status?: number };
      if (err.status) set.status = err.status;
      return { code: err.code || "EX-099", message: err.message || "Error" };
    }
  })
  .post("/consultas/:id/prescripciones", async ({ params, body, set }) => {
    const parsed = prescripcionSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { code: "EX-004", message: "Datos inválidos" };
    }
    try {
      const result = await withTransaction(async (client) => {
        const prod = await client.query(
          `SELECT id, nombre, stock_actual, activo, precio_venta
             FROM consultorio.producto WHERE id = $1 FOR UPDATE`,
          [parsed.data.productoId],
        );
        if (prod.rowCount === 0) {
          throw Object.assign(new Error("Producto no encontrado"), { code: "EX-019", status: 404 });
        }
        if (!prod.rows[0].activo) {
          throw Object.assign(new Error(`Producto ${prod.rows[0].nombre} inactivo`), { code: "EX-012", status: 409 });
        }
        if (prod.rows[0].stock_actual < parsed.data.cantidad) {
          throw Object.assign(
            new Error(
              `Stock insuficiente para ${prod.rows[0].nombre}. Disponible: ${prod.rows[0].stock_actual}, solicitado: ${parsed.data.cantidad}`,
            ),
            { code: "EX-011", status: 409 },
          );
        }
        await client.query(
          `UPDATE consultorio.producto SET stock_actual = stock_actual - $1, updated_at = NOW() WHERE id = $2`,
          [parsed.data.cantidad, parsed.data.productoId],
        );
        const { rows } = await client.query(
          `INSERT INTO consultorio.prescripcion
             (consulta_id, producto_id, cantidad, dosis, frecuencia, duracion, precio_unitario_cobrado)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [
            params.id,
            parsed.data.productoId,
            parsed.data.cantidad,
            parsed.data.dosis ?? null,
            parsed.data.frecuencia ?? null,
            parsed.data.duracion ?? null,
            prod.rows[0].precio_venta,
          ],
        );
        return rows[0];
      });
      set.status = 201;
      return result;
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string; status?: number };
      if (err.status) set.status = err.status;
      return { code: err.code || "EX-099", message: err.message || "Error" };
    }
  })
  .post("/consultas/:id/archivos", async ({ params, request, set, headers, jwt }) => {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const form = await request.formData();
    const file = form.get("archivo");
    if (!(file instanceof File)) {
      set.status = 400;
      return { code: "EX-004", message: "Archivo requerido" };
    }
    const MAX = 10 * 1024 * 1024;
    if (file.size > MAX) {
      set.status = 413;
      return { code: "EX-021", message: "Archivo excede 10 MB" };
    }
    const ALLOWED = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
    if (!ALLOWED.includes(file.type)) {
      set.status = 415;
      return { code: "EX-022", message: `Tipo ${file.type} no permitido` };
    }
    const auth = headers["authorization"];
    const payload = auth?.startsWith("Bearer ") ? (await jwt.verify(auth.slice(7))) as { sub: string } | false : false;
    const uploadedBy = payload && typeof payload === "object" ? payload.sub : null;
    const ext = extname(file.name) || ".bin";
    const filename = `${nanoid()}${ext}`;
    const path = join(UPLOAD_DIR, filename);
    try {
      await writeFile(path, Buffer.from(await file.arrayBuffer()));
    } catch {
      set.status = 500;
      return { code: "EX-023", message: "No se pudo guardar el archivo" };
    }
    const { rows } = await pool.query(
      `INSERT INTO consultorio.archivo (consulta_id, nombre, path, mime, size_bytes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [params.id, file.name, filename, file.type, file.size, uploadedBy],
    );
    set.status = 201;
    return rows[0];
  })
  .post("/consultas/:id/finalizar", async ({ params, set }) => {
    try {
      const result = await withTransaction(async (client) => {
      const c = await client.query(
        `SELECT c.* FROM consultorio.consulta c
           JOIN consultorio.cita ci ON ci.id = c.cita_id
          WHERE c.id = $1 FOR UPDATE`,
        [params.id],
      );
      if (c.rowCount === 0) {
        throw Object.assign(new Error("Consulta no encontrada"), { code: "EX-019", status: 404 });
      }
      const totales = await client.query<{ subtotal: string }>(
        `SELECT
           COALESCE((SELECT SUM(cs.cantidad * cs.precio_cobrado)
                       FROM consultorio.consulta_servicio cs WHERE cs.consulta_id = $1), 0)
         +
           COALESCE((SELECT SUM(p.cantidad * p.precio_unitario_cobrado)
                       FROM consultorio.prescripcion p WHERE p.consulta_id = $1), 0) AS subtotal`,
        [params.id],
      );
      const subtotal = Number(totales.rows[0].subtotal);
      const impuestos = Number((subtotal * TAX_RATE).toFixed(2));
      const total = Number((subtotal + impuestos).toFixed(2));
      const seq = await client.query<{ nextval: string }>(
        "SELECT nextval('consultorio.factura_numero_seq') AS nextval",
      );
      const numero = `F-${new Date().getFullYear()}-${seq.rows[0].nextval.padStart(8, "0")}`;
      const factura = await client.query<{ id: string }>(
        `INSERT INTO consultorio.factura (numero, consulta_id, paciente_id, subtotal, impuestos, total, estado)
         VALUES ($1, $2, $3, $4, $5, $6, 'EMITIDA') RETURNING id`,
        [numero, params.id, c.rows[0].paciente_id, subtotal, impuestos, total],
      );
      const facturaId = factura.rows[0].id;
      await client.query(
        `INSERT INTO consultorio.item_factura
           (factura_id, tipo, ref_id, descripcion, cantidad, precio_unitario, subtotal)
         SELECT $1, 'SERVICIO', s.id, s.nombre, cs.cantidad, cs.precio_cobrado,
                cs.cantidad * cs.precio_cobrado
           FROM consultorio.consulta_servicio cs
           JOIN consultorio.servicio s ON s.id = cs.servicio_id
          WHERE cs.consulta_id = $2`,
        [facturaId, params.id],
      );
      await client.query(
        `INSERT INTO consultorio.item_factura
           (factura_id, tipo, ref_id, descripcion, cantidad, precio_unitario, subtotal)
         SELECT $1, 'PRODUCTO', p.id, pr.nombre, p.cantidad, p.precio_unitario_cobrado,
                p.cantidad * p.precio_unitario_cobrado
           FROM consultorio.prescripcion p
           JOIN consultorio.producto pr ON pr.id = p.producto_id
          WHERE p.consulta_id = $2`,
        [facturaId, params.id],
      );
      await client.query(
        `UPDATE consultorio.cita SET estado = 'ATENDIDA', updated_at = NOW() WHERE id = $1`,
        [c.rows[0].cita_id],
      );
      await client.query(
        `INSERT INTO consultorio.entrada_historial (historial_id, fecha, tipo, descripcion, autor_id)
         SELECT hc.id, NOW(), 'CONSULTA', $2 || ' / ' || $3, $4
           FROM consultorio.historial_clinico hc WHERE hc.paciente_id = $1`,
        [c.rows[0].paciente_id, c.rows[0].sintomas.slice(0, 80), c.rows[0].diagnostico.slice(0, 80), c.rows[0].medico_id],
      );
      return { consultaId: params.id, facturaId, facturaNumero: numero, total };
      });
      set.status = 200;
      return result;
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string; status?: number };
      if (err.status) set.status = err.status;
      return { code: err.code || "EX-099", message: err.message || "Error" };
    }
  });