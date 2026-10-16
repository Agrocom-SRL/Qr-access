# 19 — `comprobantes`

**Módulo dueño:** `suscripciones` · **Tenant:** no (plataforma) · **Migración:** `db/migrations/20261012100008_create_comprobantes.sql`

## Propósito

Los metadatos del archivo (foto o PDF) que respalda un pago por transferencia o depósito (ADR 0024). El contenido no está en la base: vive en el almacén de archivos (`ARCHIVOS_RUTA`, volumen `archivos`) y acá solo queda su ruta relativa.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `ruta` | `VARCHAR(255)` | no | Relativa al almacén: `comprobantes/<uuid>.<ext>`, nombre aleatorio y único |
| `tipo_mime` | `VARCHAR(40)` | no | `image/jpeg`, `image/png`, `image/webp` o `application/pdf`, detectado por los bytes |
| `tamano` | `INT UNSIGNED` | no | Bytes; la API acepta hasta 5 MB |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by` (el super admin que lo subió), `updated_by`, `deleted_by` |

## Índices y restricciones

- `uq_comprobantes_ruta`
- `ck_comprobantes_tipo`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- Sin `tenant_id`: se sube antes de que el pago (o la cuenta, en el alta) exista. El pago lo referencia (`pagos.comprobante_id`) y de él se deduce la cuenta; solo el super admin lo lee, por `GET /plataforma/comprobantes/{id}`.
- Nunca se sirve desde una carpeta pública ni con el nombre que dio el cliente.
- Si el pago no llega a registrarse, el archivo queda sin referencia; la purga periódica queda pendiente (ADR 0024).
