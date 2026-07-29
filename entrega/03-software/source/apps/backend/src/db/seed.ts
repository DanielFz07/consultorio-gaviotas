import bcrypt from "bcryptjs";
import { readFile } from "node:fs/promises";
import { pool } from "./pool.ts";

const SEED_PATH = process.env.SEED_DIR ?? "../db/seeds/001_seed_basico.sql";

async function run() {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS consultorio`);
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  const adminUsername = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const adminNombre = process.env.SEED_ADMIN_NOMBRE ?? "Administrador Consultorio";
  const hash = await bcrypt.hash(adminPassword, 12);

  await pool.query(
    `INSERT INTO consultorio.usuario (username, password_hash, nombre, rol, activo, email)
     VALUES ($1, $2, $3, 'ADMIN', TRUE, $4)
     ON CONFLICT (username) DO UPDATE SET password_hash = $2, nombre = $3, email = $4`,
    [adminUsername, hash, adminNombre, process.env.SEED_ADMIN_EMAIL ?? "admin@consultorio-gaviotas.local"]
  );
  console.log(`✓ Usuario ADMIN '${adminUsername}' creado/actualizado`);

  const seedUsers = [
    { username: "medico",  password: "medico123",  nombre: "Dr. Carlos Pérez",      rol: "MEDICO",    email: "carlos.perez@consultorio-gaviotas.local" },
    { username: "medico2", password: "medico123",  nombre: "Dra. Ana Gómez",         rol: "MEDICO",    email: "ana.gomez@consultorio-gaviotas.local" },
    { username: "recep",   password: "recep123",   nombre: "María Recepción",       rol: "RECEPCION", email: "maria.recep@consultorio-gaviotas.local" },
    { username: "recep2",  password: "recep123",   nombre: "Luis Recepción",        rol: "RECEPCION", email: "luis.recep@consultorio-gaviotas.local" },
  ];

  for (const u of seedUsers) {
    const h = await bcrypt.hash(u.password, 12);
    await pool.query(
      `INSERT INTO consultorio.usuario (username, password_hash, nombre, email, rol, activo)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       ON CONFLICT (username) DO UPDATE SET password_hash = $2, nombre = $3, email = $4, rol = $5`,
      [u.username, h, u.nombre, u.email, u.rol]
    );
    console.log(`✓ Usuario ${u.rol.padEnd(12)} '${u.username}' creado/actualizado (pass: ${u.password})`);
  }

  const sql = await readFile(SEED_PATH, "utf8");
  await pool.query(sql);
  console.log("✓ seed básico cargado");
  await pool.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});