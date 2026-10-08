# ADR 0016 — Unicidad con soft delete en MySQL: columnas generadas

**Estado:** Aceptada (2026-10-08)

## Contexto

En ACRECIA (PostgreSQL) "único dentro de la cuenta y solo entre lo vigente" se resolvía con índices parciales (`WHERE deleted_at IS NULL`) y `NULLS NOT DISTINCT`. MySQL 8 no tiene ninguno de los dos: un `UNIQUE (tenant_id, username)` simple impide recrear un usuario borrado y no protege a los usuarios de plataforma (`tenant_id NULL` no choca con otro `NULL`).

## Decisión

Dos columnas generadas almacenadas en toda tabla con unicidad de negocio:

```sql
tenant_clave BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(tenant_id, 0)) STORED,
vigente      TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
UNIQUE KEY uq_usuarios_username (tenant_clave, username, vigente)
```

- `vigente = NULL` en lo borrado → las filas borradas no chocan entre sí ni con la vigente.
- `tenant_clave = 0` para la plataforma → dos usuarios de plataforma con el mismo nombre sí chocan.
- La FK sigue sobre `tenant_id` (la columna real).

## Alternativas descartadas

- **Renombrar al borrar** (`username = CONCAT(username, '#', id)`): altera el dato histórico que la bitácora debe conservar.
- **Validar solo en la aplicación**: sin garantía ante concurrencia.

## Consecuencias

- Las columnas generadas no se escriben nunca desde la API (MySQL lo rechaza).
