# ADR 0001 — Monorepo: API, app, firmware y base en un solo repositorio

**Estado:** Aceptada (2026-10-08)

## Contexto

AGROCOM Acceso tiene tres piezas que cambian juntas: la app Flutter que muestra o escanea el QR, la API que lo valida y el firmware que acciona la puerta. El proyecto es chico y lo desarrolla un equipo chico con agentes de IA. Una historia típica ("abrir la puerta con QR") toca las tres a la vez.

## Decisión

Un solo repositorio (`agrocom-developer/Qr-access`):

```
api/        Node.js + TypeScript (ADR 0002)
app/        Flutter móvil + web (ADR 0012)
firmware/   ESP32 + Arduino + PlatformIO (ADR 0009)
db/         migraciones SQL (ADR 0011)
docs/       funcional, modelo de datos, ADRs, diseño, hardware, gestión
```

- **Un solo gitflow** (ADR 0006), una sola CI con un job por parte (`api`, `app`, `firmware`) y un check resumen `ci` (ADR 0014).
- **Una sola versión** por release (`vX.Y.Z`) para las tres partes; cada artefacto declara además su propia versión de compilación.
- El **contrato de la API** (OpenAPI) es el punto de encuentro: app y firmware se prueban contra él.

## Alternativas descartadas

- **Un repositorio por parte**: tres PR coordinados por cada historia, tres CI y versiones cruzadas que hay que alinear a mano.
- **Herramientas de monorepo (Nx, Turborepo, Melos)**: útiles con muchos paquetes; con tres partes de lenguajes distintos agregan una capa sin retorno.

## Consecuencias

- `bin/verify` y `ci.yml` detectan qué partes existen; una parte nueva se suma sin tocar el gate del auto-merge.
- El firmware instalado en una puerta no se actualiza al ritmo del deploy: la API mantiene compatibilidad dentro de `v1` (ADR 0005).
