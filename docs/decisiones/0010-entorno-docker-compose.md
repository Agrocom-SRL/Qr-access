# ADR 0010 — Entorno con Docker Compose (local y producción)

**Estado:** Aceptada (2026-10-08) · **Origen:** ADR 0010 de ACRECIA, con MySQL y Node.

## Decisión

- **Local** — `docker-compose.yml`:
  - `db`: MySQL 8.4 en UTC y `utf8mb4`, puerto publicado **3307** (para no chocar con el MySQL de MAMP), volumen `qr-access-db-data`. `docker/mysql/01-base-testing.sql` crea `qr_access_testing` al inicializar el volumen.
  - `dbmate` (perfil `herramientas`): aplica `db/migrations`.
  - `api`: `node:22-alpine` con el repo montado (`npm run dev`); `node_modules` en un volumen propio.
- **Flutter y PlatformIO corren en el host** (necesitan emuladores, navegador y USB).
- **Producción** — `api/Dockerfile` multi-stage (build TypeScript → imagen `node:22-alpine` sin dev-dependencies, usuario no root) + `docker-compose.prod.yml` (API, MySQL sin puerto publicado, Nginx sirviendo el build web de Flutter y haciendo proxy de `/api` con TLS para `acceso.agrocom.com.bo`). Se escriben cuando exista `api/`.
- **Tests de la API sobre MySQL**, nunca SQLite: base `qr_access_testing` del mismo contenedor; la CI levanta su propio servicio `mysql:8.4`.
- **Verificar migraciones** en un proyecto compose descartable (`-p qr-access-verif`), que sí se puede bajar con `down -v`.

## Consecuencias

- La API corriendo en el host usa `DB_HOST=127.0.0.1` y `DB_PORT=3307`; en el contenedor, `db:3306`.
- El volumen de desarrollo no se borra (guardarraíl de `.claude/hooks/`).
