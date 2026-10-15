# ADR 0027 — Modo sin conexión de la app: caché de lecturas en SQLite

**Estado:** Aceptada (2026-10-15)

## Contexto

Sin internet la app dejaba de mostrar puertas, eventos y QR. La sesión ya se conserva (refresco en almacén seguro más última sesión en preferencias) y el último QR propio ya se guarda como respaldo (ADR 0008, addendum). Faltaba conservar las últimas lecturas de la API.

## Decisión

1. **Caché de lecturas en el cliente HTTP.** Un interceptor de `dio` (`core/api/interceptor_cache.dart`) guarda la respuesta de cada `GET` con sesión y, si el servidor no responde (`red.sin_conexion`), entrega la última guardada del mismo recurso. No hay modelos de caché por feature: lo guardado es el JSON del contrato.
2. **Solo lecturas.** Las escrituras sin red fallan como siempre. La caché no decide nada de seguridad: la puerta abre solo con la validación del servidor (invariante 2) y los permisos siguen siendo los de la API (ADR 0004).
3. **Aislamiento (invariante 1).** La clave lleva usuario y rol activo; sin sesión no se guarda ni se sirve nada; al cerrar sesión o caducar el refresco se vacía toda la caché.
4. **Almacén por plataforma** (`AlmacenCache`): SQLite (`sqflite`, tabla `cache_respuestas`) en móvil, descartando lo de más de 30 días; memoria en web, como el refresco.
5. **Aviso.** Mientras se muestren datos guardados, la plantilla de la app muestra "Sin conexión. Datos de las HH:mm." (`datosGuardadosProvider`); desaparece cuando el servidor vuelve a responder.

## Alternativas descartadas

- **Un repositorio local por feature** (modelos y tablas propias): más código y más migraciones locales para el mismo resultado de lectura.
- **Guardar el token de los QR de terceros**: el texto de un QR sigue sin guardarse salvo lo que ya define el ADR 0008.

## Consecuencias

- Lo mostrado sin red puede estar desactualizado (por ejemplo, el estado en línea de una puerta); por eso el aviso lleva la hora de los datos.
- Un cambio de rol o de usuario nunca reutiliza la caché del anterior.
