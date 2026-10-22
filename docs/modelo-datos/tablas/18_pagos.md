# 18 — `pagos`

**Módulo dueño:** `suscripciones` · **Tenant:** sí · **Migraciones:** `20261012100005_create_pagos.sql` y `20261012100009_add_banco_y_comprobante_a_pagos.sql`

## Propósito

Cada pago que AGROCOM registra a mano por una cuenta (cobro manual, D-15, ADR 0022). Es la base de la cobranza y del historial de "Renovaciones y pagos".

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `suscripcion_id` | `BIGINT UNSIGNED` | no | FK a `suscripciones` |
| `plan_id` | `BIGINT UNSIGNED` | no | Plan vigente al pagar |
| `tipo` | `VARCHAR(20)` | no | `renovacion` o `mejora_de_plan` |
| `monto` | `DECIMAL(14,2)` | no | Bs; mayor que 0 |
| `fecha_pago` | `DATE` | no | Cuándo pagó la cuenta |
| `medio` | `VARCHAR(20)` | no | `transferencia`, `qr` o `efectivo` (migración `20261022100009`: los `deposito` pasaron a `transferencia`) |
| `referencia` | `VARCHAR(80)` | no | Número de transacción o de boleta; opcional, vacía si no se escribió |
| `banco` | `VARCHAR(60)` | sí | Histórica: ya no se pide (ADR 0024) |
| `cuenta_destino` | `VARCHAR(60)` | sí | Histórica: ya no se pide (ADR 0024) |
| `comprobante_id` | `BIGINT UNSIGNED` | sí | FK a `comprobantes`: la foto o el PDF del comprobante |
| `periodo_desde` | `DATETIME(3)` | no | Inicio del periodo que cubre |
| `periodo_hasta` | `DATETIME(3)` | no | Fin del periodo que cubre |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by` (quien registró), `updated_by`, `deleted_by` |

## Índices y restricciones

- `idx_pagos_tenant_fecha`, `idx_pagos_fecha`
- `fk_pagos_comprobante`
- `ck_pagos_tipo`, `ck_pagos_medio`, `ck_pagos_monto`, `ck_pagos_periodo`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- Registrar un pago de tipo `renovacion` extiende la suscripción 12 meses desde su vencimiento actual y el periodo del pago es ese año nuevo.
- Un pago de tipo `mejora_de_plan` cobra la diferencia de precio de un cambio a un plan mayor; no cambia la vigencia y su periodo es el que queda por delante.
- Una transferencia o un pago por QR exigen `comprobante_id` (lo valida el contrato de la API); un pago en efectivo no lo lleva.
- Los pagos no se editan: un error se corrige con un pago nuevo y queda en la bitácora.

## Dudas

- D-15 — `02-dudas-y-ambiguedades.md`. El comprobante adjunto y su almacenamiento quedaron resueltos en el ADR 0024.
