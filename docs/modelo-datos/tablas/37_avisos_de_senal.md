# 37 — `avisos_de_senal`

**Módulo dueño:** `senales` · **Tenant:** sí · **Migración:** `db/migrations/20261102100002_create_avisos_de_senal.sql`

## Propósito

La constancia de que una señal de abuso ya se llevó a la bandeja (ADR 0030 §4 y §5, ola W12): «no se avisa dos veces por el mismo evento en el mismo día». Cada detector arma una `clave_unica` con lo que identifica el hecho y el día local (`America/La_Paz`) y la deja acá en la **misma transacción** que encola el aviso (`cola_de_notificaciones`): o quedan las dos filas o ninguna. Si la clave ya está, el detector no vuelve a avisar. Es de **solo inserción** (no se edita ni se borra; el UNIQUE es el árbitro entre dos pasadas o dos instancias).

No guarda datos del hecho (cantidades, IP, ids de evidencia): eso vive en el incidente (`incidentes_uso`, ficha 33), en el aviso de la bandeja (`notificaciones.datos`) o en el registro de origen.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `tipo` | `VARCHAR(40)` | no | La señal: `uso_masivo`, `uso_imposible`, `qr_reenviado`, `pin_compartido`, `bolsa.aviso`, `bolsa.superada`, `flujo_atipico` |
| `usuario_id` | `BIGINT UNSIGNED` | sí | FK a `usuarios`: solo cuando la señal es de un usuario; `NULL` en las de cuenta (bolsa, flujo) |
| `clave_unica` | `VARCHAR(120)` | no | `<tipo>:<usuario>:<día local>` en las de usuario; `bolsa:<clave de la marca de eventos_de_limite>` en la bolsa; `flujo.atipico:<día local>` en el flujo |
| `created_at` | `DATETIME(3)` | no | Cuándo se dejó la constancia |

Sin `updated_*`, `deleted_*` ni bitácora: perfil `solo_insercion`.

## Índices y restricciones

- `uq_avisos_de_senal_clave (tenant_id, clave_unica)`: el árbitro de «una vez por evento y día».
- `idx_avisos_de_senal_creado (tenant_id, created_at)`: para una futura retención.

## Reglas

- Una señal de gravedad **baja** deja su constancia pero no encola ningún aviso (ADR 0030 §4.1: «se ve en su ficha, no se avisa»).
- Retención: pendiente (crece como mucho una fila por señal y día; se decide junto con D-06 y D-35).
- Lo escribe solo el módulo `senales` (`llevarABandeja`); lo lee el mismo módulo para saltar lo ya avisado.
