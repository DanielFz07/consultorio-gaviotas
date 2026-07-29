# Plan de Pruebas - Consultorio Las Gaviotas

**Fase:** Transición (RUP)
**Tipo:** Especificaciones Técnicas - Plan de Pruebas
**Versión:** 1.0
**Stack objetivo:** Bun + Elysia + PostgreSQL 16 + Astro 5

---

## 1. Estrategia de pruebas

Consultorio Las Gaviotas adopta una estrategia de pruebas en **cuatro niveles**, de abajo hacia arriba:

| Nivel | Tipo | Herramienta | Responsable |
|---|---|---|---|
| 1 | Unitarias | `bun test` | Desarrollador |
| 2 | Integración (API + DB) | `curl` + scripts bash + seeds | Desarrollador |
| 3 | Sistema (flujo end-to-end) | Navegador + Docker Compose | Tester / Profesor |
| 4 | Aceptación (casos de uso) | Manual sobre UI | Usuario final (admin) |

Las pruebas se ejecutan contra el ambiente de **docker-compose** del repo, con la base de datos poblada por seeds. La regla: ningún caso crítico queda sin automatizar al menos en nivel 2.

---

## 2. Catálogo de pruebas

Cada prueba tiene un código único `PT-XX-NN` y se mapea a uno o más requisitos del catálogo (`docs/dsi/02-requisitos-operacion.md`) o casos de uso (`docs/fase-elaboracion/02-casos-uso.md`).

### 2.1 Pruebas funcionales

#### Autenticación y sesión

| ID | Caso | Precondiciones | Pasos | Resultado esperado | Cubre |
|---|---|---|---|---|---|
| PT-01-01 | Login válido | Usuario `admin` existe y activo | POST `/api/auth/login` con credenciales correctas | 200 + JWT con rol=ADMIN + cookie HttpOnly | CU-01 |
| PT-01-02 | Login password incorrecto | Usuario `admin` existe | POST con password=`wrong` | 401 EX-005 "Credenciales inválidas" | EX-001 |
| PT-01-03 | Login usuario inactivo | Usuario `consultorio` con `activo=false` | POST con credenciales | 401 EX-005 (mensaje genérico, no expone si existe) | RN-09 |
| PT-01-04 | Acceso sin token | Token ausente | GET `/api/pacientes` sin Authorization | 401 EX-002 | EX-002 |
| PT-01-05 | Token expirado | Token con `exp` en el pasado | GET con token expirado | 401 EX-030 | RN-08 |
| PT-01-06 | Rol sin permisos | Usuario `consultorio` (no ADMIN) | GET `/api/usuarios` con token de consultorio | 403 EX-003 | EX-003 |

#### Pacientes

| ID | Caso | Pasos | Esperado | Cubre |
|---|---|---|---|---|
| PT-02-01 | Crear paciente con V- duplicado | POST `/api/pacientes` con V- existente | 409 EX-007 "Ya existe un paciente con ese V-" | RN-01 |
| PT-02-02 | Crear paciente con datos inválidos | POST `/api/pacientes` con datos faltantes | 400 EX-004 datos inválidos | RN-02 |
| PT-02-03 | Búsqueda case-insensitive | GET `/api/pacientes?q=juan` con pacientes "Juan", "JUANA" | Devuelve ambos | UX |

#### Citas

| ID | Caso | Pasos | Esperado | Cubre |
|---|---|---|---|---|
| PT-03-01 | Agendar cita en horario ocupado | POST cita con `medicoId`+`horaInicio` ya ocupado | 409 EX-014 "Ya hay cita en ese horario" | RN-04 |
| PT-03-02 | Cancelar cita atendida | PATCH estado=CANCELADA sobre cita ATENDIDA | 409 EX-016 "Transición inválida" | RN-04 |
| PT-03-03 | Marcar NO_ASISTIO por worker | Worker tick con cita pasada sin atender | UPDATE automático a NO_ASISTIO + log | RN-13 |

#### Consulta médica (caso crítico)

| ID | Caso | Pasos | Esperado | Cubre |
|---|---|---|---|---|
| PT-04-01 | Consulta sin cita | POST `/api/citas/:id/consulta-activa` cuando cita no existe | 404 EX-019 | RN-05 |
| PT-04-02 | Consulta con prescripción y stock suficiente | POST consulta con prescripción de producto con stock>=cantidad | 201 + stock decrementado en transacción atómica | RN-03 |
| PT-04-03 | **Consulta con stock insuficiente** | POST consulta con prescripción donde stock<cantidad | 400 EX-018 "Stock insuficiente: X" (no descuenta nada) | RN-03 |
| PT-04-04 | **Atomicidad: falla DB a mitad de transacción** | Simular error en INSERT factura con transacción ya abierta | ROLLBACK: ni consulta, ni prescripción, ni factura, ni stock | RN-03 |
| PT-04-05 | Consulta con servicios múltiples | POST consulta con 2 servicios | Items insertados en `consulta_servicio`, total sumado correctamente | RN-06 |
| PT-04-06 | Adjuntar archivo a consulta | POST con `multipart/form-data` PDF | Archivo en `/data/uploads`, registro en `consulta_archivo` | RN-11 |

#### Inventario

| ID | Caso | Pasos | Esperado | Cubre |
|---|---|---|---|---|
| PT-05-01 | Reponer stock | PATCH `/api/productos/:id/reponer` con cantidad | 200 + stock_actual += cantidad | RN-12 |
| PT-05-02 | Reponer con cantidad 0 o negativa | PATCH con cantidad<=0 | 400 EX-006 "Cantidad debe ser > 0" | RN-12 |
| PT-05-03 | Alerta stock crítico | GET `/api/productos?bajoStock=true` con productos bajo mínimo | Solo devuelve los críticos | UX admin |

#### Facturación

| ID | Caso | Pasos | Esperado | Cubre |
|---|---|---|---|---|
| PT-06-01 | Cobrar factura PENDIENTE | PATCH estado=PAGADA con método pago | 200 + estado PAGADA | RN-07 |
| PT-06-02 | Anular factura PAGADA por admin | DELETE sobre factura PAGADA (usuario admin) | 200 + estado ANULADA + log auditoría | RN-07 |
| PT-06-03 | Anular factura PAGADA por recepción | DELETE con usuario RECEPCION | 403 EX-003 (solo admin anula) | EX-003 |
| PT-06-04 | Número correlativo único | Crear 10 facturas en transacción | Números 1..10 sin huecos | RN-06 |
| PT-06-05 | Recalcular total al cambiar items | PATCH consulta agregando servicio | Factura regenerada con nuevo total | RN-06 |

### 2.2 Pruebas no funcionales

| ID | Categoría | Criterio | Medición | Cubre |
|---|---|---|---|---|
| PT-NF-01 | Rendimiento | Listar 1000 pacientes en <500ms | `curl -w "%{time_total}"` sobre `/api/pacientes` con seed masivo | RN-15 |
| PT-NF-02 | Concurrencia | 10 médicos creando consulta simultánea sobre misma cita | Solo 1 consulta activa; resto recibe 409 | RN-04 |
| PT-NF-03 | Seguridad | SQL injection en campo `username` | `' OR 1=1 --` → 401 (no bypasea auth) | RN-09 |
| PT-NF-04 | Hash | Contraseña en DB nunca en texto plano | Inspeccionar `consultorio.usuario.password_hash`: empieza con `$2` (bcrypt) | RN-09 |
| PT-NF-05 | HTTP only cookie | `consultorio-gaviotas_token` no accesible desde JS | DevTools muestra HttpOnly=true | RN-09 |
| PT-NF-06 | Backup | Dump de DB se puede restaurar | `pg_dump` + `psql <dump.sql` restaura estado | RN-14 |
| PT-NF-07 | Disponibilidad | API responde 200 en `/api/health` | `curl /api/health` tras restart | RN-14 |

---

## 3. Procedimiento de ejecución

### 3.1 Ambiente de pruebas

```bash
# 1. Levantar stack limpio
docker compose -f deploy/docker-compose.yml down -v
docker compose -f deploy/docker-compose.yml up -d

# 2. Esperar que migraciones + seeds terminen (~10s)
sleep 10

# 3. Verificar health
curl -sf http://localhost:3001/api/health | jq
# → {"ok":true,"db":true,"timestamp":"..."}

# 4. Login admin
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | jq -r .token)
```

### 3.2 Ejecutar bateria de pruebas críticas

```bash
# PT-04-02: prescripción con stock suficiente
curl -X POST http://localhost:3001/api/citas/1/consulta \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "sintomas":"letargo",
    "diagnostico":"infección leve",
    "prescripciones":[{"productoId":1,"cantidad":2,"dosis":"1 comp/día"}],
    "servicios":[{"servicioId":1,"cantidad":1}]
  }' | jq
```

Cada caso del catálogo tiene un script `curl` reproducible en `docs/fase-transicion/06-pruebas-casos.sh` (ver anexo).

### 3.3 Criterios de aceptación

| Criterio | Umbral |
|---|---|
| Pruebas funcionales pasadas | 100% de PT-01 a PT-06 |
| Pruebas no funcionales | PT-NF-01..07 todas verdes |
| Defectos abiertos críticos | 0 |
| Defectos abiertos mayores | ≤ 2 |
| Cobertura de CU | ≥ 90% de casos de uso cubiertos |

---

## 4. Herramientas

| Herramienta | Uso |
|---|---|
| `bun test` | Unitarias (futuro, no usadas actualmente) |
| `curl` + `jq` | Pruebas de integración API |
| `docker compose` | Ambiente reproducible |
| `psql` | Verificación de datos en DB |
| Mailhog (puerto 8025) | Verificar emails del worker |

---

## 5. Anexo: Tantecedente relevantebilidad requisitos → pruebas

| Requisito (RN-*) | Pruebas que lo cubren |
|---|---|
| RN-01 (V- único) | PT-02-01 |
| RN-02 (datos requeridos del paciente) | PT-02-02 |
| RN-03 (atomicidad stock) | PT-04-02, PT-04-03, PT-04-04 |
| RN-04 (citas sin conflicto) | PT-03-01, PT-03-02, PT-NF-02 |
| RN-05 (consulta requiere cita) | PT-04-01 |
| RN-06 (factura correlativa) | PT-04-05, PT-06-04, PT-06-05 |
| RN-07 (anular requiere admin) | PT-06-02, PT-06-03 |
| RN-08 (token 8h) | PT-01-05 |
| RN-09 (auth + hash) | PT-01-03, PT-NF-03, PT-NF-04 |
| RN-11 (adjuntos) | PT-04-06 |
| RN-12 (reposición stock) | PT-05-01, PT-05-02 |
| RN-13 (NO_ASISTIO) | PT-03-03 |
| RN-14 (backup + health) | PT-NF-06, PT-NF-07 |
| RN-15 (perf 1000 pacientes) | PT-NF-01 |