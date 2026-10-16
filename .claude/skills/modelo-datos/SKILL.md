---
name: modelo-datos
description: Convenciones de esquema MySQL 8 de AGROCOM Acceso — nombres de tabla, tenant_id, columnas de autoría y soft delete, unicidad con soft delete por columnas generadas, tablas de solo inserción, fechas en UTC, una migración dbmate por tabla y cómo verificar contra MySQL. Usar antes de escribir o modificar cualquier migración o seed.
---

# Modelo de datos — convenciones

ADR 0007, 0011 y 0016. Documentación del modelo: `docs/modelo-datos/`.

## Nombres

- Tablas en español, plural, `snake_case`, sin prefijo de módulo: `puertas`, `reglas_acceso`, `eventos_acceso`.
- Columnas en español, `snake_case`; FK como `<entidad_singular>_id` (`puerta_id`, `sitio_id`); `tenant_id` es la excepción (nombre técnico fijo).
- Índices: `idx_<tabla>_<columnas>`, únicos `uq_<tabla>_<columnas>`, FK `fk_<tabla>_<columna>`.

## Columnas obligatorias de una tabla de dominio

```sql
id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
tenant_id   BIGINT UNSIGNED NULL,          -- si la tabla es de una cuenta (NOT NULL si nunca es de plataforma)
...
created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
deleted_at  DATETIME(3) NULL,
created_by  BIGINT UNSIGNED NULL,
updated_by  BIGINT UNSIGNED NULL,
deleted_by  BIGINT UNSIGNED NULL,
-- ADR 0016: unicidad solo entre lo vigente y dentro de la cuenta
tenant_clave BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(tenant_id, 0)) STORED,
vigente      TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
CONSTRAINT fk_<tabla>_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

- Toda entidad propia tiene además `activo TINYINT(1) NOT NULL DEFAULT 1` (desactivar no es borrar).
- **Solo inserción** (`eventos_acceso`, `bitacoras`, `qr_usos`): sin `updated_*` ni `deleted_*`; el usuario de la base de la API no tiene `UPDATE`/`DELETE` sobre ellas en producción.

## Unicidad con soft delete (ADR 0016)

MySQL no tiene índices parciales ni `NULLS NOT DISTINCT`. En su lugar:

```sql
UNIQUE KEY uq_usuarios_username (tenant_clave, username, vigente)
```

`vigente` es `NULL` en lo borrado (los `NULL` no chocan en un único de MySQL) y `tenant_clave` convierte el `NULL` de la plataforma en `0` (para que sí choquen dos usuarios de plataforma con el mismo nombre).

## Tipos

| Dato | Tipo |
|---|---|
| Fechas y horas | `DATETIME(3)` en **UTC** (la sesión de MySQL corre en `+00:00`) |
| Hora del día de un horario | `TIME` + zona horaria del sitio |
| Booleano | `TINYINT(1)` |
| Estados cerrados | `VARCHAR(30)` + `CHECK (estado IN (...))` (MySQL 8.0.16+ aplica CHECK) |
| Dinero (si aparece) | `DECIMAL(14,2)` + `moneda CHAR(3)` |
| Secretos cifrados | `VARBINARY(...)` (AES-256-GCM: iv + tag + texto) |
| Hash de clave | `VARCHAR(255)` (argon2id) |
| Datos libres acotados | `JSON` solo para lo que no se consulta por columnas |

## Migraciones (dbmate)

- `db/migrations/<AAAAMMDDhhmmss>_create_<tabla>.sql`, una por tabla al crearla; los cambios posteriores, `..._alter_<tabla>_<que>.sql`.
- Cada archivo con `-- migrate:up` y `-- migrate:down` (el `down` revierte exactamente el `up`).
- No se edita una migración que ya corrió en alguna base: se crea otra.
- Seeds idempotentes en `db/seeds/*.sql` con `INSERT ... ON DUPLICATE KEY UPDATE` (permisos, roles base de la plataforma).

## Verificación

Ver el skill `verificacion`: compose descartable `-p qr-access-verif`, `up`, seeds dos veces, `rollback`, `down -v`.

## Documentación

Toda tabla nueva actualiza `docs/modelo-datos/03-schema-sql.md` y su ficha `docs/modelo-datos/tablas/NN_<tabla>.md` (propósito, dueño, columnas, índices, reglas, dudas) en el mismo PR.
