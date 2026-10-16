# 22 — `asignaciones_puerta`

**Módulo dueño:** `organizacion` · **Tenant:** sí · **Migración:** `db/migrations/20261015100001_create_asignaciones_puerta.sql`

## Propósito

A qué puertas está asignado un usuario (en la práctica, un guardia): define de qué puertas ve los eventos y el estado.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `usuario_id` | `BIGINT UNSIGNED` | no | FK a `usuarios` |
| `puerta_id` | `BIGINT UNSIGNED` | sí | FK a `puertas`; `NULL` = todas las puertas de la cuenta |
| `puerta_clave` | `BIGINT UNSIGNED` | no | Generada: `IFNULL(puerta_id, 0)`, para que "todas" también sea única |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` (skill `modelo-datos`) |

## Índices y restricciones

- `uq_asignaciones_puerta` (`usuario_id`, `puerta_clave`, `vigente`)

## Reglas

- Un usuario sin filas vigentes no tiene puertas asignadas: con el permiso `accesos.evento.ver_asignadas` no ve eventos.
- Una fila con `puerta_id` NULL equivale a todas las puertas; las asigna un administrador (`organizacion.guardia.asignar`).
