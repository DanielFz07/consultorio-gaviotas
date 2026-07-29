# Estudio de Factibilidad — Consultorio Las Gaviotas

**Versión:** 1.0
**Estado:** Aprobado · Fase de Inicio (RUP)
**Producto:** Sistema de Información Automatizado para la Gestión de Registro y Orden de Pacientes en C.A Consultorio Médico Las Gaviotas, de Barcelona Estado Anzoátegui
**Metodología:** Proceso Unificado de Rational (RUP)

---

## 1. Propósito

Evaluar la **viabilidad** del proyecto antes de comprometer recursos de desarrollo. El estudio analiza tres dimensiones independientes:

- **Factibilidad Técnica** — ¿podemos construirlo con la tecnología disponible y el equipo actual?
- **Factibilidad Operativa** — ¿lo adoptará el personal del consultorio y resuelve el problema?
- **Factibilidad Económica** — ¿los beneficios superan los costos en un horizonte razonable?

Cada dimensión produce un veredicto (**VIABLE**, **VIABLE CON RIESGOS**, o **NO VIABLE**). El proyecto avanza solo si las tres son VIABLE o VIABLE CON RIESGOS.

---

## 2. Factibilidad Técnica

### 2.1 Stack propuesto

| Capa | Tecnología | Versión | Justificación |
|---|---|---|---|
| Frontend | Astro SSR + Tailwind v4 | Astro 5 | SSR nativo, render rápido, tipografía premium |
| Backend | Bun + Elysia + TypeScript + Zod | Bun 1.3 / Elysia 1 | Runtime rápido, validación nativa, ecosistema TypeScript moderno |
| Base de datos | PostgreSQL | 16 | Relacional estricto, transacciones ACID, ENUM para roles |
| Worker | Bun + cron + SMTP | — | Recordatorios 24h automáticos |
| Deploy | Docker Compose / Railway | — | Un solo orquestador, 3 procesos en un contenedor |
| Diagramas | PlantUML + Mermaid | — | Estándar UML 2.5 |

### 2.2 Requisitos de hardware del servidor

| Componente | Mínimo | Recomendado |
|---|---|---|
| CPU | 2 vCPU | 2 vCPU (suficiente para clínica pequeña) |
| RAM | 2 GB | 4 GB |
| Disco | 10 GB SSD | 20 GB SSD |
| Red | 100 Mbps | 1 Gbps |
| OS | Linux (Ubuntu 22.04+) | Linux (Debian 12+) |

### 2.3 Requisitos del cliente (browser)

| Navegador | Versión mínima |
|---|---|
| Chrome / Edge | 110+ |
| Firefox | 110+ |
| Safari | 16+ |

No requiere instalación local — el sistema corre como aplicación web. Esto elimina la barrera de adopción más común en clínicas pequeñas.

### 2.4 Compatibilidad con infraestructura existente

- **Base de datos:** migrable desde planillas Excel/CSV y desde sistemas anteriores que usen SQL estándar.
- **Red:** funciona en LAN local sin conexión a internet (excepto para envío de recordatorios SMTP).
- **Respaldos:** `pg_dump` es estándar de la industria, compatible con cualquier script de backup externo.
- **Impresora:** los PDFs se generan con `wkhtmltopdf` y son imprimibles estándar.

### 2.5 Evaluación técnica

| Criterio | Cumple | Notas |
|---|---|---|
| Tecnología madura y estable | ✓ | PostgreSQL 16, Astro 5, Elysia 1, Bun 1 — todos LTS en 2026 |
| Equipo con experiencia | ✓ | TypeScript end-to-end (frontend + backend + scripts) |
| Curva de aprendizaje razonable | ✓ | Stack coherente, sin microservicios innecesarios |
| Rendimiento adecuado | ✓ | Pool de conexiones (10), queries simples, índices en todas las FK |
| Disponibilidad de librerías | ✓ | Ecosistema Bun/npm, sin dependencias exóticas |
| Cumplimiento del stack tecnológico exigido (PostgreSQL) | ✓ | Motor relacional estricto |

**Veredicto: VIABLE** ✓

---

## 3. Factibilidad Operativa

### 3.1 Procesos manuales que el sistema reemplaza

Hoy el consultorio opera con:

- Libretas físicas para la agenda (riesgo de pérdida, sin validación de disponibilidad).
- Carpetas físicas para historias clínicas (sin respaldo digital, ocupa espacio).
- Conteo manual de inventario (errores de cálculo, faltantes no detectados a tiempo).
- Facturación manual al final del día (cálculos a mano, demoras en el cierre).
- Notas en papel durante la consulta (ilegibles, sin trazabilidad).

Cada uno de estos puntos genera costos operativos cuantificables (ver §4).

### 3.2 Perfiles de usuario y adopción

| Perfil | Nivel técnico | Adopción esperada | Soporte requerido |
|---|---|---|---|
| Recepción | Bajo-medio (uso de PC básico) | Alta — alivia carga administrativa | Capacitación 2 horas + manual |
| Médico | Medio (uso de PC, sistemas clínicos) | Alta — el sistema es su herramienta principal | Capacitación 1 hora |
| Administrador | Medio-alto | Alta — controla el sistema | Capacitación 4 horas |

### 3.3 Resistencia al cambio

**Riesgo identificado:** el personal acostumbrado a procesos en papel puede resistir el sistema digital.

**Mitigación aplicada:**
- Interfaz concierge médico premium (warm, clara, sin gamificación) — diseñada para personas no técnicas.
- Búsqueda de pacientes por nombre o cédula en menos de 1 segundo — más rápido que buscar en carpetas.
- Reportes automáticos que reemplazan las conciliaciones manuales — el sistema hace el trabajo tedioso.

### 3.4 Impacto en el flujo de trabajo

| Métrica | Antes | Después con sistema | Mejora |
|---|---|---|---|
| Tiempo promedio de agendamiento | 4 min | 30 s | -87% |
| Búsqueda de historia clínica | 5 min (carpeta física) | 1 s (búsqueda por cédula) | -99% |
| Conciliación de inventario | 30 min/día | 0 (automático) | -100% |
| Cierre de caja diario | 45 min | 5 min | -89% |
| Errores de cálculo en factura | ~5% de facturas | 0% (cálculo server-side) | -100% |

### 3.5 Evaluación operativa

| Criterio | Cumple | Notas |
|---|---|---|
| Resuelve el problema del consultorio | ✓ | Cada objetivo específico del Documento de Visión tiene su módulo |
| El personal lo adoptará | ✓ | Capacitación corta, interfaz intuitiva |
| Reduce tiempos de operación | ✓ | Métricas de §3.4 lo demuestran |
| Compatible con horario del consultorio | ✓ | El sistema corre 24/7, sin ventana de mantenimiento |
| No requiere cambios estructurales | ✓ | Solo PC o tablet existentes |

**Veredicto: VIABLE** ✓

---

## 4. Factibilidad Económica

### 4.1 Costos de desarrollo (inversión única)

| Concepto | Costo estimado (USD) |
|---|---|
| Desarrollo del software (equipo interno) | $0 (proyecto académico) |
| Diseño UX/UI concierge médico premium | $0 (proyecto académico) |
| Hardware de servidor (si no hay) | $200–500 (PC refurbished con Linux) |
| Certificados SSL (Let's Encrypt) | $0 (gratuito) |
| Dominio `.clinica.com` (opcional) | $10–15/año |
| **Total inversión** | **$210–515** |

### 4.2 Costos operativos recurrentes (mensuales)

| Concepto | Costo estimado (USD) |
|---|---|
| Hosting Railway / VPS | $5–20 |
| SMTP (recordatorios) | $0 (MailHog local) o $5 (SendGrid) |
| Mantenimiento técnico (4 horas/mes) | $0–50 |
| **Total mensual** | **$5–75** |

### 4.3 Beneficios cuantificables

Asumiendo una clínica pequeña típica (1 médico, 1 recepcionista, 8–15 consultas/día):

| Concepto | Cálculo | Ahorro mensual (USD) |
|---|---|---|
| Reducción tiempo administrativo | 2 h/día × $5/h × 22 días | $220 |
| Errores de facturación evitados | 5% × $3,000 facturación mensual | $150 |
| Mejor control de inventario | 10% menos compras innecesarias | $80 |
| Recordatorios automáticos (cero no-shows) | 2 pacientes/día × $30 consulta | $1,320 |
| Trazabilidad y respaldo digital (riesgo legal) | estimación cualitativa | — |
| **Total beneficio mensual estimado** | | **$1,770** |

### 4.4 Período de recuperación

```
Inversión inicial:    $515 (peor caso)
Beneficio mensual:   $1,770
Período recuperación: 515 / 1,770 = 0.29 meses ≈ 9 días
```

El sistema se paga solo en el primer mes.

### 4.5 Proyección a 12 meses

| Concepto | Valor |
|---|---|
| Inversión total año 1 | $515 + ($75 × 12) = $1,415 |
| Beneficio acumulado año 1 | $1,770 × 12 = $21,240 |
| **Retorno neto año 1** | **$19,825** |
| ROI | 1,401% |

### 4.6 Riesgos económicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Costos de infraestructura mayores a los estimados | Baja | Bajo | $20/mes cubre Railway free tier |
| Resistencia al cambio → baja adopción | Baja | Alto | Capacitación + interfaz intuitiva |
| Falla técnica → tiempo de inactividad | Baja | Medio | Backups diarios + logs de auditoría |
| Migración incompleta de planillas existentes | Media | Bajo | Procedimiento de migración documentado (`03-procedimiento-migracion.md`) |

### 4.7 Evaluación económica

| Criterio | Cumple | Notas |
|---|---|---|
| Costos de desarrollo accesibles | ✓ | Académico: $0 + $500 infraestructura |
| Costos operativos sostenibles | ✓ | $5–75/mes |
| Beneficios superan costos en < 12 meses | ✓ | Recuperación en < 1 mes |
| ROI positivo | ✓ | 1,401% año 1 |
| Riesgo financiero aceptable | ✓ | Inversión inicial baja |

**Veredicto: VIABLE** ✓

---

## 5. Análisis consolidado

| Dimensión | Veredicto | Riesgo principal |
|---|---|---|
| Técnica | VIABLE | Migración desde planillas a SQL requiere tiempo |
| Operativa | VIABLE | Resistencia al cambio del personal administrativo |
| Económica | VIABLE | — (ROI alto, riesgo bajo) |

### Decisión recomendada

**APROBAR el inicio del proyecto.** Las tres dimensiones son VIABLES. El proyecto pasa a Fase de Elaboración.

### Próximos pasos

1. **Fase de Elaboración:** detallar casos de uso, diagrama de clases, modelo ER, arquitectura.
2. **Fase de Construcción:** implementar iteraciones (iteración 1: pacientes/citas, iteración 2: consulta, iteración 3: inventario/facturación).
3. **Fase de Transición:** plan de pruebas, manuales, despliegue en Railway o servidor propio.

---

## 6. Firmas

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Patrocinador | Dra. Responsable del Consultorio | __________ | ___/___/2026 |
| Líder de proyecto | Equipo de desarrollo | __________ | ___/___/2026 |
| Administrador del sistema | Admin Consultorio | __________ | ___/___/2026 |