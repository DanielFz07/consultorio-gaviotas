import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { pool } from "./pool.ts";

const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR ?? "../db/migrations";

async function ensureMigrationsTable() {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS consultorio`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS consultorio._migration (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedMigrations(): Promise<Set<string>> {
  const { rows } = await pool.query<{ filename: string }>(
    "SELECT filename FROM consultorio._migration ORDER BY id",
  );
  return new Set(rows.map((r) => r.filename));
}

async function run() {
  await ensureMigrationsTable();
  const done = await appliedMigrations();
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (done.has(file)) {
      console.log(`skip ${file} (ya aplicada)`);
      continue;
    }
    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    console.log(`aplicando ${file}`);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO consultorio._migration (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`  ok ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`  fail ${file}`, err);
      process.exit(1);
    } finally {
      client.release();
    }
  }
  await pool.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});