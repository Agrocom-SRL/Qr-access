# 15 — `qr_acceso_puertas`

**Módulo dueño:** `accesos` · **Tenant:** sí · **Migración:** `db/migrations/20261009100015_create_qr_acceso_puertas.sql`

## Propósito

Puertas para las que vale un QR (un QR puede valer para varias, D-17).

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `qr_acceso_id` | `BIGINT UNSIGNED` | no |  |
| `puerta_id` | `BIGINT UNSIGNED` | no |  |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` (skill `modelo-datos`) |

## Índices y restricciones

- `uq_qr_acceso_puertas`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- Par (QR, puerta) único entre los vigentes.
- La puerta del dispositivo tiene que estar en este conjunto, o el motivo es `qr.otra_puerta`.

## Dudas

- D-17 — `02-dudas-y-ambiguedades.md`
