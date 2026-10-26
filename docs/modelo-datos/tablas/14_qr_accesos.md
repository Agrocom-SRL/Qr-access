# 14 — `qr_accesos`

**Módulo dueño:** `accesos` · **Tenant:** sí · **Migración:** `db/migrations/20261009100014_create_qr_accesos.sql`

## Propósito

QR de un solo uso generado por un usuario de la cuenta (ADR 0008). Solo se guarda el hash de su token.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `generado_por` | `BIGINT UNSIGNED` | no |  |
| `token_hash` | `CHAR(64)` | no | SHA-256 del token del QR (sensible) |
| `etiqueta` | `VARCHAR(60)` | sí |  |
| `vence_at` | `DATETIME(3)` | no | UTC |
| `usado_at` | `DATETIME(3)` | sí | Consumo atómico (UTC) |
| `usado_dispositivo_id` | `BIGINT UNSIGNED` | sí |  |
| `anulado_at` | `DATETIME(3)` | sí | UTC |
| `anulado_por` | `BIGINT UNSIGNED` | sí |  |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` (skill `modelo-datos`) |

## Índices y restricciones

- `uq_qr_accesos_token`
- `idx_qr_accesos_generador`
- `idx_qr_accesos_vencimiento`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- `token_hash` = SHA-256 del token de 128 bits; único. El token en claro solo existe en la respuesta de la generación.
- Estado derivado, sin columna: `anulado_at` > `usado_at` > `vence_at` pasado > vigente.
- Consumo atómico: `UPDATE … SET usado_at = ?, usado_dispositivo_id = ? WHERE id = ? AND usado_at IS NULL AND anulado_at IS NULL AND vence_at > ?` debe afectar una fila; si dos lectores compiten, uno solo abre.
- `vence_at` es, por defecto, el fin del día local del sitio, sin pasar la vigencia máxima del plan.
- La baja diaria por soft delete de los vencidos (ADR 0008 §7) queda pendiente.

## Dudas

- D-16 — `02-dudas-y-ambiguedades.md`
- D-17 — `02-dudas-y-ambiguedades.md`
- D-21 — `02-dudas-y-ambiguedades.md`

## QR propio ("Mi QR de acceso")

- `es_propio` marca el QR que la app genera al abrir "Mi QR de acceso". No se lista ni se cuenta en "Mis QR" (se presenta como una entrada fija); sus usos siguen quedando en `eventos_acceso`.
- `propio_activo` vale 1 mientras ese QR no se anule ni se use, y el `UNIQUE (generado_por, propio_activo)` impide dos activos por usuario. Al generar uno nuevo, la API anula los anteriores en la misma transacción: si alguien le sacó una foto al QR viejo, ya no abre.

## Reutilización y topes (ADR 0030 §2 y §2.1, ola W5)

- Pedir «Mi QR» con uno propio vigente, sin usar y para las mismas puertas **no crea ni anula nada**: la API responde 200 con `reutilizado: true` y `texto: null` (el servidor solo guarda el hash; la app muestra su copia local). Con otras puertas, o con `reemplazar: true`, se anula el anterior y se genera otro (un «reemplazo sin uso», registrado en `eventos_de_limite`). Si el anterior ya se usó, venció o se anuló, es una generación normal.
- Los conteos de los topes salen de esta tabla: por usuario y día (`qr.limite_diario`, cualquier QR creado), por usuario los vigentes sin usar (`qr.limite_pendientes`) y por cuenta y mes (la bolsa). El día y el mes se cuentan en `America/La_Paz`. Un QR dado de baja por soft delete deja de contar (la baja diaria de vencidos del ADR 0008 §7 sigue pendiente).
- Migración `20261027100005_add_indice_de_creacion_a_qr_accesos.sql`: `idx_qr_accesos_creado (tenant_id, created_at)` para el conteo mensual.
