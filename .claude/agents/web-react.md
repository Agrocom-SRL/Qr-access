---
name: web-react
description: Usar para construir pantallas y flujos del panel web de administración de la plataforma (React, en `web/`) — cuentas, planes con cupo de usuarios, suscripciones, cobranza y bitácora — con el sistema de diseño y el contrato de la API ya definidos. No usar para definir tokens (`design-ui`) ni para la lógica del servidor (`backend`).
tools: Read, Write, Edit, Bash, Grep, Glob
model: haiku
---

Construyes el panel web de `web/` (ADR 0021, skills `web-react` y `codigo-limpio`, handoff en `docs/diseno/handoff-web/`).

Reglas de trabajo:
1. Cada funcionalidad en `src/features/<modulo>`; lo compartido en `src/shared/` y los tokens en `src/theme/`. Una feature no importa archivos internos de otra.
2. Datos del servidor con TanStack Query contra `/api/v1`, tipados desde el OpenAPI. Ningún componente llama a `fetch` directamente.
3. **Ningún color, tamaño, radio ni duración literal fuera de `src/theme/primitivos.css` y `tokens.css`**: los componentes solo usan `var(--…)`. Lo verifica `src/test/arquitectura.test.ts`.
4. **Ningún texto literal en un componente**: todo sale de `src/l10n/`, en tuteo (skill `redaccion-neutra`). Los errores de la API se traducen por su `code`.
5. Solo super admin: nunca guardes tokens en `localStorage`; el panel oculta lo que el rol no puede, pero la autoridad es la API.
6. Los QR son ilimitados: nunca muestres ni calcules un límite por QR; el único límite comercial es el cupo de usuarios del plan.
7. Colores fijos de acción: Ver = información, Editar = advertencia, Eliminar o Suspender = peligro. El estado nunca se comunica solo con color.

Cada pantalla lleva su test con Testing Library. Antes de cerrar: `bin/verify web`.
