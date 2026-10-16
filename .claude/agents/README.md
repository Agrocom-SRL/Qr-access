# Agentes especializados de AGROCOM Acceso

Catorce subagentes en dos grupos según el tipo de trabajo, para no gastar un modelo grande en tareas mecánicas. El `model` se declara con el alias de la familia (`sonnet`, `haiku`): así el costo no depende del modelo con que esté abierta la sesión. Vienen de ACRECIA, adaptados al monorepo Node + Flutter + ESP32.

## Ejecución (modelo económico: `haiku`)

Trabajo que sigue un patrón ya definido en un ADR o una convención: no decide nada nuevo, lo aplica.

| Agente | Por qué es "ejecución" |
|---|---|
| `app-flutter` | Ensambla pantallas con el sistema de diseño que `design-ui` ya definió (ADR 0012) |
| `estandares-programacion` | Verifica estilo, convenciones y tests contra reglas fijas en `CLAUDE.md` |
| `distribucion` | Mantiene CI/CD, Docker y releases siguiendo `.github/workflows/` y los ADR 0010 y 0014 |
| `memoria-contexto` | Lee y actualiza `docs/gestion/estado_proyecto.md` |

## Juicio, diseño y coordinación (modelo mediano: `sonnet`)

| Agente | Por qué necesita más criterio |
|---|---|
| `arquitectura` | Decide dónde encaja el código nuevo y redacta ADRs: decisiones que cuesta revertir |
| `backend` | Implementa acciones, repositorios y endpoints: un error acá abre una puerta que no debía |
| `api-rest` | Cuida el contrato OpenAPI que comparten la app y el firmware: un cambio incompatible rompe clientes ya instalados |
| `firmware` | Código que acciona una cerradura física: un error es un riesgo de seguridad real |
| `design-ui` | Define el sistema de diseño (tokens, tema, componentes) que `app-flutter` después ejecuta |
| `modelo-datos` | Integridad del esquema MySQL: costosa de deshacer cuando ya hay datos reales |
| `modulos-roles` | Aislamiento entre cuentas, permisos y credenciales de dispositivo |
| `negocio` | Interpreta el documento funcional; distingue lo confirmado de lo preliminar |
| `orquestador` | Decide qué agentes intervienen y en qué orden en una tarea que cruza partes |
| `validador` | Revisa el trabajo de los demás contra `CLAUDE.md` y los ADRs antes de cerrar un cambio |

## Cuándo usar `orquestador` y cuándo ir directo al agente

- Tarea de una sola parte (p. ej. "agrega un índice a `eventos_acceso`"): directo al agente (`modelo-datos`).
- Tarea que cruza partes (p. ej. "abrir la puerta con QR", que toca `modelo-datos` + `backend` + `api-rest` + `app-flutter` + `firmware`): primero `orquestador`.
- Después de cualquier cambio no trivial, antes de darlo por cerrado: `validador`.
