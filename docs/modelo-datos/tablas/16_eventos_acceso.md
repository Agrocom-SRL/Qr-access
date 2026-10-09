# 16 — `eventos_acceso`

**Módulo dueño:** `accesos` · **Tenant:** sí · **Migración:** `db/migrations/20261009100016_create_eventos_acceso.sql`

## Propósito

Todo intento de apertura, permitido o rechazado, con su motivo (invariante 4, ADR 0007).

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `puerta_id` | `BIGINT UNSIGNED` | no |  |
| `dispositivo_id` | `BIGINT UNSIGNED` | sí |  |
| `qr_acceso_id` | `BIGINT UNSIGNED` | sí |  |
| `token_hash` | `CHAR(64)` | sí | SHA-256 del token del QR (sensible) |
| `metodo` | `VARCHAR(20)` | no | `qr`, `pulsador`, `forzada` |
| `resultado` | `VARCHAR(10)` | no | `permitido` o `rechazado` |
| `motivo_code` | `VARCHAR(60)` | no | Código estable, p. ej. `qr.vencido` |
| `ocurrido_at` | `DATETIME(3)` | no |  |
| `leido_en_dispositivo_at` | `DATETIME(3)` | sí |  |

## Índices y restricciones

- `idx_eventos_acceso_puerta`
- `idx_eventos_acceso_fecha`
- `idx_eventos_acceso_qr`
- `ck_eventos_acceso_metodo`
- `ck_eventos_acceso_resultado`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- Solo inserción: sin `updated_*` ni `deleted_*`; la API nunca actualiza ni borra una fila. En producción, el usuario de base no tiene `UPDATE` ni `DELETE`.
- Un token desconocido o ilegible se guarda como `token_hash`, nunca como texto.
- `ocurrido_at` es la hora del servidor; `leido_en_dispositivo_at` es la del reloj del dispositivo, solo informativa.
- La apertura por pulsador de salida y la puerta forzada (`metodo`) quedan para el firmware.

## Dudas

- D-06 — `02-dudas-y-ambiguedades.md`
