#!/bin/sh
# Orquestador de los 3 servicios de Consultorio Las Gaviotas en un solo contenedor.
# Diseñado para Railway free tier donde solo podés tener 1 servicio.

set -e

# Cargar DATABASE_URL del entorno
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL no está definida"
  echo "Agregá el plugin de PostgreSQL en Railway: railway add --plugin postgresql"
  exit 1
fi

export DATABASE_URL

# Esperar a que PostgreSQL esté listo (max 60s).
# Usa psql -c "SELECT 1" contra la URL parseada.
echo "==> Esperando a que PostgreSQL esté disponible..."
i=0
while [ "$i" -lt 60 ]; do
  if psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1; then
    echo "    PostgreSQL listo"
    break
  fi
  i=$((i + 1))
  sleep 1
done
if [ "$i" -eq 60 ]; then
  echo "ERROR: PostgreSQL no respondió en 60s"
  exit 1
fi

# Arquitectura de puertos dentro del container:
# - API escucha en 3001 (interno, no expuesto al browser)
# - Frontend Astro escucha en $PORT (lo que Railway expone al público)
# - Worker es background sin puerto
# Así el navegador llega a https://tu-app.up.railway.app/ y aterriza en Astro,
# que internamente llama al API en http://localhost:3001/api/*
API_PORT="${API_PORT:-3001}"
FRONTEND_PORT="${PORT:-${VETSYS_PORT:-8080}}"

echo "==> Iniciando API en puerto ${API_PORT} (interno)..."
cd /app/api
export API_PORT
./start.sh &
API_PID=$!

echo "==> Iniciando Worker..."
cd /app/wrk
./start.sh &
WORKER_PID=$!

echo "==> Iniciando Frontend en puerto ${FRONTEND_PORT} (público)..."
cd /app/web
export PORT="${FRONTEND_PORT}"
export HOST=0.0.0.0
# Usamos bun en vez de node: el container base (oven/bun:1.1) trae Node 12
# que no soporta la sintaxis ES2022 del build de Astro 5. Bun sí.
if [ -f "./dist/server/entry.mjs" ]; then
  bun run ./dist/server/entry.mjs &
elif [ -f "./node_modules/.bin/astro" ]; then
  bunx astro preview --host 0.0.0.0 --port "${FRONTEND_PORT}" &
else
  bun run preview --host 0.0.0.0 --port "${FRONTEND_PORT}" &
fi
FRONTEND_PID=$!

# Esperar a que cualquier proceso termine
trap "kill $API_PID $WORKER_PID $FRONTEND_PID 2>/dev/null || true" EXIT
wait