# 24 — `cuentas_de_cobro`

**Módulo dueño:** `suscripciones` · **Tenant:** no (plataforma) · **Migración:** `db/migrations/20261022100010_create_cuentas_de_cobro.sql`

## Propósito

Las cuentas bancarias y los QR donde AGROCOM recibe el pago de las suscripciones (ADR 0029). Se muestran al registrar el pago de alta de una cuenta; los pagos no las referencian.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `metodo` | `VARCHAR(20)` | no | `transferencia` o `qr` |
| `banco` | `VARCHAR(60)` | no | Nombre del banco |
| `titular` | `VARCHAR(120)` | sí | Titular de la cuenta; obligatorio si `metodo = 'transferencia'` |
| `numero_cuenta` | `VARCHAR(40)` | sí | Obligatorio si `metodo = 'transferencia'` |
| `tipo_cuenta` | `VARCHAR(20)` | sí | `ahorro` o `corriente` |
| `imagen_id` | `BIGINT UNSIGNED` | sí | FK a `comprobantes`: la imagen del QR; obligatoria si `metodo = 'qr'` |
| `nota` | `VARCHAR(200)` | sí | Texto libre para quien cobra |
| `activo` | `TINYINT(1)` | no | Una desactivada deja de mostrarse al cobrar |
| `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` | | | Soft delete y autoría (invariante 8) |
| `vigente` | `TINYINT` generada | sí | `1` si no está borrada; sostiene la unicidad con soft delete (ADR 0016) |

## Restricciones

- `UNIQUE (banco, numero_cuenta, vigente)`: el mismo banco y número no se repiten entre las vigentes (un QR no tiene número, y `NULL` no choca).
- `CHECK` por método: una cuenta bancaria exige `titular` y `numero_cuenta`; un QR exige `imagen_id`.
