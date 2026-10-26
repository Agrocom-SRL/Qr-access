# 26 — `excepciones_de_limite`

**Módulo dueño:** `limites` · **Tenant:** sí · **Migración:** `db/migrations/20261027100002_create_excepciones_de_limite.sql`

## Propósito

Un tope de `configuracion_limites` distinto para una cuenta entera (`usuario_id` NULL) o para un solo usuario (ADR 0030 §7): lo que AGROCOM sube tras analizar un pico, o la bolsa que amplía a una cuenta (§5).

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `usuario_id` | `BIGINT UNSIGNED` | sí | FK a `usuarios`; `NULL` = de toda la cuenta |
| `clave` | `VARCHAR(60)` | no | Una de `configuracion_limites` que admita excepción |
| `valor` | `INT UNSIGNED` | no | Dentro de los extremos de la clave |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` |
| `usuario_clave`, `vigente` | generadas | | `IFNULL(usuario_id, 0)` y `1` si no está borrada: sostienen la unicidad con soft delete (ADR 0016) |

## Índices y restricciones

- `uq_excepciones_de_limite (tenant_id, usuario_clave, clave, vigente)`: una excepción vigente por cuenta, usuario y clave.

## Reglas

- La fija y la quita solo AGROCOM, dentro de la cuenta (`PUT` y `DELETE /api/v1/plataforma/cuentas/{cuenta_id}/excepciones-de-limite`); un usuario o una excepción de otra cuenta responde 404. Cada cambio queda en la bitácora.
- `qr.bolsa_mensual` solo admite excepción de cuenta; `qr.bolsa_aviso_porcentaje` ninguna.
