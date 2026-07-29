#!/bin/sh
# Single-container start for Railway free tier (1 service).
# Starts API on $API_PORT (internal), Astro frontend on $PORT (public),
# worker as background. PostgreSQL is provided by Railway.

set -e

if [ -z "$DATABASE_URL" ] && [ -z "$PGHOST" ]; then
  echo "ERROR: DATABASE_URL or PGHOST must be set"
  exit 1
fi

# If only DATABASE_URL is provided, parse it and populate PG* vars so the
# worker (which reads PGHOST/PGUSER/etc.) can connect.
if [ -n "$DATABASE_URL" ] && [ -z "$PGHOST" ]; then
  # postgresql://user:pass@host:port/dbname?...
  RE=$(echo "$DATABASE_URL" | sed -E 's|^postgresql://||; s|^postgres://||')
  PGUSER=$(echo "$RE" | cut -d: -f1)
  _PP=$(echo "$RE" | cut -d: -f2 | cut -d@ -f1)
  PGPASSWORD="$_PP"
  HOSTPART=$(echo "$RE" | cut -d@ -f2 | cut -d'/' -f1)
  PGHOST=$(echo "$HOSTPART" | cut -d: -f1)
  _PORT=$(echo "$HOSTPART" | grep -oE ':[0-9]+$' | tr -d ':')
  PGPORT="${_PORT:-5432}"
  PGDATABASE=$(echo "$RE" | cut -d/ -f2 | cut -d'?' -f1)
  export PGUSER PGPASSWORD PGHOST PGPORT PGDATABASE
fi

# Run migrations + seed
echo "==> Running migrations..."
cd /app/backend
bun run src/db/migrate.ts 2>&1 | tail -3

echo "==> Running seeds..."
bun run src/db/seed.ts 2>&1 | tail -3 || true

# Start worker
echo "==> Starting worker..."
cd /app/worker
bun run src/index.ts &
WORKER_PID=$!

# Start API on internal port
echo "==> Starting API on port ${API_PORT:-3001}..."
cd /app/backend
API_PORT="${API_PORT:-3001}" HOST=0.0.0.0 bun run src/server.ts &
API_PID=$!

# Start frontend on public port (use bun — alpine image has no node)
echo "==> Starting frontend on port ${PORT:-8080}..."
cd /app/frontend
HOST=0.0.0.0 PORT="${PORT:-8080}" bun run ./dist/server/entry.mjs &
FRONTEND_PID=$!

trap "kill $WORKER_PID $API_PID $FRONTEND_PID 2>/dev/null || true" EXIT
wait