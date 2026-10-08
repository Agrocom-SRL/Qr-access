# NN — `<tabla>`

**Módulo dueño:** `<modulo>` · **Tenant:** sí / no / NULL = plataforma · **Migración:** `db/migrations/<archivo>.sql`

## Propósito

Qué representa y por qué existe (una o dos frases).

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | | FK a `cuentas` |
| … | | | |
| autoría y soft delete | | | ver skill `modelo-datos` |

## Índices y restricciones

- `uq_<tabla>_<columnas>` — qué garantiza.
- `ck_<tabla>_<regla>` — qué garantiza.

## Reglas

- Qué RF del documento funcional protege.
- Quién la escribe (acción) y quién la lee (contrato).

## Dudas

- D-NN — enlace a `02-dudas-y-ambiguedades.md`.
