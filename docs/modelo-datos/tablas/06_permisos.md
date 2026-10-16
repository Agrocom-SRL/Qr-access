# 06 — `permisos`

**Módulo dueño:** `seguridad` · **Tenant:** no (catálogo global) · **Migración:** `db/migrations/20261009100006_create_permisos.sql`

## Propósito

Catálogo de permisos por acción, `<modulo>.<entidad>.<accion>`, con su ámbito (`cuenta` o `plataforma`).

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `codigo` | `VARCHAR(100)` | no | Código de 3 letras |
| `ambito` | `VARCHAR(20)` | no | `cuenta` o `plataforma` |

## Índices y restricciones

- `uq_permisos_codigo`
- `ck_permisos_ambito`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- Se siembra con `db/seeds/01_catalogo.sql` (idempotente, también en producción); nunca a mano.
- Núcleo V1: `organizacion.puerta.ver`, `accesos.qr.{emitir,ver,ver_todos,anular,anular_todos}`, `accesos.evento.{ver,ver_todos}`.

## Dudas

- Ninguna abierta.
