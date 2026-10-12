# 08 — `usuario_roles`

**Módulo dueño:** `seguridad` · **Tenant:** sí (NULL = plataforma) · **Migración:** `db/migrations/20261009100008_create_usuario_roles.sql`

## Propósito

Qué roles tiene cada usuario. Lleva `tenant_id` para aislar por cuenta.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | sí | FK a `cuentas`; NULL = rol de plataforma de un super admin (migración `20261012100002_permite_usuario_roles_de_plataforma.sql`) |
| `usuario_id` | `BIGINT UNSIGNED` | no |  |
| `rol_id` | `BIGINT UNSIGNED` | no |  |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` (skill `modelo-datos`) |

## Índices y restricciones

- `uq_usuario_roles`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- Par (usuario, rol) único entre los vigentes.

## Dudas

- Ninguna abierta.
