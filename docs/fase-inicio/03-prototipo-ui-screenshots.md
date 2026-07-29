# Prototipo UI — Capturas Reales de la Aplicación

**Fase:** Inicio (RUP)
**Tipo:** Prototipo UI (capturas reales del sistema funcionando)
**Stack visual:** Astro 5 SSR + Tailwind CSS 4 + Bricolage Grotesque + JetBrains Mono

Este documento complementa los [mockups ASCII de pantallas](./02-prototipo-ui-pantallas.md) con **capturas reales** de la aplicación Consultorio Las Gaviotas corriendo en `localhost:4321`, tomadas con Playwright (Chromium headless, 1440×900 @ 2x).

---

## 1. Pantalla de Login

Acceso al sistema con autenticación JWT.

![Login](../../.cache/screenshots/01-login.png)

*Figura 1. Pantalla de login — fondo con cards desenfocadas, formulario con username/password, botón con gradiente brand.*

---

## 2. Dashboard principal (Citas del día)

Vista resumida del día para el usuario autenticado: citas pendientes, consultas por atender, facturas, stock bajo.

![Dashboard](../../.cache/screenshots/02-dashboard.png)

*Figura 2. Dashboard — saludo personalizado "Buen día, Administrador", 4 cards con estadísticas, lista de citas del día, panel de stock crítico.*

---

## 3. Pacientes

Gestión CRUD de pacientes del consultorio. Búsqueda por V-/nombre/apellido.

![Pacientes](../../.cache/screenshots/03-pacientes.png)

*Figura 3. Pacientes — layout de 2 columnas: formulario de nuevo paciente a la izquierda, lista buscable a la derecha.*

---

## 4. Inventario

Catálogo de medicamentos y productos con control de stock.

![Inventario](../../.cache/screenshots/04-inventario.png)

*Figura 4. Inventario — tabs "Todos" / "Stock crítico", tabla con SKU, nombre, stock, mínimo, precio, unidad, acción.*

---

## 5. Servicios

Catálogo de servicios médicos que se asignan a las consultas.

![Servicios](../../.cache/screenshots/05-servicios.png)

*Figura 5. Servicios — tabla con código, nombre, descripción, precio, duración, estado, acción.*

---

## 6. Facturación

Emisión y cobro de facturas.

![Facturación](../../.cache/screenshots/06-facturacion.png)

*Figura 6. Facturación — tabla de facturas con número, fecha, paciente, total, estado, acción.*

---

## 7. Consultas (vista médico)

Citas pendientes de atención clínica.

![Consultas](../../.cache/screenshots/07-consultas.png)

*Figura 7. Consultas — solo visible para ADMIN/MEDICO. Lista de citas que aún no se han atendido.*

---

## 8. Gestión de usuarios (admin)

CRUD de cuentas con RBAC. Solo accesible para ADMIN.

![Usuarios](../../.cache/screenshots/08-usuarios.png)

*Figura 8. Usuarios — tabla con avatar (iniciales), username, email, rol (badge), estado (●), acción. Filtros por rol y estado. Matriz de permisos abajo.*

---

## Sistema de diseño aplicado

Todas las pantallas comparten:

- **Tipografía:** Bricolage Grotesque (sans, títulos) + Crimson (serif, body) en el design system original; en la implementación real: Noto Sans + Noto Serif (sustitutos libres).
- **Color:** verde clínico `#15803D` como acento, fondo `paper` `#FAFAF6`, línea `#E7E5E4`.
- **Espaciado:** grid de 4px, padding consistente, border-radius `rounded-xl` (12px) en cards.
- **Sombras:** sutiles (`shadow-sm shadow-brand-900/[0.02]`) para no romper el aspecto "ficha de papel".
- **Iconografía:** SVG inline de Lucide (calendar, users, package, etc.) en stroke 2.

## Comparación con los mockups originales

Los [mockups ASCII de pantallas](./02-prototipo-ui-pantallas.md) definen el contrato funcional. Las capturas reales de este documento demuestran que:

1. La jerarquía visual se preservó (sidebar > header > content).
2. Los flujos críticos son ejecutables (login → dashboard → módulo → acción).
3. La densidad de información es la adecuada para el contexto (recepción: alta; admin: máxima).
4. El sistema de tokens (colores, espaciados, radios) produce coherencia entre módulos.

Las divergencias entre el mockup y la implementación son menores: copy específico de cada clínica, copy de CTAs, y datos de seed realistas.

## Datos técnicos de las capturas

- **Resolución:** 1440×900 viewport, device pixel ratio 2x (Retina).
- **Browser:** Chromium 149.0.7827.55 (headless).
- **Storage state:** autenticado como `admin/admin123` (vía cookie HttpOnly seteada programáticamente).
- **DB:** seed básico (5 usuarios, pacientes, citas, productos, servicios, facturas).
- **Hora de captura:** 27/07/2026.

Para reproducir las capturas, ejecutá:

```bash
docker compose -f deploy/docker-compose.yml up -d
python3 scripts/capture_screenshots.py
```