# 36 — `exportaciones`

**Módulo dueño:** `accesos` · **Tenant:** sí · **Migración:** `db/migrations/20261101100004_create_exportaciones.sql`

## Propósito

La constancia de cada página de datos que una cuenta descargó en CSV (ADR 0033 §3): usuarios, puertas o lecturas. Existe para que cada descarga quede en la bitácora (quién, cuándo, qué recurso, cuántas filas y con qué filtros). **Nunca guarda el contenido exportado.**

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `recurso` | `VARCHAR(10)` | no | `usuarios`, `puertas` o `lecturas` |
| `pagina` | `INT UNSIGNED` | no | Página pedida |
| `por_pagina` | `INT UNSIGNED` | no | Tamaño pedido |
| `filas` | `INT UNSIGNED` | no | Filas entregadas en esa página |
| `filtros` | `JSON` | sí | Filtros de las lecturas (`resultado`, `ejecucion`, `puerta_id`, `desde`, `hasta`); `NULL` en los otros recursos |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` |

## Reglas

- `GET /api/v1/exportaciones/{recurso}` (`accesos.evento.exportar`, solo el Administrador por omisión). Una fila por página entregada; si la constancia no se puede guardar, no se entrega nada.
- Tope de 10 000 filas por recurso (supuesto W11) y rate limit propio (`LIMITE_EXPORTACION_POR_MINUTO`, 10 por minuto y usuario).
