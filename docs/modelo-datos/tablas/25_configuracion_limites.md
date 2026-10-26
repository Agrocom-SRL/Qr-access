# 25 — `configuracion_limites`

**Módulo dueño:** `limites` · **Tenant:** no (plataforma) · **Migración:** `db/migrations/20261027100001_create_configuracion_limites.sql`

## Propósito

Los topes de generación de QR que AGROCOM edita desde el panel (ADR 0030 §7): una fila por clave, con su valor entero. Valen para todas las cuentas salvo que una cuenta o un usuario tenga una excepción en `excepciones_de_limite`. Nada de esto está fijo en el código: el catálogo de claves y sus extremos sí (`api/src/modules/limites/domain/claves.ts`), los valores no.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `clave` | `VARCHAR(60)` | no | Una del catálogo (tabla de abajo) |
| `valor` | `INT UNSIGNED` | no | Cantidad, segundos o porcentaje según la clave |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` |
| `vigente` | `TINYINT` generada | sí | `1` si no está borrada (ADR 0016) |

## Claves y valores iniciales

Los siembran la migración y `db/seeds/01_catalogo.sql` (idempotente: no pisa un valor ya editado).

| Clave | Inicial | Fuente del valor | Excepción |
|---|---|---|---|
| `qr.tope_diario` | 100 | **Supuesto** (el ADR no lo fija); holgado sobre el umbral de «ruidoso» (20) | cuenta o usuario |
| `qr.tope_pendientes` | 50 | **Supuesto** | cuenta o usuario |
| `qr.reemplazos_sin_uso_por_dia` | 5 | ADR 0030 §2.1.5 | cuenta o usuario |
| `qr.espera_reemplazo_segundos` | 120 | ADR 0030 §2.1.5 | cuenta o usuario |
| `qr.max_puertas_por_qr` | 10 | ADR 0031 §9 («por ejemplo, 10») | cuenta o usuario; también lo puede fijar el plan |
| `qr.bolsa_mensual` | 5000 | **Supuesto** (el ADR solo dice «número fijo por plan al inicio») | solo cuenta; también lo puede fijar el plan |
| `qr.bolsa_aviso_porcentaje` | 80 | ADR 0030 §5 | ninguna |

## Reglas

- Precedencia de cada valor: excepción del usuario, excepción de la cuenta, lo que fija el plan (solo bolsa y puertas por QR), el valor de esta tabla.
- Cada cambio entra a la bitácora con el antes y el después (`PUT /api/v1/plataforma/limites/{clave}`, permiso `limites.configuracion.editar`).
- Sin la fila de una clave, la generación falla cerrado (500): no se genera sin topes.
