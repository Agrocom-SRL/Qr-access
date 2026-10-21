# 23 — `unidades`

**Módulo dueño:** `organizacion` · **Tenant:** sí · **Migración:** `db/migrations/20261022100001_create_unidades.sql`

## Propósito

Una casa, departamento, pabellón o puesto dentro de una propiedad (`sitios`). Tiene un Titular, que es quien responde por ella y crea a sus Miembros (ADR 0028).

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `sitio_id` | `BIGINT UNSIGNED` | no | FK a `sitios` (la propiedad) |
| `nombre` | `VARCHAR(80)` | no | Etiqueta visible ("Casa 12", "Pabellón B") |
| `titular_id` | `BIGINT UNSIGNED` | sí | FK a `usuarios`; NULL = aún sin Titular |
| `activo` | `TINYINT(1)` | no | Desactivar no es borrar |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` (skill `modelo-datos`) |

## Índices y restricciones

- `uq_unidades_nombre` (`sitio_id`, `nombre`, `vigente`)
- `uq_unidades_titular` (`titular_id`, `vigente`): un usuario es Titular de una sola unidad

## Reglas

- Los Miembros no tienen columna de unidad: cuelgan de su Titular (`usuarios.superior_id`) y su unidad es la de él.
- Dar de baja al Titular da de baja a la unidad y, en cascada con confirmación, a sus Miembros (ADR 0028 §7).
- Solo AGROCOM reasigna una unidad completa a otro Administrador (ADR 0028 §7).
