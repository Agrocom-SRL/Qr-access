# 07 — `rol_permisos`

**Módulo dueño:** `seguridad` · **Tenant:** no (pivote) · **Migración:** `db/migrations/20261009100007_create_rol_permisos.sql`

## Propósito

Qué permisos tiene cada rol.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `rol_id` | `BIGINT UNSIGNED` | no |  |
| `permiso_id` | `BIGINT UNSIGNED` | no |  |

## Índices y restricciones



El SQL completo está en `03-schema-sql.md`.

## Reglas

- Los permisos efectivos de una sesión son los del rol activo, nunca la unión de los roles del usuario (invariante 10).

## Dudas

- Ninguna abierta.
