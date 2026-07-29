#!/bin/sh
# Builds the worker service
# Used by Railway when deploying apps/worker/

set -e

cd "$(dirname "$0")"

echo "==> Installing dependencies..."
bun install --production

echo "==> Starting worker..."
exec bun run src/index.ts
