# AGROCOM Acceso

Control de acceso a puertas eléctricas con QR — `acceso.agrocom.com.bo`. Plataforma por suscripción: cada cuenta (empresa) tiene sus usuarios, que entran con un PIN y emiten QR de un solo uso para quien tiene que entrar; un ESP32 con lector en la puerta los valida contra la API.

```
api/        Node.js 22 + TypeScript + Fastify, SQL a mano con mysql2 (sin ORM)
app/        Flutter (Android, iOS y web): login por PIN, emisión de QR, administración
firmware/   ESP32 (framework Arduino, PlatformIO): lector QR + pulso de cerradura por WiFi
db/         Migraciones SQL (dbmate) sobre MySQL 8
docs/       Funcional, modelo de datos, ADRs, diseño, hardware y gestión
```

## Arranque local (Docker)

```
cp .env.example .env
docker compose up -d                                       # MySQL (:3307) + API (:3000)
docker compose --profile herramientas run --rm dbmate up   # migraciones
docker compose --profile web up -d --build                 # + app web (:8080, proxy de /api)
docker compose --profile herramientas run --rm firmware    # compila el firmware y corre sus tests
./bin/verify                                               # compuerta de calidad de todo el monorepo
```

Salud de la API: `http://localhost:3000/api/v1/salud` · OpenAPI: `/api/v1/openapi.json`.

## Documentación

- Invariantes y convenciones: [`CLAUDE.md`](CLAUDE.md)
- Flujo de ramas y PR: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Índice de documentos: [`docs/README.md`](docs/README.md)
