# 04 — `suscripciones`

**Módulo dueño:** `suscripciones` · **Tenant:** sí · **Migración:** `db/migrations/20261009100004_create_suscripciones.sql`

## Propósito

Plan contratado por una cuenta y el período en que vale (ADR 0017).

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `plan_id` | `BIGINT UNSIGNED` | no |  |
| `desde` | `DATETIME(3)` | no |  |
| `hasta` | `DATETIME(3)` | no |  |
| `estado` | `VARCHAR(20)` | no | `vigente`, `suspendida`, `vencida` |
| `estado_vigente` | `TINYINT` | sí | Generada: 1 si la suscripción está vigente y no borrada |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` (skill `modelo-datos`) |

## Índices y restricciones

- `uq_suscripciones_vigente`
- `ck_suscripciones_estado`
- `ck_suscripciones_ventana`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- Una sola suscripción `vigente` por cuenta (columna generada `estado_vigente`).
- Está vigente si `estado = vigente` y `desde <= ahora < hasta`. Con ella vencida o ausente, la cuenta no emite QR (`suscripcion.vencida`) y sus puertas rechazan (RF-06).
- La consulta la expone `suscripciones/contracts.ts`; en V1 la registra AGROCOM a mano.

## Dudas

- D-14 — `02-dudas-y-ambiguedades.md`
- D-15 — `02-dudas-y-ambiguedades.md`
