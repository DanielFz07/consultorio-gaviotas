# Arquitectura, Componentes y Despliegue - Consultorio Las Gaviotas

**Fase:** Elaboración (diseño) → Transición (implantación)
**Notación:** PlantUML

---

## Diagrama de Componentes

```plantuml
@startuml
package "Cliente (navegador web)" {
  [Astro SSR\nPuerto 4321] as Astro
}

package "API Backend (Bun runtime)" {
  [Elysia REST API\nPuerto 3001] as Elysia
}

package "Worker (Bun standalone)" {
  [Cron Recordatorios] as Cron
  [SMTP Mailer] as Mailer
}

database "PostgreSQL 16\nPuerto 5432" as PG

folder "Volumen Docker" {
  ["./data/uploads\n(imágenes, PDFs)"] as Uploads
}

cloud "Internet" {
  [Proveedor SMTP\n(Gmail/Mailgun/etc)] as SMTP
}

Astro --> Elysia : fetch /api/* (proxy server-side)
Astro --> PG : server-only direct (seed admin)
Elysia --> PG : queries SQL (pg)
Elysia --> Uploads : write/read archivos
Cron --> PG : polling cada 5 min
Cron --> Mailer : enqueue
Mailer --> SMTP : SMTP over TLS
SMTP --> Cliente : email con resumen

@enduml
```

---

## Diagrama de Despliegue

```plantuml
@startuml
node "Servidor Linux (Ubuntu 22.04 LTS)" as Linux {
  node "Docker Engine" as Docker {
    [consultorio-frontend (Astro SSR) :4321] as C1
    [consultorio-api (Bun + Elysia) :3001] as C2
    [consultorio-worker (Bun cron SMTP)] as C3
    [consultorio-gaviotas-db (PostgreSQL 16) :5432] as C4
    [consultorio-gaviotas-mailhog (SMTP testing) :1025/:8025] as C5
  }
  database "uploads volume" as V1
  database "dbdata volume" as V2
}

node "Operador (navegador)" as Op
node "Correo destino" as Mail

Op --> C1 : HTTPS :4321
C1 --> C2 : HTTP :3001
C2 --> C4 : pg :5432
C2 --> V1 : mount
C4 --> V2 : mount
C3 --> C4 : queries
C3 --> C5 : SMTP :1025
C5 --> Op : UI mailhog :8025 (debug)
C5 --> Mail : relay a SMTP real

@enduml
```

---

## Mapa de Contenedores (docker-compose)

```yaml
# deploy/docker-compose.yml (resumen)
services:
  frontend:
    image: consultorio-frontend
    build: ../apps/frontend
    ports: ["4321:4321"]
    depends_on: [api]
    environment:
      - PUBLIC_API_URL=http://api:3001

  api:
    image: consultorio-api
    build: ../apps/backend
    ports: ["3001:3001"]
    depends_on: [db]
    environment:
      - DATABASE_URL=postgres://consultorio-gaviotas:***@db:5432/consultorio-gaviotas
      - JWT_SECRET=${JWT_SECRET}
      - UPLOAD_DIR=/data/uploads

  worker:
    image: consultorio-worker
    build: ../apps/worker
    depends_on: [db, mailhog]
    environment:
      - DATABASE_URL=postgres://consultorio-gaviotas:***@db:5432/consultorio-gaviotas
      - SMTP_HOST=mailhog
      - SMTP_PORT=1025

  db:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    volumes:
      - dbdata:/var/lib/postgresql/data
      - ./db/migrations:/docker-entrypoint-initdb.d
    environment:
      - POSTGRES_USER=consultorio-gaviotas
      - POSTGRES_PASSWORD=***
      - POSTGRES_DB=consultorio-gaviotas

  mailhog:
    image: mailhog/mailhog
    ports: ["1025:1025", "8025:8025"]

volumes:
  dbdata:
  uploads:
```

---

## Red y volúmenes

| Recurso | Tipo | Persistencia | Backup |
|---|---|---|---|
| `dbdata` | Volumen Docker | Sí (sobrevive reinicios) | Dump diario + rsync |
| `uploads` | Bind mount `./data/uploads` | Sí (carpeta host) | rsync diario |
| Red `consultorio-gaviotas-net` | Bridge interna | Servicio a servicio | N/A |

---

## Tamaño de contenedores (estimado)

| Contenedor | Imagen base | RAM estimada | CPU |
|---|---|---|---|
| frontend | node:22-alpine + Astro | 150 MB | 0.25 |
| api | oven/bun:alpine | 200 MB | 0.5 |
| worker | oven/bun:alpine | 100 MB | 0.2 |
| db | postgres:16-alpine | 256 MB | 0.5 |
| mailhog | mailhog/mailhog | 50 MB | 0.1 |

Total estimado: ~750 MB RAM, holgura amplia en servidor 4 GB.