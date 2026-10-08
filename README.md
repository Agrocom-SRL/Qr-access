# AGROCOM Acceso

Control de acceso a puertas eléctricas con lectura de QR — `acceso.agrocom.com.bo`.

```
app/        Flutter (Android, iOS y web): QR personal, administración y escáner de guardia
api/        Node.js 22 + TypeScript + Fastify, SQL a mano con mysql2 (sin ORM)
db/         Migraciones SQL (dbmate) sobre MySQL 8
firmware/   ESP32 (framework Arduino, PlatformIO): lector QR + relé de cerradura por WiFi
docs/       Funcional, modelo de datos, ADRs, diseño, hardware y gestión
```

## Arranque local

```
cp .env.example .env
docker compose up -d db          # MySQL 8 en el puerto 3307
docker compose run --rm dbmate up
./bin/verify                     # compuerta de calidad de todo el monorepo
```

## Documentación

- Invariantes y convenciones: [`CLAUDE.md`](CLAUDE.md)
- Flujo de ramas y PR: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Índice de documentos: [`docs/README.md`](docs/README.md)
