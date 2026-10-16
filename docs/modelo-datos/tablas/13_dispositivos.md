# 13 — `dispositivos`

**Módulo dueño:** `dispositivos` · **Tenant:** sí · **Migraciones:** `db/migrations/20261009100013_create_dispositivos.sql` y `20261013100002_add_placa_id_a_dispositivos.sql`

## Propósito

Asignación de una placa (ESP32) a una puerta, con su propia credencial (invariante 5). Reasignar una placa crea otro dispositivo (ADR 0025).

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `puerta_id` | `BIGINT UNSIGNED` | no |  |
| `placa_id` | `BIGINT UNSIGNED` | sí | FK a `placas`; nulo solo en los dispositivos de desarrollo anteriores al ADR 0025 |
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
- `uq_dispositivos_placa`: una placa tiene un solo dispositivo en servicio

El SQL completo está en `03-schema-sql.md`.

## Reglas

- Credencial `Dispositivo <id>.<clave>`; `clave_hash` es argon2id y nunca va a la bitácora. La clave en claro se muestra una sola vez.
- `en_servicio` (columna generada) garantiza un solo dispositivo sin revocar ni borrar por puerta.
- `clave_hash` se copia de `placas.clave_hash` al vincular: la clave la genera la placa y el servidor nunca la guarda en claro.
- Revocado (`revocado_at`), inactivo o borrado: la API responde 401 y el firmware no abre.
- El latido actualiza `firmware_version`, `ultimo_latido_at`, `ultimo_rssi` y `ultima_puerta_abierta` sin pasar por la bitácora (telemetría).

## Dudas

- D-02 (cerrada) — `02-dudas-y-ambiguedades.md`
