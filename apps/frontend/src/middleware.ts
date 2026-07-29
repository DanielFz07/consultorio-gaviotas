import { defineMiddleware } from "astro:middleware";
import { api, isError, type ApiUser } from "./lib/api";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/health"];
const PUBLIC_PREFIXES = ["/_astro", "/favicon", "/static"];

// API interno. El browser no puede acceder a este puerto directamente en
// producción, así que el middleware hace de proxy.
// En local (docker-compose): http://api:3001 (nombre del servicio)
// En producción (Railway): http://localhost:3001 (mismo contenedor)
const INTERNAL_API = process.env.API_URL ?? `http://localhost:${process.env.API_PORT ?? 3001}`;

// Decode JWT payload (middle segment, base64url) without verifying signature.
// The JWT was issued by the same backend with the same JWT_SECRET, so this is safe.
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  const url = new URL(ctx.request.url);
  const path = url.pathname;

  // PROXY: /api/* → API interno. Permite que el browser use el mismo
  // origen (window.location.origin) sin conocer el puerto interno.
  if (path.startsWith("/api/")) {
    const target = INTERNAL_API + path + url.search;
    const headers = new Headers(ctx.request.headers);
    headers.delete("host");
    headers.delete("connection");

    // Set x-user header from the JWT cookie so the backend route handlers
    // (which read x-user) know who's making the request. The browser may not
    // send an Authorization header on regular link navigations (e.g. opening
    // a PDF report in a new tab), so we derive the user from the cookie.
    if (path !== "/api/auth/login") {
      const cookieToken = ctx.cookies.get("consultorio-gaviotas_token")?.value;
      if (cookieToken) {
        const payload = decodeJwtPayload(cookieToken);
        if (payload) {
          headers.set("x-user", JSON.stringify({
            sub: payload.sub,
            username: payload.username,
            rol: payload.rol,
            nombre: payload.nombre,
          }));
        }
      }
    }

    const hasBody = !["GET", "HEAD"].includes(ctx.request.method);
    const res = await fetch(target, {
      method: ctx.request.method,
      headers,
      body: hasBody ? await ctx.request.arrayBuffer() : undefined,
    });
    const responseHeaders = new Headers(res.headers);
    responseHeaders.delete("connection");
    responseHeaders.delete("transfer-encoding");
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  }

  if (PUBLIC_PATHS.includes(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p))) {
    const response = await next();
    // Disable caching for HTML pages so edits show up immediately.
    // Static hashed assets keep their own cache headers.
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  }

  const token = ctx.cookies.get("consultorio-gaviotas_token")?.value;
  if (!token) {
    return ctx.redirect(`/login?redirect=${encodeURIComponent(path)}`);
  }

  const r = await api.get<{ user: ApiUser }>(ctx, "/api/auth/me").catch(() => null);
  if (!r || !r.ok || isError(r.data)) {
    ctx.cookies.delete("consultorio-gaviotas_token", { path: "/" });
    return ctx.redirect("/login");
  }

  ctx.locals.user = r.data.user;
  const response = await next();
  // Disable caching for authenticated HTML pages too.
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
});