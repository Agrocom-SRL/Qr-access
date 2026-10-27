# 16 — `eventos_acceso`

**Módulo dueño:** `accesos` · **Tenant:** sí · **Migraciones:** `db/migrations/20261009100016_create_eventos_acceso.sql` y `20261028100001_add_repetido_de_id_a_eventos_acceso.sql`

## Propósito

Todo intento de apertura, permitido o rechazado, con su motivo (invariante 4, ADR 0007).

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `puerta_id` | `BIGINT UNSIGNED` | no |  |
| `dispositivo_id` | `BIGINT UNSIGNED` | sí |  |
| `qr_acceso_id` | `BIGINT UNSIGNED` | sí |  |
| `token_hash` | `CHAR(64)` | sí | SHA-256 del token del QR (sensible) |
| `metodo` | `VARCHAR(20)` | no | `qr`, `pulsador`, `forzada` |
| `resultado` | `VARCHAR(10)` | no | `permitido` o `rechazado` |
| `motivo_code` | `VARCHAR(60)` | no | Código estable, p. ej. `qr.vencido` |
| `ocurrido_at` | `DATETIME(3)` | no |  |
| `leido_en_dispositivo_at` | `DATETIME(3)` | sí |  |
| `repetido_de_id` | `BIGINT UNSIGNED` | sí | FK a `eventos_acceso`: el intento original del que este es una repetición dentro de la ventana (ADR 0032 §3 y §4). `NULL` en los originales |

## Índices y restricciones

- `idx_eventos_acceso_puerta`
- `idx_eventos_acceso_fecha`
- `idx_eventos_acceso_qr`
- `idx_eventos_acceso_global (ocurrido_at)` (ola W12): los detectores de señales buscan los intentos de una ventana de tiempo en TODAS las cuentas, y los demás índices empiezan por `tenant_id`.
- `idx_eventos_acceso_repeticion` `(tenant_id, dispositivo_id, token_hash, ocurrido_at)`: busca el original de una repetición
- `idx_eventos_acceso_repetido_de`
- `fk_eventos_acceso_repetido_de`
- `ck_eventos_acceso_metodo`
- `ck_eventos_acceso_resultado`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- Solo inserción: sin `updated_*` ni `deleted_*`; la API nunca actualiza ni borra una fila. En producción, el usuario de base no tiene `UPDATE` ni `DELETE`.
- Un token desconocido o ilegible se guarda como `token_hash`, nunca como texto.
- `ocurrido_at` es la hora del servidor; `leido_en_dispositivo_at` es la del reloj del dispositivo, solo informativa.
- Qué pasó con la orden de abrir (¿la puerta se abrió?) no se guarda aquí: vive en `confirmaciones_apertura` (ficha 32), enlazada a este evento. El evento nunca se edita.
- `repetido_de_id` se escribe en el INSERT de la fila repetida, nunca por UPDATE. Un repetido apunta siempre al original (nunca a otro repetido), así la ventana no se encadena. Hay repetición cuando el MISMO dispositivo relee el MISMO `token_hash`: de una apertura `permitido` dentro de 15 s (la API vuelve a responder `abrir: true` sin consumir otra vez) o de un rechazo idéntico (mismo `motivo_code`) dentro de 60 s. Listados y estadísticas muestran solo los originales, con «×N».
- La apertura por pulsador de salida y la puerta forzada (`metodo`) quedan para el firmware.

## Dudas

- D-06 — `02-dudas-y-ambiguedades.md`
