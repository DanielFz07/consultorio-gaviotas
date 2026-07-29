// Helper para resolver la URL del backend.
// Server-side: el API siempre escucha en 3001 dentro del contenedor.
// API_URL env var permite override para setups con API separado.
// Client-side: URL relativa — el middleware Astro proxy /api/* al backend.
export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    // Browser: ruta relativa. Astro middleware redirige /api/* al backend.
    return "";
  }
  return process.env.API_URL ?? `http://localhost:${process.env.API_PORT ?? 3001}`;
}

import type { APIContext } from "astro";

export interface ApiUser {
  id: string;
  username: string;
  rol: "ADMIN" | "MEDICO" | "RECEPCION";
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

async function request<T>(
  ctx: APIContext,
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T | ApiError }> {
  const token = ctx.cookies.get("consultorio-gaviotas_token")?.value;
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${getApiUrl()}${path}`, { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as T | ApiError;
  return { ok: res.ok, status: res.status, data };
}

export const api = {
  get: <T>(ctx: APIContext, path: string) => request<T>(ctx, path),
  post: <T>(ctx: APIContext, path: string, body: unknown) =>
    request<T>(ctx, path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(ctx: APIContext, path: string, body: unknown) =>
    request<T>(ctx, path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(ctx: APIContext, path: string) =>
    request<T>(ctx, path, { method: "DELETE" }),
  upload: async <T>(
    ctx: APIContext,
    path: string,
    formData: FormData,
  ): Promise<{ ok: boolean; status: number; data: T | ApiError }> => {
    const token = ctx.cookies.get("consultorio-gaviotas_token")?.value;
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${getApiUrl()}${path}`, { method: "POST", body: formData, headers });
    const data = (await res.json().catch(() => ({}))) as T | ApiError;
    return { ok: res.ok, status: res.status, data };
  },
};

export function isError(d: unknown): d is ApiError {
  return typeof d === "object" && d !== null && "code" in d && "message" in d;
}