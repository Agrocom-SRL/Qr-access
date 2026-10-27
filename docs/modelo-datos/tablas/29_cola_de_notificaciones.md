# 29 — `cola_de_notificaciones` (outbox)

**Módulo dueño:** `notificaciones` · **Tenant:** sí · **Migración:** `db/migrations/20261030100002_create_cola_de_notificaciones.sql`

## Propósito

El *outbox* de avisos (ADR 0030 §6): quien detecta algo lo deja aquí en la MISMA transacción que su cambio de estado; la tarea de entrega lo aplica después a la bandeja. Entrega *at-least-once*: se reintenta con espera creciente (30 s, 1 min, 2 min… tope 1 h) hasta 5 intentos y luego queda `fallida`; el receptor es idempotente (índices únicos de `notificaciones`), así que repetir no duplica.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK; el orden de entrega dentro de un grupo |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `audiencia` | `VARCHAR(12)` | no | `cuenta` (propietario) o `plataforma` (AGROCOM) |
| `canal` | `VARCHAR(10)` | no | `app` hoy; `push` y `correo` reservados sin proveedor (se anotan `omitida`) |
| `agrupacion_clave` | `VARCHAR(100)` | no | Los mensajes de un grupo se aplican en orden |
| `carga` | `JSON` | no | El aviso agrupado (sin secretos) |
| `estado` | `VARCHAR(12)` | no | `pendiente`, `entregada`, `fallida`, `omitida` |
| `intentos` | `SMALLINT UNSIGNED` | no | |
| `proximo_intento_at` | `DATETIME(3)` | no | |
| `ultimo_error` | `VARCHAR(60)` | sí | Solo el nombre del error, nunca su texto (ADR 0033) |
| `entregada_at` | `DATETIME(3)` | sí | |
| `clave_unica` | `VARCHAR(160)` | no | `<grupo>:<audiencia>:<canal>:<instante de la evaluación>`: la misma evaluación no se encola dos veces |
| autoría y soft delete | | | skill `modelo-datos` |

## Índices

`uq_cola_de_notificaciones_clave (tenant_id, clave_unica)`, `idx_cola_de_notificaciones_pendientes (estado, proximo_intento_at, id)`, `idx_cola_de_notificaciones_grupo`.

## Reglas

- Sin bitácora: es infraestructura de entrega. Retención: los mensajes resueltos con más de 30 días se dan de baja.
- La lectura de pendientes de todas las cuentas es un salto explícito del aislamiento (`RepositorioDeColaDeTodas`): solo lee identificadores y cada mensaje se procesa dentro de su cuenta.
