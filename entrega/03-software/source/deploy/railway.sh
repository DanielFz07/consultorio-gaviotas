#!/usr/bin/env bash
# Railway deploy helper
# Railway supports three deployment patterns:
# 1. Multi-service: one project, multiple services (recommended for consultorio-gaviotas)
# 2. Single Dockerfile: one Dockerfile builds one service
# 3. Monorepo: one project, multiple services via railway.toml

# For consultorio-gaviotas we want 3 services:
# - consultorio-frontend (Astro SSR)
# - consultorio-api (Bun + Elysia)
# - consultorio-worker (Bun cron)
# Plus 1 database:
# - postgres (Railway managed)

# Run interactively:
#   1. Create a Railway project
#   2. Add PostgreSQL plugin
#   3. Add 3 services from this repo (each pointing to its Dockerfile)
#   4. Set environment variables per service

set -e

echo "============================================================"
echo "  Consultorio Las Gaviotas · Railway Deploy"
echo "============================================================"
echo ""

# 1. Check railway CLI
if ! command -v railway &> /dev/null; then
  echo "Installing Railway CLI..."
  curl -fsSL https://railway.app/install.sh | sh
fi

# 2. Login (skip if already)
if ! railway whoami &> /dev/null; then
  echo "Login to Railway..."
  railway login
fi

# 3. Create project if needed
PROJECT_NAME="consultorio-gaviotas"
if ! railway status --json 2>/dev/null | grep -q "$PROJECT_NAME"; then
  echo "Creating Railway project: $PROJECT_NAME"
  railway init --name "$PROJECT_NAME"
fi

# 4. Add PostgreSQL
echo "Adding PostgreSQL database..."
railway add --plugin postgresql || echo "PostgreSQL already added or plugin not available"

# 5. Service configs (in railway.toml at root)
echo ""
echo "Services to create in Railway dashboard:"
echo "  1. consultorio-api      → Dockerfile: apps/backend/Dockerfile"
echo "  2. consultorio-frontend → Dockerfile: apps/frontend/Dockerfile"
echo "  3. consultorio-worker   → Dockerfile: apps/worker/Dockerfile"
echo ""
echo "Or use 'railway up' from each subdirectory:"
echo "  cd apps/backend && railway up"
echo "  cd apps/frontend && railway up"
echo "  cd apps/worker && railway up"

echo ""
echo "After creating each service, set these environment variables:"
echo "  JWT_SECRET=<random-32-chars>"
echo "  UPLOAD_DIR=/data/uploads"
echo "  TAX_RATE=0.16"
echo "  API_URL=<your-api-service-url>  (frontend only)"
echo "  DATABASE_URL=\${{Postgres.DATABASE_URL}}  (api and worker)"
echo "  SMTP_HOST=smtp.gmail.com  (worker, or use Resend/SendGrid)"
echo "  SMTP_PORT=587"
echo "  SMTP_USER=<user>"
echo "  SMTP_PASS=<password>"
echo "  SMTP_FROM=Consultorio Las Gaviotas <no-reply@yourdomain.com>"

echo ""
echo "Post-deploy:"
echo "  - Run migrations: railway run --service consultorio-api bun run src/db/migrate.ts"
echo "  - Run seed: railway run --service consultorio-api bun run src/db/seed.ts"
echo "  - Get URL: railway domain"
