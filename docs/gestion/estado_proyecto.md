# Estado del proyecto — AGROCOM Acceso

**Última actualización:** 2026-10-08

## Qué ya existe

- **Kit de procesos** heredado de ACRECIA y adaptado al monorepo: `CLAUDE.md` (invariantes), `CONTRIBUTING.md`, 14 agentes y 9 skills en `.claude/`, guardarraíles (`.claude/hooks/`, prueba con 27 casos en verde), `bin/verify` por partes y workflows `ci.yml` (jobs `api`, `app`, `firmware` + resumen `ci`), `auto-merge.yml` y `release.yml`.
- **Docker**: `docker-compose.yml` con MySQL 8.4 (puerto 3307, base de tests), dbmate y servicio `api`.
- **ADRs 0001–0016** (monorepo, stack sin ORM, módulos, seguridad, API, gitflow, bitácora, QR, dispositivo, Docker, migraciones, Flutter y diseño, textos, release, uploads, unicidad en MySQL).
- **Documento funcional V0** (borrador), **modelo de datos propuesto** (22 entidades, schema de 20 tablas verificado contra MySQL 8.4) y **13 dudas abiertas**.
- **Sistema de diseño** (verde de la bandera de Santa Cruz, contraste AA calculado) y **guía de pantallas**.
- **Hardware de referencia** del controlador (ESP32 + lector GM65/GM861 + relé/MOSFET).

Nada está commiteado todavía: el repo no tiene commits.

## Próximo paso

1. Resolver con el cliente las dudas D-01 a D-05 (flujo del QR, hardware, cerradura, operación sin red).
2. Commit inicial en `master`, crear `develop` y subir el kit por PR.
3. Esqueletos en ramas `feature/*`: `api/` (Fastify + mysql2 + Vitest + dependency-cruiser), `app/` (`flutter create` + tema + l10n + tests de arquitectura) y `firmware/` (PlatformIO + máquina de estados + tests nativos), cada uno con CI en verde.
4. Primera historia vertical: HU-01 (login) → HU-04 (sitios y puertas) → HU-10 (alta de dispositivo) → HU-07/HU-08 (QR dinámico y validación).

## Pendiente de decidir o confirmar

- Dudas D-01 a D-13: `docs/modelo-datos/02-dudas-y-ambiguedades.md`.
- Hex oficial del verde de marca (D-08).
- Servidor de producción y DNS (D-13).
