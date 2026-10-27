# 35 — `anulaciones_masivas`

**Módulo dueño:** `accesos` · **Tenant:** sí · **Migración:** `db/migrations/20261101100003_create_anulaciones_masivas.sql`

## Propósito

El pedido de anular en bloque los QR vigentes de un usuario, de una rama o de toda la cuenta (ADR 0031 §3, ADR 0033 §3): una fila por pedido, con el alcance, el **motivo** y cuántos QR se anularon. Cada QR anulado deja además su propia fila de bitácora (`qr_accesos.anulado_at` y `anulado_por`); esta tabla es la que lleva el motivo del lote. Se escribe con el repositorio de dominio, así que su creación también entra a la bitácora (invariante 9), en la misma transacción que las anulaciones.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `alcance` | `VARCHAR(10)` | no | `usuario`, `rama` o `cuenta` |
| `usuario_objetivo_id` | `BIGINT UNSIGNED` | sí | FK a `usuarios`: el usuario o la raíz de la rama; `NULL` solo con `alcance = cuenta` (`ck_anulaciones_masivas_objetivo`) |
| `motivo` | `VARCHAR(200)` | no | Por qué (no vacío) |
| `usuarios_alcanzados` | `INT UNSIGNED` | no | Cuántos usuarios cubrió el pedido |
| `qr_anulados` | `INT UNSIGNED` | no | Cuántos QR vigentes se anularon (puede ser 0) |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` |

## Reglas

- `POST /api/v1/qr-accesos/anulacion-masiva` (`accesos.qr.anular_masivo`). El alcance sale del árbol del ADR 0028: Administrador, cualquier usuario o rama de la cuenta y la cuenta entera; Titular, sus Miembros y lo suyo; Miembro y Guardia, solo lo propio. Fuera del alcance (o de otra cuenta) el usuario no existe: 404.
- Solo se anulan los QR **vigentes** (no usados, no anulados, no vencidos). Los anulados no reviven. La validación del QR ya los rechaza con `qr.anulado`.
