import cors from "@elysiajs/cors";
import jwt from "@elysiajs/jwt";
import { Elysia } from "elysia";
import { authRoutes, type AuthPayload } from "./modules/auth/auth.routes.ts";
import { auditRoutes } from "./modules/audit/audit.routes.ts";
import { citaRoutes } from "./modules/citas/cita.routes.ts";
import { consultaRoutes } from "./modules/consultas/consulta.routes.ts";
import { facturaRoutes } from "./modules/facturas/factura.routes.ts";
import { mantenimientoRoutes } from "./modules/mantenimiento/mantenimiento.routes.ts";
import { pacienteRoutes } from "./modules/pacientes/paciente.routes.ts";
import { productoRoutes, servicioRoutes } from "./modules/productos/producto.routes.ts";
import { reporteRoutes } from "./modules/reportes/reporte.routes.ts";
import { usuarioRoutes } from "./modules/usuarios/usuario.routes.ts";
import { healthcheck } from "./db/pool.ts";
import { recordAudit } from "./lib/audit.ts";

const PORT = Number(process.env.API_PORT ?? 3001);

const PUBLIC_PATHS = new Set(["/api/auth/login", "/api/health"]);

const app = new Elysia({ name: "consultorio-gaviotas-api" })
  .use(cors())
  .use(jwt({
    name: "jwt",
    secret: process.env.JWT_SECRET ?? "change-me-in-prod",
  }))
  .onBeforeHandle(async ({ headers, jwt, set, path, request }) => {
    const method = request.method;
    if (method === "OPTIONS") return;
    if (PUBLIC_PATHS.has(path)) return;
    const auth = headers["authorization"];
    if (!auth?.startsWith?.("Bearer ")) {
      set.status = 401;
      throw new Error("EX-002 Token requerido");
    }
    const payload = (await jwt.verify(auth.slice(7))) as AuthPayload | false;
    if (!payload) {
      set.status = 401;
      throw new Error("EX-030 Token inválido o expirado");
    }
    (headers as Record<string, string>)["x-user"] = JSON.stringify(payload);
  })
  .get("/api/health", async () => {
    const db = await healthcheck();
    return { ok: db, db, timestamp: new Date().toISOString() };
  })
  .use(authRoutes)
  .use(pacienteRoutes)
  .use(citaRoutes)
  .use(consultaRoutes)
  .use(productoRoutes)
  .use(servicioRoutes)
  .use(facturaRoutes)
  .use(usuarioRoutes)
  .use(auditRoutes)
  .use(mantenimientoRoutes)
  .use(reporteRoutes)
  .onError(({ code, error, set }) => {
    const msg = typeof error === "object" && error !== null
      ? (error as Record<string, unknown>).message ?? String(error)
      : String(error);
    if (typeof msg === "string" && msg.startsWith("EX-")) {
      const codeEx = msg.split(" ")[0];
      set.status = codeEx === "EX-002" || codeEx === "EX-030" ? 401
        : codeEx === "EX-003" ? 403
        : codeEx === "EX-013" ? 400
        : 500;
      return { code: codeEx, message: msg.slice(5) };
    }
    console.error("[error]", code, error instanceof Error ? error.stack : error);
    set.status = 500;
    return { code: "EX-099", message: `Error interno: ${typeof msg === "string" ? msg : "desconocido"}` };
  })
  .listen(PORT);

console.log(`Consultorio Las Gaviotas API corriendo en puerto ${app.server?.port ?? PORT}`);