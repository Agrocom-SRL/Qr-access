# 38 — `ordenes_apertura`

**Módulo dueño:** `accesos` · **Tenant:** sí · **Migración:** `db/migrations/<fecha>_create_ordenes_apertura.sql` (ADR 0035)

## Propósito

La orden de abrir que la API le da a la puerta (la toma una de sus placas) cuando un usuario pide la apertura manual desde la app. Es una fila corta, de **un solo uso** y que **vence en segundos**: lo que en el QR es `usado_at`, aquí es el estado de entrega. El hecho queda en `lecturas` (solo inserción) y el resultado físico en `confirmaciones_apertura`; esta tabla solo sabe en qué punto de la entrega va la orden, por eso **sí cambia** (no es de solo inserción).

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `puerta_id` | `BIGINT UNSIGNED` | no | FK a `puertas` |
| `dispositivo_id` | `BIGINT UNSIGNED` | sí | FK a `dispositivos`: la placa que tomó la orden. Nulo mientras está `pendiente`; la orden es de la puerta y la toma la primera placa de esa puerta que la reclame |
| `usuario_id` | `BIGINT UNSIGNED` | no | FK a `usuarios`: quien lo pidió |
| `lectura_id` | `BIGINT UNSIGNED` | no | FK a `lecturas`: el intento `permitido` que la originó |
| `estado` | `VARCHAR(12)` | no | `pendiente`, `entregada`, `ejecutada`, `fallida` o `vencida` |
| `vence_at` | `DATETIME(3)` | no | UTC; por omisión 15 s después de crearla, nunca más de 30 s |
| `entregada_at` | `DATETIME(3)` | sí | Cuándo se la entregó a la placa |
| `resuelta_at` | `DATETIME(3)` | sí | Cuándo pasó a `ejecutada`, `fallida` o `vencida` |
| `clave_idempotencia` | `VARCHAR(64)` | sí | `Idempotency-Key` de la app; un reintento devuelve la misma orden |
| `vigente_clave` | `TINYINT` | sí | Generada: 1 mientras `estado` sea `pendiente` o `entregada`; sostiene la unicidad de abajo |
| autoría | | | `created_at`, `updated_at`, `created_by` (sin soft delete: se archiva con la retención) |

## Índices y restricciones

- `uq_ordenes_apertura_vigente` `(puerta_id, vigente_clave)`: una sola orden viva por puerta; la petición repetida del mismo usuario recibe la misma orden y la de otro usuario `409 manual.orden_en_curso`; no se acumulan pulsos.
- `uq_ordenes_apertura_clave` `(tenant_id, usuario_id, clave_idempotencia)`
- `idx_ordenes_apertura_entrega` `(puerta_id, estado, vence_at)`: lo que consulta la placa.
- `idx_ordenes_apertura_vencimiento` `(estado, vence_at)`: lo que barre el proceso que vence órdenes.
- `ck_ordenes_apertura_estado`, `ck_ordenes_apertura_vence` (`vence_at` dentro de 30 s de `created_at`).
- Claves foráneas a `cuentas`, `puertas`, `dispositivos`, `usuarios` y `lecturas`.

## Reglas

- La entrega es atómica: `UPDATE … SET estado = 'entregada', dispositivo_id = ?, entregada_at = ahora WHERE id = ? AND estado = 'pendiente' AND vence_at > ahora` (una fila). Una orden se entrega una vez a una sola placa, y solo a una placa de su puerta (nunca de otra puerta ni cuenta); si la puerta tiene dos placas, gana la primera y la otra no recibe nada.
- La placa recibe `valida_por_ms` (plazo restante, relativo) y no ejecuta una orden cuyo plazo corrió; al reconectarse no ejecuta órdenes viejas.
- El resultado de la placa pasa la orden a `ejecutada` o `fallida` y escribe la fila de `confirmaciones_apertura`. Una orden `pendiente` o `entregada` cuyo `vence_at` pasó la marca `vencida` el proceso periódico y deja `sin_confirmacion` / `sin_respuesta`.
- Cambios de estado con compare-and-set (`WHERE estado = ?`), sin bloquear la fila del dispositivo (ADR 0032 §1).
- Retención: pendiente, junto con la duda D-06.

## Dudas

- Ninguna abierta; decisiones en el ADR 0035.
