# 01 — `cuentas`

**Módulo dueño:** `seguridad` · **Tenant:** no (es el tenant) · **Migración:** `db/migrations/20261009100001_create_cuentas.sql`

## Propósito

La empresa cliente: el tenant. Cada cuenta tiene su propio administrador, usuarios, sitios, puertas y dispositivos.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `nombre` | `VARCHAR(150)` | no |  |
| `codigo` | `CHAR(3)` | no | Código de 3 letras |
| `estado` | `VARCHAR(20)` | no | `activo` (defecto), `restringido` o `suspendido` (ADR 0033 §1). Reemplaza a `activo`. «Eliminado» es `deleted_at`. Migración `20261026100001_alter_cuentas_estado.sql` |
| `estado_impuesto_por` | `BIGINT UNSIGNED` | sí | FK a `usuarios`: quién impuso el estado. NULL en `activo` y en lo migrado sin autor conocido |
| `estado_desde` | `DATETIME(3)` | sí | Desde cuándo rige el estado (UTC). NULL en `activo` |
| `estado_motivo` | `VARCHAR(200)` | sí | Motivo, obligatorio fuera de `activo` |
| `max_miembros_por_titular` | `SMALLINT UNSIGNED` | no | Tope de Miembros por Titular, por defecto 10 (migración `20261022100005_add_max_miembros_a_cuentas.sql`, ADR 0028 §6) |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` (skill `modelo-datos`) |

## Índices y restricciones

- `uq_cuentas_codigo`
- `ck_cuentas_codigo`
- `ck_cuentas_max_miembros` (`max_miembros_por_titular >= 1`)
- `ck_cuentas_estado` (valores) y `ck_cuentas_estado_datos` (`activo` sin impuesto_por/desde/motivo; los demás con `estado_desde` y motivo no vacío)
- `idx_cuentas_estado` (`estado`) y `fk_cuentas_estado_impuesto_por`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- `codigo` son 3 letras `A`–`Z` (CHECK sensible a mayúsculas), único entre las vigentes e inmutable: es el prefijo de todos los PIN de la cuenta (ADR 0018).
- `max_miembros_por_titular` lo hace cumplir la API al crear un Miembro (`plan.limite_miembros_por_titular`, 422); se cuenta contra los usuarios que cuelgan directo del Titular. Todavía no tiene pantalla de edición para el super admin.
- Estados (ADR 0033 §1, ADR 0031 §0): `activo` funciona todo; `restringido` no genera QR nuevos (`qr.generacion_restringida`) pero conserva sesiones y sus QR ya generados abren hasta vencer; `suspendido` no inicia sesión, no autentica dispositivos, cierra sesiones y anula los QR vigentes. La suspensión de la cuenta alcanza a todos sus usuarios **por derivación** (no se escribe en cada usuario): al validar se comprueba `cuentas.estado`. Reactivar no revive los QR anulados.
- Un estado impuesto no lo levanta quien está debajo del que lo impuso (`estado_impuesto_por`); AGROCOM lo levanta siempre. Al volver a `activo` se limpian `estado_impuesto_por`, `estado_desde` y `estado_motivo` (el historial queda en la bitácora).
- Migración de datos: `activo = 1` pasó a `activo`; `activo = 0` pasó a `suspendido` (es el efecto que ya tenía), con `estado_impuesto_por = updated_by`, `estado_desde = updated_at` y motivo `migracion: activo = 0`.
- La lee `seguridad` (login, `GET /sesiones/actual`) con `RepositorioDePlataforma`; el alta de cuentas es del super admin y aún no tiene endpoint.

## Dudas

- D-22 (cerrada) — `02-dudas-y-ambiguedades.md`
