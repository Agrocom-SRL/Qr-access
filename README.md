# AGROCOM Acceso

Control de acceso a puertas eléctricas con QR — `acceso.agrocom.com.bo`. Plataforma por suscripción: cada cuenta (empresa) tiene sus usuarios, que entran con un PIN y generan QR de un solo uso para quien tiene que entrar; un ESP32 con lector en la puerta los valida contra la API.

```
api/        Node.js 22 + TypeScript + Fastify, SQL a mano con mysql2 (sin ORM)
app/        Flutter (Android, iOS y web): login por PIN, generación de QR, administración
firmware/   ESP32 (framework Arduino, PlatformIO): lector QR + pulso de cerradura por Ethernet
db/         Migraciones SQL (dbmate) sobre MySQL 8
docs/       Funcional, modelo de datos, ADRs, diseño, hardware y gestión
```

## Versión

**Versión actual: `v0.5.0`** (2026-10-14). Una sola versión para todo el monorepo (ADR 0014): `api/package.json`, `web/package.json`, `app/pubspec.yaml` (`0.5.0+6`) y `firmware/include/version.h` (`0.5.0`) la llevan igual.

- **v0.5.0** — El lector de QR es RS485 detrás del módulo TTL-RS485, con velocidad configurable por bandera de compilación; documentado el cableado del lector y el módulo USB-serie.
- **v0.4.0** — Solo Ethernet y vinculación remota de placas (ADR 0025): inventario de placas y vinculación a una puerta desde el panel web, reclamo de la placa a la API y reasignación entre cuentas sin reprogramar.

Para publicar una versión nueva: sube el número en esos cuatro archivos y en esta sección, y luego `git tag -a vX.Y.Z -m vX.Y.Z` sobre `develop` y `git push origin vX.Y.Z`; `release.yml` hace el resto.

## Arranque local (Docker)

```
cp .env.example .env
docker compose up -d                                       # MySQL (:3307) + API (:3000)
docker compose --profile herramientas run --rm dbmate up   # migraciones
docker compose --profile panel --profile web up -d --build # + panel (:8080) y app web (:8080/app/)
docker compose --profile herramientas run --rm firmware    # compila el firmware y corre sus tests
./bin/verify                                               # compuerta de calidad de todo el monorepo
```

Salud de la API: `http://localhost:3000/api/v1/salud` · OpenAPI: `/api/v1/openapi.json`.

## Documentación

- Invariantes y convenciones: [`CLAUDE.md`](CLAUDE.md)
- Flujo de ramas y PR: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Índice de documentos: [`docs/README.md`](docs/README.md)
