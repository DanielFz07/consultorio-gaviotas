import { Pool, type PoolClient } from "pg";

function parseDatabaseUrl(url: string): {
  host: string; port: number; user: string; password: string; database: string;
} {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: u.username,
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
  };
}

function getConfig() {
  if (process.env.DATABASE_URL) {
    return { ...parseDatabaseUrl(process.env.DATABASE_URL), max: 10 };
  }
  return {
    host: process.env.PGHOST ?? "localhost",
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? "consultorio",
    password: process.env.PGPASSWORD ?? "consultorio",
    database: process.env.PGDATABASE ?? "consultorio",
    max: 10,
  };
}

export const pool = new Pool(getConfig());

pool.on("error", (err) => {
  console.error("Unexpected pg pool error", err);
});

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function healthcheck(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}