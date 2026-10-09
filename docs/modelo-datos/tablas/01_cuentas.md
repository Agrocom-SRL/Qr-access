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
| `activo` | `TINYINT(1)` | no | Desactivar no es borrar |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` (skill `modelo-datos`) |

## Índices y restricciones

- `uq_cuentas_codigo`
- `ck_cuentas_codigo`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- `codigo` son 3 letras `A`–`Z` (CHECK sensible a mayúsculas), único entre las vigentes e inmutable: es el prefijo de todos los PIN de la cuenta (ADR 0018).
- Una cuenta con `activo = 0` no inicia sesión ni autentica sus dispositivos.
- La lee `seguridad` (login, `GET /sesiones/actual`) con `RepositorioDePlataforma`; el alta de cuentas es del super admin y aún no tiene endpoint.

## Dudas

- D-22 (cerrada) — `02-dudas-y-ambiguedades.md`
