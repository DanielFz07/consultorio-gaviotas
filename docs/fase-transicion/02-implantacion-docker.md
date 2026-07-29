# Manual de Implantación - Consultorio Las Gaviotas

**Fase:** Transición
**Objetivo:** Levantar el sistema en un servidor Linux de producción.

---

## 1. Requisitos del Servidor

| Recurso | Mínimo | Recomendado |
|---|---|---|
| OS | Ubuntu 22.04 LTS / Debian 12 | Ubuntu 24.04 LTS |
| CPU | 2 vCPUs | 4 vCPUs |
| RAM | 4 GB | 8 GB |
| Disco | 40 GB | 80 GB SSD |
| Red | 100 Mbps | 1 Gbps |
| Acceso | SSH con sudo + IP fija | SSH con clave pública |

Puertos a abrir:

| Puerto | Servicio | Acceso |
|---|---|---|
| 22 | SSH | IP admin |
| 80 | HTTP (reverse proxy) | Público |
| 443 | HTTPS | Público |
| 8025 | Mailhog UI | Solo desarrollo |

PostgreSQL, API y Worker no exponen puertos al público: solo red interna Docker.

---

## 2. Instalación Base

### 2.1 Instalar Docker

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

sudo usermod -aG docker $USER
newgrp docker
docker --version
```

### 2.2 Instalar Bun (para correr migraciones locales si aplica)

```bash
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"
bun --version
```

---

## 3. Despliegue del Sistema

### 3.1 Clonar código

```bash
sudo mkdir -p /opt/consultorio-gaviotas
sudo chown $USER:$USER /opt/consultorio-gaviotas
cd /opt/consultorio-gaviotas
git clone <repo-url> .
```

### 3.2 Configurar variables de entorno

```bash
cp deploy/.env.example deploy/.env
nano deploy/.env
```

Variables críticas:

```env
POSTGRES_PASSWORD=<contraseña fuerte 24+ chars>
JWT_SECRET=<secreto aleatorio 64+ chars>
SMTP_HOST=<host SMTP real>
SMTP_PORT=587
SMTP_USER=<usuario SMTP>
SMTP_PASS=<password SMTP>
SMTP_FROM=Consultorio Las Gaviotas <no-reply@consultorio-gaviotas.local>
SEED_ADMIN_PASSWORD=<password admin distinta a admin123>
WORKER_INTERVAL_MS=60000
```

Generar secretos:

```bash
openssl rand -base64 48   # para JWT_SECRET
openssl rand -base64 32   # para POSTGRES_PASSWORD
```

### 3.3 Levantar servicios

```bash
cd deploy
docker compose pull
docker compose up -d
docker compose ps
docker compose logs -f api
```

### 3.4 Verificación post-despliegue

```bash
# Healthcheck
curl -s http://localhost:3001/api/health

# Mailhog solo en dev; en prod quitar del compose o deshabilitar puerto 8025.

# Verificar contenedor DB
docker compose exec db psql -U consultorio-gaviotas -d consultorio-gaviotas -c "SELECT COUNT(*) FROM consultorio.usuario;"
```

Resultado esperado: `1` (admin seed).

### 3.5 Crear usuarios reales

```bash
docker compose exec db psql -U consultorio-gaviotas -d consultorio-gaviotas
```

```sql
-- Crear médico (la contraseña debe venir hasheada con bcrypt cost 12)
-- En API, endpoint admin: POST /api/admin/usuarios (no implementado en MVP, hacerlo vía SQL por ahora)
INSERT INTO consultorio.usuario (username, password_hash, nombre, rol, email)
VALUES ('consultorio', '<hash-bcrypt>', 'Dr. Carlos Pérez', 'MEDICO', 'perez@consultorio-gaviotas.local');

INSERT INTO consultorio.usuario (username, password_hash, nombre, rol, email)
VALUES ('recep', '<hash-bcrypt>', 'Ana Recepción', 'RECEPCION', 'ana@consultorio-gaviotas.local');
```

Generar hash bcrypt desde la máquina host:

```bash
docker run --rm oven/bun:alpine bun -e "
const bcrypt = await import('bcryptjs');
console.log(await bcrypt.default.hash('recep123', 12));
"
```

---

## 4. HTTPS y Reverse Proxy

### 4.1 Con Caddy (más simple)

```bash
sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```
consultorio-gaviotas.clinica.com {
    reverse_proxy localhost:3001
}
```

```bash
sudo systemctl reload caddy
```

Caddy obtiene certificado TLS automático vía Let's Encrypt.

### 4.2 Con Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name consultorio-gaviotas.clinica.com;

    ssl_certificate /etc/letsencrypt/live/consultorio-gaviotas.clinica.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/consultorio-gaviotas.clinica.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    client_max_body_size 15M;
}
```

```bash
sudo certbot --nginx -d consultorio-gaviotas.clinica.com
sudo systemctl reload nginx
```

---

## 5. Backups

### 5.1 Cron de backup lógico

`/opt/consultorio-gaviotas/scripts/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
FECHA=$(date +%Y%m%d_%H%M%S)
DEST=/opt/consultorio-gaviotas/backups
mkdir -p $DEST

docker compose -f /opt/consultorio-gaviotas/deploy/docker-compose.yml exec -T db \
  pg_dump -U consultorio-gaviotas -d consultorio-gaviotas -Fc > $DEST/db_$FECHA.dump

# Subir a storage externo (ej. S3)
aws s3 cp $DEST/db_$FECHA.dump s3://clinica-backups/consultorio-gaviotas/db_$FECHA.dump

# Backup de uploads
tar -czf $DEST/uploads_$FECHA.tar.gz /var/lib/docker/volumes/consultorio-gaviotas_uploads/

# Limpieza local: mantener 7 días
find $DEST -name "db_*.dump" -mtime +7 -delete
find $DEST -name "uploads_*.tar.gz" -mtime +7 -delete
```

```bash
chmod +x /opt/consultorio-gaviotas/scripts/backup.sh
sudo crontab -e
```

```
0 2 * * * /opt/consultorio-gaviotas/scripts/backup.sh >> /var/log/consultorio-gaviotas-backup.log 2>&1
```

### 5.2 Restauración

```bash
docker compose -f /opt/consultorio-gaviotas/deploy/docker-compose.yml exec -T db \
  pg_restore -U consultorio-gaviotas -d consultorio-gaviotas --clean --if-exists < /opt/consultorio-gaviotas/backups/db_20260720_020000.dump

docker run --rm -v consultorio-gaviotas_uploads:/data -v /opt/consultorio-gaviotas/backups:/backup alpine \
  tar -xzf /backup/uploads_20260720_020000.tar.gz -C /data
```

---

## 6. Monitoreo

### 6.1 Healthcheck externo

Configurar UptimeRobot o similar contra `https://consultorio-gaviotas.clinica.com/api/health`.

### 6.2 Logs

```bash
docker compose logs -f --tail=200 api worker
```

Para persistencia, montar driver de logs a `journald` o `fluentd`.

### 6.3 Disco

```bash
df -h /
docker system df
```

Alerta si `/` supera 80% o volumen `dbdata` supera 20 GB.

---

## 7. Actualización del Sistema

```bash
cd /opt/consultorio-gaviotas
git pull
cd deploy
docker compose build
docker compose up -d
```

Las migraciones se ejecutan automáticamente al arrancar el contenedor `api` (entrypoint incluye `bun run src/db/migrate.ts`).

---

## 8. Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| API no arranca | DB no lista | `docker compose logs db`, esperar healthcheck |
| 401 al hacer login | JWT_SECRET cambiado | Reiniciar API tras cambio de variable |
| Worker no envía emails | SMTP caído | Verificar credenciales, revisar logs |
| Disco lleno | Backups no purgados | Liberar `/opt/consultorio-gaviotas/backups` |
| Lentitud en consultas | Índices faltantes | `EXPLAIN ANALYZE` en query lenta |

---

## 9. Checklist post-implantación

- [ ] Servidor accesible por HTTPS
- [ ] Healthcheck responde 200
- [ ] Login admin funciona
- [ ] Usuario médico creado y autenticado
- [ ] Usuario recepción creado y autenticado
- [ ] Cita de prueba agendada
- [ ] Consulta de prueba finalizada con factura
- [ ] Email de prueba recibido
- [ ] Cron backup activo (`crontab -l`)
- [ ] Logs centralizados visibles
- [ ] Documentación entregada al cliente