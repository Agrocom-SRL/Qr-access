# ADR 0003 — Modularización: módulos por funcionalidad con fronteras verificadas

**Estado:** Aceptada (2026-10-08) · **Origen:** ADR 0003 de ACRECIA (contratos y eventos entre módulos), adaptado a Node y Flutter. Precisada por ADR 0019 (registro de módulos).

## Contexto

En ACRECIA la regla que sostuvo la coherencia fue "entre módulos, solo contratos o eventos", verificada por un test de arquitectura. Se conserva la regla; cambia la forma, porque en Node y en Flutter lo idiomático es carpeta por funcionalidad.

## Decisión

### API (`api/src/`)

- `modules/<modulo>/` en español, uno por funcionalidad: `seguridad`, `suscripciones`, `organizacion`, `accesos`, `dispositivos` (nombres provisionales hasta que reciban código).
- Transversal en inglés: `platform/` (db, contexto, bitácora, errores, seguridad) y `plugins/`.
- Dentro de un módulo: `routes.ts`, `schemas.ts`, `actions/`, `repository.ts`, `domain/`, `contracts.ts`, `events.ts` (detalle en el skill `backend-node`).
- **Un dueño por tabla**: solo el repositorio del módulo dueño la escribe.
- **Entre módulos, solo `contracts.ts` (síncrono) y `events.ts` (asíncrono)**. Nunca el repositorio, las acciones, el dominio ni el SQL de otro módulo.
- `domain/` es puro (sin base ni red).
- Lo verifica **dependency-cruiser** en `bin/verify` y CI.

| Módulo | Alcance |
|---|---|
| `seguridad` | Cuentas, usuarios (PIN), roles, permisos, sesiones, rol activo |
| `suscripciones` | Planes, suscripciones y límites (ADR 0017) |
| `organizacion` | Sitios y puertas |
| `accesos` | Emisión y anulación de QR, validación, eventos de acceso |
| `dispositivos` | Alta, credencial, latido, configuración, OTA |

### App (`app/lib/`)

- `features/<feature>/{data,domain,presentation}` + `<feature>.dart` como única superficie pública.
- Transversal: `core/` y `shared/widgets/`.
- Lo verifica `test/arquitectura/fronteras_test.dart`.

### Firmware (`firmware/`)

- `lib/` puro (máquina de estados, parseo), `src/` por responsabilidad de hardware. Sin reglas de negocio.

## Alternativas descartadas

- **Por capa técnica arriba** (`controllers/`, `services/`, `repositories/`): dispersa una funcionalidad en muchas carpetas; fue lo que ACRECIA heredó de Laravel, pero no es lo idiomático en Node ni en Flutter.
- **Clean Architecture ortodoxa** (entidad + puerto + adaptador por modelo): impuesto de mantenimiento sin retorno a esta escala.

## Consecuencias

- Un módulo nuevo queda protegido por las reglas de dependency-cruiser por patrón, sin editar la configuración.
- La regla de "un dueño por tabla" se revisa en el PR.
