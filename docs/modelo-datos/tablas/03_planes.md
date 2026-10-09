# 03 — `planes`

**Módulo dueño:** `suscripciones` · **Tenant:** no (catálogo de plataforma) · **Migración:** `db/migrations/20261009100003_create_planes.sql`

## Propósito

Límites que vende AGROCOM: cantidad de dispositivos y de usuarios y vigencia máxima de un QR. `NULL` significa sin límite; los QR no tienen tope de cantidad.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `nombre` | `VARCHAR(80)` | no |  |
| `max_dispositivos` | `INT UNSIGNED` | sí |  |
| `max_usuarios` | `INT UNSIGNED` | sí |  |
| `max_vigencia_qr_horas` | `INT UNSIGNED` | sí |  |
| `activo` | `TINYINT(1)` | no | Desactivar no es borrar |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` (skill `modelo-datos`) |

## Índices y restricciones

- `uq_planes_nombre`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- Solo `max_vigencia_qr_horas` se aplica en el núcleo (recorta el vencimiento al emitir). Los límites de dispositivos y usuarios los hará cumplir el alta correspondiente (RF-10).

## Dudas

- D-14 — `02-dudas-y-ambiguedades.md`
