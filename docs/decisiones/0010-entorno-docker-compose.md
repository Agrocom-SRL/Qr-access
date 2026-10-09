# ADR 0010 — Entorno con Docker Compose (local y producción)

**Estado:** Aceptada (2026-10-08), revisada el mismo día con los esqueletos: todo lo que puede correr en un contenedor corre en uno. **Origen:** ADR 0010 de ACRECIA, con MySQL y Node.

## Decisión

- **Local** (`docker-compose.yml`):
  - `db`: MySQL 8.4 en UTC y `utf8mb4`. Publica el puerto **3307** (para no chocar con el MySQL de MAMP) y guarda los datos en el volumen `qr-access-db-data`. Al inicializar el volumen, `docker/mysql/01-base-testing.sql` crea `qr_access_testing`.
  - `api`: `api/Dockerfile`, target `desarrollo`. Monta el repo y corre `tsx watch`; `node_modules` va en un volumen propio y un healthcheck consulta `/api/v1/salud`.
  - `web` (perfil `web`): `app/Dockerfile`. Compila Flutter web con la misma versión que el host (clonada por tag) y la sirve con Nginx sin root en el puerto 8080, con proxy de `/api` hacia `api`.
  - `dbmate` (perfil `herramientas`): aplica `db/migrations`.
  - `firmware` (perfil `herramientas`): `firmware/Dockerfile` con PlatformIO. Compila para ESP32 y corre los tests nativos; la caché de toolchains va en el volumen `platformio-cache`. `bin/verify` lo usa si el host no tiene `pio`.
- **Fuera de Docker**, por necesidad: flashear el ESP32 por USB (`pio run -t upload`), correr la app en el teléfono Android por USB (no se usa emulador; ver `docs/gestion/entornos.md`), y el `flutter test` del día a día (más rápido en el host).
- **Producción**: `api/Dockerfile` target `produccion` (multi-stage, sin dev-dependencies, usuario `node`, healthcheck) y `app/Dockerfile` (Nginx con cabeceras de seguridad). El `docker-compose.prod.yml` con TLS para `acceso.agrocom.com.bo` se escribe al decidir el servidor (D-13).
- **Tests de la API sobre MySQL**, nunca SQLite: base `qr_access_testing` del mismo contenedor; la CI levanta su propio servicio `mysql:8.4`.
- **Verificar migraciones** en un proyecto compose descartable (`-p qr-access-verif`), que sí se puede bajar con `down -v`.

## Consecuencias

- La API corriendo en el host usa `DB_HOST=127.0.0.1` y `DB_PORT=3307`; en el contenedor, `db:3306`.
- El volumen de desarrollo no se borra (guardarraíl de `.claude/hooks/`).
- La primera construcción de `web` y de `firmware` descarga Flutter y el toolchain del ESP32 (varios cientos de MB); después queda en caché.
