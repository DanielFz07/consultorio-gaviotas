# Deploy en Railway (1 servicio, 3 procesos)

Este repo está configurado para correr **toda la app en un solo servicio Railway** usando `Dockerfile.railway`, ideal para el plan free que limita a 1 servicio.

## Pasos

1. **Crear proyecto en Railway**
   - Ir a https://railway.app/new
   - "Deploy from GitHub repo" → seleccionar `DanielFz07/consultorio-gaviotas`
   - Railway detectará `Dockerfile.railway` automáticamente

2. **Configurar build**
   - Settings → Build
   - Builder: **Dockerfile**
   - Dockerfile Path: `Dockerfile.railway`
   - Root Directory: *(vacío)*

3. **Agregar PostgreSQL**
   - "+ New" → "Database" → "PostgreSQL"
   - Railway crea las vars automáticamente: `DATABASE_URL`, `PGHOST`, etc.

4. **Variables de entorno del servicio** (Settings → Variables):

   | Variable | Valor | Notas |
   |---|---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Conexión a la DB |
   | `JWT_SECRET` | *(generar random)* | Ej: `openssl rand -hex 32` |
   | `UPLOAD_DIR` | `/data/uploads` | Para archivos subidos |
   | `TAX_RATE` | `0.16` | IVA |
   | `NODE_ENV` | `production` | |
   | `PORT` | *(lo setea Railway automáticamente)* | El API escucha aquí |

5. **(Opcional) Volume para uploads**
   - Settings → Volumes → "+ New Volume"
   - Mount path: `/data/uploads`

## Healthcheck

Railway hace healthcheck a `/api/health` en el puerto `$PORT`. El `start-all.sh` arranca el API en ese puerto automáticamente.

## SMTP (worker)

Si querés que el worker mande emails reales, agregá:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu@gmail.com
SMTP_PASS=app-password-de-gmail
SMTP_FROM=Consultorio Las Gaviotas <no-reply@tudominio.com>
WORKER_INTERVAL_MS=300000
```

Si no las ponés, el worker se inicia igual pero loguea warnings al intentar enviar.

## Verificación post-deploy

```bash
# Health
curl https://tu-app.up.railway.app/api/health
# → {"ok":true,"db":true,"timestamp":"..."}

# Login (default)
curl -X POST https://tu-app.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

> Cambiá las contraseñas del seed antes de usar en serio. La consola admin está en `/usuarios`.