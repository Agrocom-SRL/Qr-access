# ADR 0019 — Composición del arranque de la API y patrón de presentación de la app

**Estado:** Propuesta (2026-10-09) · Precisa el ADR 0003 (registro de módulos) y el ADR 0012 (patrón de estado y plantillas).

## Contexto

`app.ts` mezcla opciones del servidor, compiladores zod, OpenAPI y registro de rutas; con los cinco módulos de ADR 0003 crecería con cada uno. En la app, `IngresoPagina` arma toda la pantalla en un solo `build()`, y el ADR 0012 fija Riverpod pero no dice qué papel cumple ni cómo se parte una pantalla.

## Decisión

### API

1. **`server.ts`** solo gobierna el proceso: carga la config, crea el pool, construye la app, cierra al recibir señales y escucha el puerto.
2. **`app.ts`** (`construirApp`) solo compone, en orden: `crearServidor` (platform/http) → plugins → plataforma (salud) → módulos. No contiene opciones ni rutas propias.
3. **`platform/http/crear-servidor.ts`**: instancia de Fastify con logger (redact), límite de body, compiladores zod y manejo de errores RFC 9457.
4. **`plugins/`**: un archivo por plugin Fastify transversal (`openapi.ts` hoy; `autenticacion.ts`, `permisos.ts`, `cors.ts`, `limite-de-peticiones.ts` cuando existan). Cada uno se exporta como `registrar<Nombre>(app)`.
5. **`src/modulos.ts`**: el **único registro** de módulos, una lista tipada `{ nombre, rutas }` que `app.ts` recorre bajo `/api/v1`. Agregar un módulo = su carpeta + una línea en esta lista. Cada `routes.ts` exporta una función `rutas(deps)` que devuelve un plugin Fastify.
6. La regla de dependency-cruiser `solo-app-registra-rutas` pasa a permitir `^src/(app|modulos)\.ts$`.

### App

1. **Patrón: Riverpod `Notifier`/`AsyncNotifier` como controlador (ViewModel) de cada pantalla**, con un estado inmutable propio (clase Dart simple, sin codegen). Flujo: `Pagina/widgets` (observan y delegan) → `Controlador` (estado de la pantalla, sin Flutter ni red directa) → `Repositorio` de `data/` → `core/api`. Sigue vigente el rechazo de Bloc del ADR 0012.
2. **Partir una pantalla**: la página solo compone; cada bloque es una clase `Widget` (nunca un método `_construirX()`, que impide `const` y reutilizar elementos). Privada (`_Encabezado`) si solo la usa ese archivo; archivo propio en `presentation/widgets/` si es de la feature; `shared/widgets/` si la usan dos features o más (atom → molecule → organism → template según su composición).
3. **Reglas de dominio de un dato** (p. ej. el PIN) viven en `domain/` como objeto de valor puro, no en el widget ni en el controlador.
4. **El controlador se crea cuando hay lógica que alojar** (envío, errores, carga), no antes: una pantalla sin acción no lleva `Notifier`.

## Alternativas descartadas

- **Bloc/Cubit**: ver ADR 0012; Riverpod ya está en el proyecto y un `Notifier` cubre lo mismo con menos archivos.
- **`setState` en cada pantalla**: no se prueba sin widgets y duplica lógica entre pantallas.
- **Auto-descubrir módulos leyendo el disco**: oculta qué se registra, rompe el tipado y el empaquetado.
- **Contenedor de inyección (awilix y similares)**: dos dependencias (`config`, `pool`) no lo justifican.
- **Capas `controllers/` y `services/` en la API**: ya descartadas en ADR 0003.

## Consecuencias

- El skill `backend-node` (estructura, "Solo `app.ts`") y `app-flutter` (providers en `presentation/`) se actualizan al aplicar este ADR.
- `test/helpers/app.ts` no cambia: `construirApp({ config, pool })` conserva su firma.
- Cada pantalla nueva se parte según la regla 2 de la app; el test de fronteras de la app sigue válido.
