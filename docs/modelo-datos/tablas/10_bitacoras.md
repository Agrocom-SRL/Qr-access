# 10 — `bitacoras`

**Módulo dueño:** `plataforma` · **Tenant:** sí (NULL = plataforma) · **Migración:** `db/migrations/20261009100010_create_bitacoras.sql`

## Propósito

Registro de cambios (ADR 0007): quién, cuándo, qué tabla y registro, qué acción, valores antes y después y origen.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | sí | FK a `cuentas` |
| `usuario_id` | `BIGINT UNSIGNED` | sí |  |
| `dispositivo_id` | `BIGINT UNSIGNED` | sí |  |
| `tabla` | `VARCHAR(64)` | no |  |
| `registro_id` | `BIGINT UNSIGNED` | no |  |
| `accion` | `VARCHAR(12)` | no | `creado`, `actualizado`, `eliminado`, `restaurado` |
| `origen` | `VARCHAR(12)` | no | `api`, `dispositivo`, `sistema` |
| `antes` | `JSON` | sí |  |
| `despues` | `JSON` | sí |  |
| `ocurrido_at` | `DATETIME(3)` | no |  |

## Índices y restricciones

- `idx_bitacoras_registro`
- `idx_bitacoras_tenant`
- `ck_bitacoras_accion`
- `ck_bitacoras_origen`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- Solo inserción. La escribe `RepositorioBase` en la misma transacción que el cambio; ninguna acción la invoca.
- Los valores no incluyen columnas sensibles (hashes).
- En producción, el usuario de base de la API no tiene `UPDATE` ni `DELETE` sobre ella.

## Dudas

- D-06 — `02-dudas-y-ambiguedades.md`
