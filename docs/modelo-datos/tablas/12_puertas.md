# 12 — `puertas`

**Módulo dueño:** `organizacion` · **Tenant:** sí · **Migraciones:** `db/migrations/20261009100012_create_puertas.sql` y (ADR 0035) `add_apertura_manual_a_puertas`

## Propósito

Puerta con cerradura de pulso de un sitio.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `sitio_id` | `BIGINT UNSIGNED` | no |  |
| `nombre` | `VARCHAR(120)` | no |  |
| `segundos_apertura` | `TINYINT UNSIGNED` | no |  |
| `activo` | `TINYINT(1)` | no | Desactivar no es borrar |
| `apertura_manual_habilitada` | `TINYINT(1)` | no | **Configuración** (ADR 0035): 1 = los usuarios de la cuenta pueden abrir esta puerta desde la app sin QR. Por omisión 0. Solo la cambia el administrador de la cuenta (`accesos.apertura_manual.configurar`); pasa por la bitácora |
| `apertura_manual_at` | `DATETIME(3)` | sí | Cuándo se habilitó por última vez; NULL mientras esté deshabilitada |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` (skill `modelo-datos`) |

## Índices y restricciones

- `uq_puertas_nombre`
- `ck_puertas_segundos`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- `segundos_apertura` (1 a 30) es la duración del pulso y se entrega al dispositivo en la validación y en `GET /dispositivos/configuracion`.
- Nombre único dentro del sitio entre las vigentes.

## Dudas

- D-04 (cerrada) — `02-dudas-y-ambiguedades.md`
