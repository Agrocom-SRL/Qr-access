# 28 — `claves_idempotencia`

**Módulo dueño:** `accesos` · **Tenant:** sí · **Migración:** `db/migrations/20261027100006_create_claves_idempotencia.sql`

## Propósito

Caché de reintento de `POST /qr-accesos` (ADR 0031 §11). Con la cabecera `Idempotency-Key`, un reintento por mala red (misma clave, mismo cuerpo, mismo usuario) devuelve la respuesta original sin crear otro QR ni gastar topes. Tabla **transitoria**, como `sesiones`: sin soft delete ni autoría, y las filas vencidas se borran de verdad (excepción a la invariante 8: es un caché, no un dato de dominio; el QR sí queda en `qr_accesos` y en la bitácora).

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `usuario_id` | `BIGINT UNSIGNED` | no | FK a `usuarios`: quien generó |
| `operacion` | `VARCHAR(40)` | no | Hoy solo `qr.generar` (`CHECK`) |
| `clave_hash` | `CHAR(64)` | no | SHA-256 de la clave; la clave en claro no se guarda |
| `huella` | `CHAR(64)` | no | SHA-256 del cuerpo normalizado (puertas ordenadas y sin repetir, vencimiento en UTC, etiqueta, `propio`, `reemplazar`) |
| `respuesta` | `JSON` | no | La respuesta SIN el campo `texto` |
| `con_token` | `TINYINT(1)` | no | 1 si el QR se creó con token derivado (hay que volver a derivar el texto al repetir) |
| `created_at` | `DATETIME(3)` | no | UTC; entra en la derivación del token |
| `vence_at` | `DATETIME(3)` | no | UTC; 24 h después de `created_at` |

## Índices

- `uq_claves_idempotencia_clave (tenant_id, usuario_id, operacion, clave_hash)`: una clave nunca cruza usuarios ni cuentas.
- `idx_claves_idempotencia_vence (vence_at)`: para el barrido.

## Reglas

- **El token no se guarda** (ADR 0008, invariante 6). Con clave, el token del QR se deriva con HMAC-SHA256 de la pimienta del servidor, la cuenta, el usuario, la clave y `created_at`; al repetir se vuelve a calcular. Quien tenga solo la base no puede reconstruirlo (falta la clave en claro, que solo tiene el cliente, y la pimienta).
- Se escribe en la misma transacción que el QR. Lo que falla (429, 403...) no se recuerda: la misma clave puede reintentarse.
- Misma clave con otra huella: `idempotencia.conflicto` (422). Dos peticiones simultáneas se serializan por el bloqueo del usuario; si el índice único igual choca, `idempotencia.en_curso` (409).
- Limpieza: cada escritura borra las vencidas del usuario y un barrido horario borra las de todas las cuentas.
