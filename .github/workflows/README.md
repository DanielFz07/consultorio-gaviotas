# GitHub Actions CI

Este workflow verifica que el proyecto compile correctamente en cada push/PR.

## Jobs

- **backend**: instala Bun, ejecuta `bun install` y verifica type-checks
- **frontend**: instala Bun, ejecuta `bun install`, type-checks y build de Astro
- **docker**: valida que `docker-compose config` sea válido (no requiere Docker para correr, solo el CLI)
