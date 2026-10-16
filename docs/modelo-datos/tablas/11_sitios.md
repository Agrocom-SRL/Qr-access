# 11 — `sitios`

**Módulo dueño:** `organizacion` · **Tenant:** sí · **Migración:** `db/migrations/20261009100011_create_sitios.sql`

## Propósito

Lugar físico de una cuenta; fija la zona horaria con la que se evalúa el fin del día (RF-05).

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `nombre` | `VARCHAR(120)` | no |  |
| `direccion` | `VARCHAR(255)` | sí |  |
| `zona_horaria` | `VARCHAR(64)` | no |  |
| `activo` | `TINYINT(1)` | no | Desactivar no es borrar |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` (skill `modelo-datos`) |

## Índices y restricciones

- `uq_sitios_nombre`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- `zona_horaria` es una zona IANA, por defecto `America/La_Paz`.
- Nombre único por cuenta entre los vigentes.

## Dudas

- D-12 — `02-dudas-y-ambiguedades.md`
