# 02 — `roles`

**Módulo dueño:** `seguridad` · **Tenant:** sí (NULL = plataforma) · **Migración:** `db/migrations/20261009100002_create_roles.sql`

## Propósito

Conjunto de permisos que se asigna a un usuario. Cada cuenta tiene los suyos (Administrador, Usuario, Guardia).

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | sí | FK a `cuentas` |
| `nombre` | `VARCHAR(80)` | no |  |
| `protegido` | `TINYINT(1)` | no |  |
| `activo` | `TINYINT(1)` | no | Desactivar no es borrar |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` (skill `modelo-datos`) |

## Índices y restricciones

- `uq_roles_nombre`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- Nombre único por cuenta entre los vigentes (ADR 0016).
- `protegido = 1` no se edita ni se borra (Administrador).
- Un rol de cuenta nunca recibe un permiso de ámbito plataforma (ADR 0004 §5).

## Dudas

- D-19 — `02-dudas-y-ambiguedades.md`
