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
| `pin_hash` | `VARCHAR(255)` | sí | argon2id del PIN (sensible) |
| `pin_generado_at` | `DATETIME(3)` | sí |  |
| `username` | `VARCHAR(60)` | sí |  |
| `contrasena_hash` | `VARCHAR(255)` | sí | argon2id (solo plataforma, sensible) |
| `rol_preferido_id` | `BIGINT UNSIGNED` | sí |  |
| `activo` | `TINYINT(1)` | no | Desactivar no es borrar |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` (skill `modelo-datos`) |

## Índices y restricciones

- `uq_usuarios_pin`
- `uq_usuarios_username`
- `ck_usuarios_credencial`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- El PIN no se guarda: `pin_indice` = HMAC-SHA256(pimienta, `cuenta_id|sufijo`) para encontrarlo y `pin_hash` = argon2id para verificarlo. Ambos son sensibles y nunca van a la bitácora.
- `pin_indice` es único por cuenta entre los vigentes; el CHECK `ck_usuarios_credencial` exige PIN para un usuario de cuenta y usuario + contraseña para la plataforma.
- `rol_preferido_id` recuerda el último rol elegido: con varios roles, la próxima sesión arranca con él (HU-05).
- Un usuario con `activo = 0` pierde el acceso de inmediato (el JWT se revalida en cada petición) y sus QR dejan de abrir (RF-06).

## Dudas

- D-24 — `02-dudas-y-ambiguedades.md`
- D-19 — `02-dudas-y-ambiguedades.md`
