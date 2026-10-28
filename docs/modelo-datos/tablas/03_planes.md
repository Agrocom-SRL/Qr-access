# 03 — `planes`

**Módulo dueño:** `suscripciones` · **Tenant:** no (catálogo de plataforma) · **Migración:** `db/migrations/20261009100003_create_planes.sql`

## Propósito

Límites que vende AGROCOM: cantidad de dispositivos y de usuarios y vigencia máxima de un QR. `NULL` significa sin límite. Para el cliente el plan sigue siendo «sin límite de QR»; internamente la generación tiene topes (ADR 0030 §2) y el plan puede fijar la bolsa mensual y las puertas por QR.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `nombre` | `VARCHAR(80)` | no |  |
| `max_dispositivos` | `INT UNSIGNED` | sí |  |
| `max_usuarios` | `INT UNSIGNED` | sí |  |
| `max_vigencia_qr_horas` | `INT UNSIGNED` | sí |  |
| `bolsa_qr_mensual` | `INT UNSIGNED` | sí | QR que la cuenta puede generar por mes antes de que se avise (ADR 0030 §2); `NULL` = rige `qr.bolsa_mensual` (migración `20261027100004_add_limites_de_qr_a_planes.sql`) |
| `max_puertas_por_qr` | `INT UNSIGNED` | sí | Puertas por QR (ADR 0031 §9); `NULL` = rige `qr.max_puertas_por_qr` |
| `precio_anual` | `DECIMAL(14,2)` | no | Bs por año; solo afecta renovaciones y cambios de plan futuros (migración `20261012100003_add_precio_anual_a_planes.sql`, ADR 0022) |
| `activo` | `TINYINT(1)` | no | Desactivar no es borrar |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` (skill `modelo-datos`) |

## Índices y restricciones

- `uq_planes_nombre`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- `bolsa_qr_mensual` y `max_puertas_por_qr` los aplica `generar-qr` (la bolsa no corta: solo marca y avisa). Se editan con `PATCH /api/v1/plataforma/planes/{id}`; `null` devuelve el plan al valor general.
- Solo `max_vigencia_qr_horas` se aplica en el núcleo (recorta el vencimiento al generar). Los límites de dispositivos y usuarios los hará cumplir el alta correspondiente (RF-10).

## Dudas

- D-14 — `02-dudas-y-ambiguedades.md`
