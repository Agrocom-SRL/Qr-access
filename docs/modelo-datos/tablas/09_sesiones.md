# 09 — `sesiones`

**Módulo dueño:** `seguridad` · **Tenant:** sí · **Migración:** `db/migrations/20261009100009_create_sesiones.sql`

## Propósito

Una sesión de un usuario: su refresh token (hasheado), el rol activo y su vencimiento.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | sí | FK a `cuentas` |
| `usuario_id` | `BIGINT UNSIGNED` | no |  |
| `rol_activo_id` | `BIGINT UNSIGNED` | sí |  |
| `refresh_hash` | `CHAR(64)` | no | SHA-256 del refresh (sensible) |
| `agente` | `VARCHAR(255)` | sí |  |
| `ip` | `VARCHAR(45)` | sí |  |
| `expira_at` | `DATETIME(3)` | no |  |
| `revocada_at` | `DATETIME(3)` | sí |  |

## Índices y restricciones

- `uq_sesiones_refresh`
- `idx_sesiones_usuario`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- `refresh_hash` es el SHA-256 del refresh (256 bits de entropía); el token en claro solo existe en la respuesta del login o del refresco. Es único.
- El refresh se rota en sitio (`UPDATE … WHERE refresh_hash = <anterior>`): dos refrescos simultáneos con el mismo token, uno solo gana.
- Revocar (`revocada_at`) corta el refresh y el JWT de acceso, porque este se revalida contra la sesión en cada petición.
- Tabla transitoria: sin soft delete, autoría ni bitácora.

## Dudas

- Ninguna abierta.
