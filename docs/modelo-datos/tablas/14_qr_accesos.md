# 14 — `qr_accesos`

**Módulo dueño:** `accesos` · **Tenant:** sí · **Migración:** `db/migrations/20261009100014_create_qr_accesos.sql`

## Propósito

QR de un solo uso emitido por un usuario de la cuenta (ADR 0008). Solo se guarda el hash de su token.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `emitido_por` | `BIGINT UNSIGNED` | no |  |
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
- `idx_qr_accesos_emisor`
- `idx_qr_accesos_vencimiento`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- `token_hash` = SHA-256 del token de 128 bits; único. El token en claro solo existe en la respuesta de la emisión.
- Estado derivado, sin columna: `anulado_at` > `usado_at` > `vence_at` pasado > vigente.
- Consumo atómico: `UPDATE … SET usado_at = ?, usado_dispositivo_id = ? WHERE id = ? AND usado_at IS NULL AND anulado_at IS NULL AND vence_at > ?` debe afectar una fila; si dos lectores compiten, uno solo abre.
- `vence_at` es, por defecto, el fin del día local del sitio, sin pasar la vigencia máxima del plan.
- La baja diaria por soft delete de los vencidos (ADR 0008 §7) queda pendiente.

## Dudas

- D-16 — `02-dudas-y-ambiguedades.md`
- D-17 — `02-dudas-y-ambiguedades.md`
- D-21 — `02-dudas-y-ambiguedades.md`
