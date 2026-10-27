# 28 — `notificaciones`

**Módulo dueño:** `notificaciones` · **Tenant:** mixto (`tenant_id` de la cuenta para el propietario; `NULL` para AGROCOM) · **Migración:** `db/migrations/20261030100001_create_notificaciones.sql`

## Propósito

La bandeja in-app (ADR 0030 §6, ADR 0031 §18): una fila **por destinatario**. Hoy solo la llenan los estados de placa (caída sostenida, desaparecida, lector sin respuesta y la constancia de recuperación). Un aviso AGRUPADO por sitio es **una** fila mientras el incidente siga abierto.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | sí | FK a `cuentas`. Cuenta del destinatario; `NULL` = bandeja de AGROCOM |
| `cuenta_id` | `BIGINT UNSIGNED` | no | FK a `cuentas`: de qué cuenta habla el aviso (con `tenant_id` no nulo son iguales) |
| `destinatario_id` | `BIGINT UNSIGNED` | no | FK a `usuarios` (un usuario de la cuenta o un integrante de AGROCOM) |
| `tipo` | `VARCHAR(40)` | no | `placa.caida_sostenida`, `placa.desaparecida`, `placa.lector_sin_respuesta`, `placa.recuperada` (`CHECK`) |
| `severidad` | `VARCHAR(10)` | no | `info`, `aviso`, `critica` |
| `sitio_id` | `BIGINT UNSIGNED` | sí | FK a `sitios`: el grupo del aviso |
| `agrupacion_clave` | `VARCHAR(100)` | no | `<tipo>:sitio:<id>`; un incidente abierto por destinatario y clave |
| `clave_unica` | `VARCHAR(120)` | sí | Idempotencia de las constancias (`resuelta:<id del incidente>`) |
| `abierta` | `TINYINT(1)` | no | 1 mientras el incidente sigue; se cierra al recuperarse |
| `cantidad` | `INT UNSIGNED` | no | Placas del grupo hoy |
| `miembros` | `JSON` | no | Ids de dispositivos que alguna vez formaron parte del incidente |
| `datos` | `JSON` | no | Cuenta, sitio y placas (id, puerta, desde cuándo). **Nunca** secretos, MAC, IP ni credenciales |
| `novedad_at` | `DATETIME(3)` | no | Última novedad (ordena la bandeja) |
| `resuelta_at` | `DATETIME(3)` | sí | Cuándo se cerró el incidente |
| `leida_at`, `descartada_at` | `DATETIME(3)` | sí | Estado de lectura de ESA persona |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` |
| `vigente`, `incidente_abierto` | `TINYINT` generadas | sí | Para los índices únicos |

## Índices y restricciones

- `uq_notificaciones_incidente (destinatario_id, agrupacion_clave, incidente_abierto)`: dos procesos no abren dos incidentes iguales.
- `uq_notificaciones_clave (destinatario_id, clave_unica)`.
- `idx_notificaciones_bandeja`, `idx_notificaciones_cuenta`, `ck_notificaciones_ambito` (`tenant_id` es nulo o igual a `cuenta_id`).

## Reglas

- Destinatarios por permiso, no por nombre de rol (ADR 0030 §5): `notificaciones.aviso.ver` (ámbito cuenta; lo tiene el Administrador, no el Titular, Miembro ni Guardia) y `notificaciones.aviso_plataforma.ver` (ámbito plataforma). Se excluyen los suspendidos.
- Si llega una placa nueva a un incidente abierto, se actualiza la misma fila y vuelve a figurar como no leída; al recuperarse todas se cierra (y, en `desaparecida`, deja la constancia `placa.recuperada`).
- Sin bitácora (`dominio_sin_bitacora`): es un derivado del estado de las placas y leer o descartar es estado personal.
- Retención (supuesto W9): las cerradas con más de 90 días se dan de baja (soft delete, invariante 8; no hay DELETE físico) por lotes, una transacción por cuenta. Las lee `idx_notificaciones_retencion (abierta, novedad_at, deleted_at)`.
- Enfriamiento (supuesto W9): si un grupo se recupera y vuelve a caer dentro de 60 minutos, se REABRE el incidente cerrado (misma fila) en vez de abrir otro; solo vuelve a figurar como no leído si llegó una placa que el destinatario no conocía. La constancia «recuperada» es una por incidente.
- Al dar de baja una cuenta se cierran sus incidentes abiertos (los del propietario y los de AGROCOM que hablan de ella).
- `cuenta_id` sale siempre de la cuenta del contexto con que se entrega, nunca de la carga del mensaje.
