# 05 — `usuarios`

**Módulo dueño:** `seguridad` · **Tenant:** sí (NULL = plataforma) · **Migración:** `db/migrations/20261009100005_create_usuarios.sql`

## Propósito

Quien entra a la app. Un usuario de cuenta es un PIN con su etiqueta (ADR 0018); el super admin usa `username` y contraseña.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | sí | FK a `cuentas` |
| `etiqueta` | `VARCHAR(80)` | sí |  |
| `pin_indice` | `CHAR(64)` | sí | HMAC del PIN (sensible) |
| `pin_hash` | `VARCHAR(255)` | sí | argon2id de `<id de la cuenta>\|<sufijo>` (sensible, ADR 0023) |
| `pin_generado_at` | `DATETIME(3)` | sí |  |
| `username` | `VARCHAR(60)` | sí |  |
| `contrasena_hash` | `VARCHAR(255)` | sí | argon2id (solo plataforma, sensible) |
| `contrasena_temporal` | `TINYINT(1)` | no | 1 si la contraseña la fijó otro super admin y hay que cambiarla en el primer ingreso (migración `20261012100001_add_contrasena_temporal_a_usuarios.sql`) |
| `pin_compartido_at` | `DATETIME(3)` | sí | Última vez que se compartió el PIN por un canal de terceros (migración `20261022100006_add_pin_compartido_a_usuarios.sql`, ADR 0028 §7). Solo la fecha: el PIN nunca se guarda |
| `superior_id` | `BIGINT UNSIGNED` | sí | FK a `usuarios`: el nivel de arriba en el árbol (ADR 0028). NULL en el Administrador y en la plataforma (migración `20261022100002_alter_usuarios_superior.sql`) |
| `estado` | `VARCHAR(20)` | no | `activo` (defecto), `restringido` o `suspendido` (ADR 0033 §1). Reemplaza a `activo`. «Eliminado» es `deleted_at`. Migración `20261026100002_alter_usuarios_estado.sql` |
| `estado_impuesto_por` | `BIGINT UNSIGNED` | sí | FK a `usuarios`: quién impuso el estado. NULL en `activo` y en lo migrado sin autor conocido |
| `estado_desde` | `DATETIME(3)` | sí | Desde cuándo rige el estado (UTC). NULL en `activo` |
| `estado_motivo` | `VARCHAR(200)` | sí | Motivo, obligatorio fuera de `activo` |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` (skill `modelo-datos`) |

## Índices y restricciones

- `uq_usuarios_pin`
- `uq_usuarios_username`
- `ck_usuarios_credencial`
- `idx_usuarios_superior` (`superior_id`)
- `ck_usuarios_estado` (valores) y `ck_usuarios_estado_datos` (`activo` sin impuesto_por/desde/motivo; los demás con `estado_desde` y motivo presente y no vacío: un motivo NULL se rechaza)
- `idx_usuarios_tenant_estado` (`tenant_id`, `estado`) y `fk_usuarios_estado_impuesto_por`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- El PIN no se guarda: `pin_indice` = HMAC-SHA256(pimienta, `cuenta_id|sufijo`) para encontrarlo y `pin_hash` = argon2id para verificarlo. Ambos son sensibles y nunca van a la bitácora.
- `pin_indice` es único por cuenta entre los vigentes; el CHECK `ck_usuarios_credencial` exige PIN para un usuario de cuenta y usuario + contraseña para la plataforma.
- `superior_id` es el vínculo del árbol (Administrador → Titular/Guardia → Miembro); sobrevive a una reasignación hecha por AGROCOM, a diferencia de `created_by`. Cada visibilidad por rama se resuelve a partir de él (ADR 0028 §4).
- Compartir el PIN (`POST /usuarios/:id/pin/compartido`) solo mueve `pin_compartido_at`: la bitácora lo registra como `usuario.pin_compartido` con quién lo hizo y cuándo. No cambia el PIN ni obliga a cambiarlo en el primer ingreso (decisión del 2026-10-21).
- Un usuario tiene un solo rol (`usuario_roles`, ADR 0028 §2): ya no hay rol preferido.
- `restringido` (nivel leve): conserva la sesión y consulta, no genera QR nuevos; sus QR ya generados siguen vivos hasta vencer. `suspendido` (nivel crítico): pierde el acceso de inmediato (el JWT se revalida en cada petición), se cierran sus sesiones y se anulan sus QR vigentes (RF-06, ADR 0031 §1).
- **La cascada por rama se deriva, no se escribe**: suspender a un superior arrastra a los de abajo porque al validar y al autenticar se recorre `superior_id` hacia arriba (y `cuentas.estado`); las filas de los descendientes no cambian, así reactivar al superior no pisa un estado propio de un descendiente. Lo que sí se hace en la misma transacción es cerrar las sesiones y anular los QR vigentes de toda la rama.
- Un estado impuesto por un superior no lo levanta quien está debajo: `estado_impuesto_por` guarda quién lo impuso (su rol sale de `usuario_roles`); NULL (lo migrado sin autor) solo lo levanta AGROCOM. Al volver a `activo` se limpian los tres campos `estado_*`; el historial queda en la bitácora.
- Migración de datos: `activo = 1` pasó a `activo`; `activo = 0` pasó a `suspendido` (es el efecto que ya tenía), con `estado_impuesto_por = updated_by`, `estado_desde = updated_at` y motivo `migracion: activo = 0`.

## Dudas

- D-24 — `02-dudas-y-ambiguedades.md`
- D-19 — `02-dudas-y-ambiguedades.md`
- D-25 — `02-dudas-y-ambiguedades.md`
