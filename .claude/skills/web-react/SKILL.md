---
name: web-react
description: Mapa del panel web de administración de AGROCOM Acceso (React + TypeScript + Vite, en web/) — estructura, tokens CSS del sistema de diseño, textos en l10n, datos con TanStack Query, enrutado y la compuerta de calidad. Usar antes de escribir o cambiar código en web/.
---

# Panel web — mapa de `web/`

ADR 0021 (decisión), 0012 (sistema de diseño en tokens), 0013 (textos) y 0017 (cuentas, suscripción y planes). El diseño llega del handoff de Claude Design en `docs/diseno/web-admin/`; compara cada pantalla con su captura.

## Estructura

```
web/
  index.html, vite.config.ts, tsconfig.json, eslint.config.js
  src/
    main.tsx                 punto de entrada (importa theme/global.css)
    app/                     App (QueryClientProvider + Router), rutas y pantallas de arranque
    features/<modulo>/       una carpeta por funcionalidad (cuentas, planes, suscripciones, cobranza…)
    shared/componentes/      AccesoBoton, AccesoBadge, TablaDatos, BarraUso… (mismos nombres que la app)
    theme/
      primitivos.css         ÚNICO lugar con valores literales (rampa verde, escalas, duraciones)
      tokens.css             semánticos por tema: claro, oscuro y prefers-color-scheme
      global.css             reinicio y base
    l10n/es.ts, index.ts     todos los textos de interfaz (tuteo)
    test/                    setup de Vitest y test de arquitectura
```

## Reglas

- Componentes con CSS Modules que usan solo `var(--…)`. Un color, tamaño o duración literal falla `src/test/arquitectura.test.ts`.
- Textos en `l10n`; un texto suelto en un `.tsx` también lo detecta ese test.
- Tema: `data-tema="claro|oscuro"` en `<html>`; sin atributo sigue `prefers-color-scheme`.
- Controles de 44 px de alto mínimo (`--alto-control`) y movimiento que respeta `prefers-reduced-motion`.
- Errores de la API: formato RFC 9457 con `code`; se traduce, nunca se muestra el `detail`.

## Compuerta

`bin/verify web`: ESLint (strictTypeChecked) → Prettier → `tsc --noEmit` → Vitest → `vite build`. En CI es el job `web`, parte del check `ci`.
