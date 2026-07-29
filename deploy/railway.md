# Deploy en Railway · Consultorio Las Gaviotas

Configurado para correr **toda la app en un solo servicio Railway** (plan free: 1 servicio).

## Arquitectura en el container

```
/app/
├── backend/    API en $API_PORT (3001, interno)
├── frontend/   Astro SSR en $PORT (8080, público)
├── worker/     Cron background (sin puerto)
└── db/         Migraciones y seeds
```

`start-all.sh` arranca los 3 procesos. Nginx o el edge de Railway enruta el tráfico público al puerto que expone el container (`$PORT`).

## Pasos

### 1. Crear proyecto en Railway

- Ir a https://railway.app/new
- "Deploy from GitHub repo" → `DanielFz07/consultorio-gaviotas`
- Railway detecta `Dockerfile.railway` (definido en `railway.json`)

### 2. Agregar PostgreSQL

- "+ New" → "Database" → "PostgreSQL"
- Railway crea automáticamente `DATABASE_URL` apuntando al servicio

### 3. Variables de entorno del servicio

Settings → Variables:

| Variable | Notas |
|---|---|
| `DATABASE_URL` | Auto-inyectada por el plugin Postgres |
| `JWT_SECRET` | Generar con `openssl rand -hex 32` |
| `UPLOAD_DIR` | `/data/uploads` |
| `TAX_RATE` | `0.16` |
| `PORT` | Lo setea Railway (default 8080) |

### 4. (Opcional) Volume para uploads

Settings → Volumes → "+ New Volume" → Mount path `/data/uploads`.

### 5. SMTP — emails reales

Si querés que el worker mande recordatorios de cita reales, agregá:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu@gmail.com
SMTP_PASS=app-password-de-gmail
SMTP_FROM=Consultorio Las Gaviotas <no-reply@tudominio.com>
WORKER_INTERVAL_MS=300000
```

Sin SMTP, el worker loguea warnings al intentar enviar.

## Estructura de archivos para deploy

```
.
├── Dockerfile.railway       # Builds todo en una imagen
├── railway.json             # Config Railway (builder + startCommand)
├── apps/
│   ├── backend/             # Bun + Elysia API
│   ├── frontend/            # Astro 5 SSR (Tailwind v4)
│   └── worker/              # Cron reminders
├── db/                       # Migraciones + seeds
├── deploy/                   # Scripts auxiliares
└── docs/                     # Documentación RUP
```

## Verificación post-deploy

```bash
# Health
curl https://tu-app.up.railway.app/health
# → {"ok":true,"db":true,"timestamp":"..."}

# Login (credenciales por defecto del seed)
curl -X POST https://tu-app.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

> **Cambiá las contraseñas del seed antes de usar en producción.** Admin: `/usuarios`.

## Deploy alternativo: 3 servicios separados

Si tenés plan con múltiples servicios, podés desplegar cada app por separado:

| Servicio | Dockerfile | Puerto |
|---|---|---|
| `consultorio-api` | `apps/backend/Dockerfile.railway` | 3001 (interno) |
| `consultorio-frontend` | `apps/frontend/Dockerfile` | 8080 (público) |
| `consultorio-worker` | `apps/worker/Dockerfile.railway` | sin puerto |

Configurá `API_URL` en el frontend = `https://<api>.up.railway.app`.