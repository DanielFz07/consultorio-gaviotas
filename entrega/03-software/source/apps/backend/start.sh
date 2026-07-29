#!/bin/sh
# Builds the backend API service
# Used by Railway when deploying apps/backend/

set -e

cd "$(dirname "$0")"

echo "==> Installing dependencies..."
bun install --production

echo "==> Running migrations..."
bun run src/db/migrate.ts

echo "==> Running seeds..."
bun run src/db/seed.ts

echo "==> Starting server..."
exec bun run src/server.ts
