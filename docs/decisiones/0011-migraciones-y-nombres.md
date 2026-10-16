# ADR 0011 — Migraciones SQL con dbmate, nombres de tabla y una migración por tabla

**Estado:** Aceptada (2026-10-08) · **Origen:** ADR 0011 y 0024 de ACRECIA.

## Contexto

Sin ORM (ADR 0002) hace falta una herramienta de migraciones que no imponga uno. Se busca que el esquema sea SQL puro, revisable en el diff y ejecutable igual en local, CI y producción.

## Decisión

- **dbmate**: binario independiente del lenguaje (imagen Docker oficial), migraciones `.sql` con secciones `-- migrate:up` / `-- migrate:down`, tabla `schema_migrations` y espera a que la base esté lista.
- Archivos en `db/migrations/<AAAAMMDDhhmmss>_<accion>_<tabla>.sql`.
- **Una migración `create_<tabla>` por tabla** al crearla; los cambios posteriores, en migraciones `alter_` nuevas. No se edita una migración que ya corrió en alguna base.
- **Tablas en español, plural, `snake_case`, sin prefijo de módulo** (`puertas`, `reglas_acceso`). Columnas en español; `tenant_id` y las de autoría/tiempos con nombre técnico fijo.
- Seeds idempotentes en `db/seeds/` (`INSERT ... ON DUPLICATE KEY UPDATE`).
- El `down` revierte exactamente el `up` y se prueba (skill `verificacion`).

## Alternativas descartadas

- **Knex/Prisma/TypeORM migrations**: atadas a herramientas descartadas en el ADR 0002.
- **node-pg-migrate / umzug**: umzug sirve, pero obliga a escribir el runner y las migraciones en JS; dbmate da lo mismo con SQL plano.
- **Flyway**: sólido, pero pesado (JVM) para este tamaño.

## Consecuencias

- `db/schema.sql` (volcado de dbmate) no se versiona: la fuente de verdad son las migraciones y `docs/modelo-datos/03-schema-sql.md`.
- La API no migra al arrancar: el deploy corre `dbmate up` como paso explícito.
