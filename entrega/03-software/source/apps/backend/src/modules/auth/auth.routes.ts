import jwt from "@elysiajs/jwt";
import bcrypt from "bcryptjs";
import { Elysia } from "elysia";
import { z } from "zod";
import { pool } from "../../db/pool.ts";
import { getClientInfo, recordAudit, recordLoginAttempt } from "../../lib/audit.ts";

const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
});

export type Rol = "ADMIN" | "MEDICO" | "RECEPCION";

export type AuthPayload = {
  sub: string;
  username: string;
  rol: Rol;
  nombre: string;
};

export const authRoutes = new Elysia({ prefix: "/api/auth" })
  .post(
    "/login",
    async ({ body, jwt, set, request }) => {
      const parsed = loginSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { code: "EX-004", message: "Datos inválidos", details: parsed.error.format() };
      }
      const { username, password } = parsed.data;
      const info = getClientInfo(request);
      const { rows } = await pool.query(
        "SELECT id, username, password_hash, nombre, rol, activo FROM consultorio.usuario WHERE username = $1",
        [username]
      );
      if (rows.length === 0 || !rows[0].activo) {
        await recordLoginAttempt(username, null, false, "usuario no existe o inactivo", info.ip, info.userAgent);
        await recordAudit(
          { usuarioId: null, username, ip: info.ip, userAgent: info.userAgent, ruta: "/api/auth/login", metodo: "POST" },
          "LOGIN_FAIL", undefined, undefined,
          undefined, { username, motivo: "no existe o inactivo" },
        );
        set.status = 401;
        return { code: "EX-005", message: "Credenciales inválidas" };
      }
      const u = rows[0];
      const ok = await bcrypt.compare(password, u.password_hash);
      if (!ok) {
        await recordLoginAttempt(username, u.id, false, "password incorrecto", info.ip, info.userAgent);
        await recordAudit(
          { usuarioId: u.id, username, ip: info.ip, userAgent: info.userAgent, ruta: "/api/auth/login", metodo: "POST" },
          "LOGIN_FAIL", "usuario", u.id,
          undefined, { motivo: "password incorrecto" },
        );
        set.status = 401;
        return { code: "EX-005", message: "Credenciales inválidas" };
      }
      const payload: AuthPayload = {
        sub: String(u.id),
        username: u.username,
        rol: u.rol as Rol,
        nombre: u.nombre,
      };
      const token = await jwt.sign(payload, { expiresIn: "8h" });
      await recordLoginAttempt(username, u.id, true, null, info.ip, info.userAgent);
      await recordAudit(
        { usuarioId: u.id, username, ip: info.ip, userAgent: info.userAgent, ruta: "/api/auth/login", metodo: "POST" },
        "LOGIN_OK", "usuario", u.id,
      );
      return { token, user: payload };
    }
  )
  .get(
    "/me",
    async ({ jwt, headers, set }) => {
      const auth = headers["authorization"];
      if (!auth?.startsWith?.("Bearer ")) {
        set.status = 401;
        return { code: "EX-002", message: "Token requerido" };
      }
      const payload = (await jwt.verify(auth.slice(7))) as AuthPayload | false;
      if (!payload) {
        set.status = 401;
        return { code: "EX-030", message: "Token inválido o expirado" };
      }
      return { user: payload };
    }
  );