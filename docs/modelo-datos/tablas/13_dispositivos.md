# 13 — `dispositivos`

**Módulo dueño:** `dispositivos` · **Tenant:** sí · **Migración:** `db/migrations/20261009100013_create_dispositivos.sql`

## Propósito

Controlador ESP32 de una puerta, con su propia credencial (invariante 5).

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `puerta_id` | `BIGINT UNSIGNED` | no |  |
| `nombre` | `VARCHAR(100)` | no |  |
| `clave_hash` | `VARCHAR(255)` | no | argon2id de la clave del dispositivo (sensible) |
| `firmware_version` | `VARCHAR(20)` | sí |  |
| `ultimo_latido_at` | `DATETIME(3)` | sí |  |
| `ultimo_rssi` | `SMALLINT` | sí |  |
| `ultima_puerta_abierta` | `TINYINT(1)` | sí |  |
| `revocado_at` | `DATETIME(3)` | sí |  |
| `activo` | `TINYINT(1)` | no | Desactivar no es borrar |
| `en_servicio` | `TINYINT` | sí | Generada: 1 si no está revocado ni borrado |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` (skill `modelo-datos`) |

## Índices y restricciones

- `uq_dispositivos_puerta`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- Credencial `Dispositivo <id>.<clave>`; `clave_hash` es argon2id y nunca va a la bitácora. La clave en claro se muestra una sola vez.
- `en_servicio` (columna generada) garantiza un solo dispositivo sin revocar ni borrar por puerta.
- Revocado (`revocado_at`), inactivo o borrado: la API responde 401 y el firmware no abre.
- El latido actualiza `firmware_version`, `ultimo_latido_at`, `ultimo_rssi` y `ultima_puerta_abierta` sin pasar por la bitácora (telemetría).

## Dudas

- D-02 (cerrada) — `02-dudas-y-ambiguedades.md`
