# ADR 0021 — Web admin de la plataforma: React en `web/`

**Estado:** Aceptada (2026-10-12) · Complementa el ADR 0001 (monorepo) y el ADR 0017 (cuentas, suscripción y planes).

## Contexto

AGROCOM Acceso es un SaaS: cada cuenta (empresa cliente) paga una suscripción anual con un plan que fija su **cupo de usuarios** (100, 200 o 350); los QR son ilimitados (ADR 0017). No hay registro público: el equipo de AGROCOM crea las cuentas, define el plan, renueva y cobra. Ese trabajo de plataforma (super admin, `tenant_id NULL`, ADR 0004) necesita un panel web propio. La app Flutter (ADR 0012) sirve a usuarios, administradores y guardias de una cuenta; mezclarle la operación de la plataforma mezclaría dos públicos y dos conjuntos de permisos.

## Decisión

- **Una parte nueva del monorepo: `web/`**, dentro del mismo repositorio (ADR 0001). Mismo gitflow, mismo `bin/verify` y misma CI: se suma un job `web` y el check resumen `ci` lo incluye.
- **Stack**: Vite + React + TypeScript estricto. Enrutado con React Router y datos del servidor con TanStack Query. Sin framework de servidor: es un panel interno que se sirve como estáticos.
- **Sistema de diseño en tokens, el mismo de la app** (ADR 0012): primitivos (`src/theme/primitivos.css`, único lugar con valores literales) → semánticos por tema claro y oscuro (`tokens.css`) → componentes que solo usan `var(--…)`. Ningún componente lleva un color, tamaño, radio ni duración literal. Los nombres de los componentes son los de la app (`AccesoBoton`, `AccesoBadge`, `PlantillaAdmin`…) con los suyos propios del panel (`TablaDatos`, `BarraUso`, `TarjetaPlan`).
- **Textos** fuera de los componentes, en `src/l10n/` (español con tuteo; ADR 0013). La API responde códigos de error y el panel los traduce (ADR 0005).
- **Contrato**: el panel consume `/api/v1` y se tipa desde el OpenAPI de la API; no inventa campos. Los endpoints de plataforma son del super admin y exigen su permiso (ADR 0004): el panel oculta lo que el rol no puede, pero la autoridad es siempre la API.
- **Sesión**: el super admin ingresa con usuario y contraseña (ADR 0018). Los tokens no se guardan en `localStorage`.
- **Pruebas**: Vitest + Testing Library; un test de arquitectura prohíbe valores de color literales fuera de los tokens y textos de interfaz fuera de `l10n`.
- **Compuerta** (`bin/verify web`, mismo orden que CI): ESLint, Prettier, `tsc --noEmit`, Vitest y `vite build`.

## Alternativas descartadas

- **Sumar el panel a la app Flutter web**: obliga a cargar el panel de plataforma en la app de todos los usuarios y mezcla permisos de ámbito distinto.
- **Next.js u otro framework con servidor**: agrega un servidor que operar y desplegar para un panel que no necesita SEO ni render en servidor.
- **Repositorio aparte**: dos PR por cada cambio de contrato y una CI más; el proyecto es chico (ADR 0001).

## Consecuencias

- El login por PIN y el rol activo no existen en el panel: solo super admin.
- La API necesita los endpoints de plataforma (cuentas, planes con cupo de usuarios, suscripciones y pagos, bitácora). Se construyen en el módulo `suscripciones` y sus contratos (ADR 0003); este ADR no los define.
- El diseño de las pantallas llega del handoff de Claude Design en `docs/diseno/web-admin/`. Ver el ADR 0022, que ajusta la estructura de carpetas y los textos.
