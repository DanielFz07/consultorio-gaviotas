# Fase de Elaboración (RUP)

**Objetivo:** refinar los requisitos, modelar el dominio y diseñar la arquitectura.

## Artefactos

| # | Artefacto | Descripción |
|---|---|---|
| 01 | [Diagrama de Clases](./01-diagrama-clases.md) | Modelo UML de clases del dominio (Paciente, Cita, Consulta, etc.). |
| 02 | [Casos de Uso](./02-casos-uso.md) | Catálogo de CU-01 a CU-09 con tabla de actores y flujo principal. |
| 02b | [Casos de Uso Expandidos](./02b-casos-uso-expandidos.md) | Versión extendida con precondiciones, postcondiciones y excepciones. |
| 03 | [Diagrama ER](./03-er-diagrama.md) | Modelo entidad-relación en PlantUML. |
| 04 | [Flujo del Día Completo](./04-flujo-dia-completo.md) | Trazado de la jornada completa: recepción → consulta → facturación. |
| 05 | [Diagrama de Estados](./05-estados.md) | Máquina de estados de Cita, Consulta y Factura. |
| 06 | [Arquitectura y Despliegue](./06-arquitectura-despliegue.md) | Diagrama de contenedores Docker y servicios. |
| 07 | [Realización de Casos de Uso](./07-realizacion-casos-uso.md) | Diagramas de secuencia por CU principal. |
| 08 | [Prototipo Arquitectónico](./08-prototipo-arquitectonico.md) | Implementación ejecutable del flujo de consulta. |
| 09 | [Diagrama de Capas](./09-diagrama-capas.md) | Separación arquitectónica: Presentación · Lógica · Persistencia · Infraestructura. |