# ADR 0022 — Web admin: estructura, i18n con i18next y reglas de cobranza

**Estado:** Aceptada (2026-10-12) · Ajusta el ADR 0021 y desarrolla el ADR 0017.

## Contexto

El handoff de diseño del panel (`docs/diseno/web-admin/`) pide pantallas de cuentas, suscripciones, cobranza, planes, bitácora y equipo. El ADR 0021 dejó el esqueleto de `web/` con textos en un `l10n/es.ts` propio (el nombre viene de Flutter, ADR 0013) y la API no tiene aún los endpoints de plataforma. El panel es la base: lo que sus pantallas muestran y la API no ofrece se construye en la API.

## Decisión

- **Estructura**: `web/src/{app,features,shared,theme,l10n}`. Cada `features/<modulo>` lleva el nombre del módulo de la API y se parte en `domain/` (reglas puras), `api/` (repositorio por interfaz y su implementación HTTP), `application/` (hooks de caso de uso) y `ui/`. Solo se importa otro módulo por su `index.ts`. Los componentes compartidos van en `shared/ui/{atoms,molecules,organisms,templates}`, con los nombres de la app.
- **Textos con i18next** (`i18next` + `react-i18next`), el estándar de React. Siguen viviendo en `web/src/l10n/`, ahora como JSON por namespace (uno por módulo, más `comun` y `errores`). Español con tuteo; `en` queda preparado con las mismas claves. Fechas, montos y números con `Intl`. Los errores de la API llegan como `code` y se traducen en `errores.*`.
- **Tokens**: los del handoff, tal cual (`acceso-tokens.css`), con `data-tema` en `<html>`.
- **Cambio de plan**: solo **a un plan superior**. Nunca se baja de plan en mitad de la suscripción, porque no se devuelve dinero. La diferencia de precio se cobra al cambiar. Bajar de plan solo ocurre al renovar.
- **Cobranza manual** (D-15): AGROCOM registra cada pago (monto, fecha, medio, referencia). La tabla `pagos` es de plataforma, de solo inserción. El precio anual vive en `planes.precio_anual` y solo afecta renovaciones y cambios futuros.
- **Endpoints de plataforma**: se construyen en la API uno por cada pantalla del panel, con permisos de ámbito `plataforma` (ADR 0004), bitácora (ADR 0007) y OpenAPI.

## Consecuencias

- El panel y la API avanzan juntos, una rama por proceso.
- El diseño de A06b (bajada bloqueada por cupo) pasa a ser "bajar no está permitido".

## Addendum (2026-10-12): el refresco sobrevive a la recarga

El token de acceso sigue solo en memoria, pero el de refresco se recuerda en el `sessionStorage` de la pestaña: recargar o escribir otra URL ya no cierra la sesión; cerrar la pestaña o la sesión lo borra (nunca `localStorage`). Al arrancar, `restaurar()` lo rota y trae el perfil. Riesgo asumido: un XSS podría leerlo; se resuelve con la cookie httpOnly cuando la API la soporte.

## Addendum (2026-10-15): la app Flutter web aplica el mismo criterio

La app Flutter en su versión web (ADR 0012) también guarda el refresco en el `sessionStorage` de la pestaña (`almacen_refresco_web.dart`): recargar la página no cierra la sesión; cerrar la pestaña o la sesión lo borra, nunca `localStorage`. El acceso sigue solo en memoria. La caché de datos y el texto de los QR generados siguen solo en memoria en web. Mismo riesgo asumido y misma salida: la cookie httpOnly cuando la API la soporte.
