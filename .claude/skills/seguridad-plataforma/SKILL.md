---
name: seguridad-plataforma
description: Defensa de la plataforma AGROCOM Acceso contra ataques y fugas — inyección SQL, entradas manipuladas, JWT, bots y fuerza bruta, envío masivo, caché de datos autenticados (URL con .js), XSS y cookies, CORS, logs, dependencias, permisos de base y NPMplus/nginx — más los estados restringido/suspendido/eliminado, la autoadministración por cuenta y los incidentes de uso (ADR 0033). Usar antes de agregar una ruta, un plugin, una cabecera, una configuración de proxy, un estado de usuario o una pantalla de administración.
---

# Seguridad de la plataforma

Fuente: ADR 0033 (con el estado real del código verificado el 2026-10-23), ADR 0004, 0018, 0030, 0031 y 0032. Complementa `seguridad-roles` (quién puede qué) con *cómo se defiende lo que ya existe*.

## Reglas por tipo de ataque

1. **SQL:** siempre `?`; un identificador dinámico (orden, columna) sale de una lista blanca. Ninguna plantilla de texto (`${}`) dentro de un SQL.
2. **Entradas:** toda ruta valida entrada **y** salida con zod; `.strict()` donde no se esperan extras; arrays y textos con largo máximo; archivos por su firma real, no por la extensión.
3. **JWT:** algoritmo fijado, emisor y vencimiento verificados, sesión revalidada contra la base en cada petición, refresh rotativo y hasheado. Nunca aceptar el algoritmo que dice el token.
4. **Bots y fuerza bruta:** `@fastify/rate-limit` por ruta (login y placas estrictos; generar QR moderado; dispositivo holgado) más reglas de borde (ADR 0030 §3). El bloqueo del login nunca debe poder dejar afuera a toda una cuenta.
5. **Caché de datos autenticados:** toda respuesta de la API lleva `Cache-Control: no-store` y `Vary: Authorization`, errores incluidos. El proxy no cachea `/api/`. Una ruta inexistente devuelve 404, nunca el contenido de otra. Solo se cachea lo estático con hash en el nombre.
6. **XSS y sesión:** CSP estricta sin `unsafe-inline`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS en NPMplus; nada de `innerHTML` ni `dangerouslySetInnerHTML`; el token de acceso solo en memoria y en `Authorization`. El refresco de las apps web va en la cookie `__Host-refresco` (`HttpOnly; Secure; SameSite=Strict; Path=/`) y sus endpoints exigen la cabecera `X-Requested-With` y comprueban `Origin`; la app nativa lo envía en el cuerpo (ADR 0033 §5).
6b. **CSRF no es antispam.** Los datos basura se frenan con validación, rate limit y topes. CSRF solo importa donde el navegador adjunta credenciales solo (cookies); en una ruta con `Authorization` no aplica.
7. **CORS:** sin plugin = solo mismo origen. Cualquier origen nuevo va en lista blanca explícita.
8. **Logs y errores:** nunca `authorization`, `cookie`, `pin`, `contrasena`, `refresh` ni el texto de un QR; un 500 no devuelve trazas; el cliente recibe códigos.
9. **Dependencias:** Dependabot, `npm audit`, escaneo de secretos y CodeQL en CI.
10. **Base:** el usuario de la API sin `UPDATE`/`DELETE` sobre `lecturas` ni `bitacoras`.

## Estados (vocabulario único, ADR 0033 §1)

**Activo → restringido (leve: no genera, lo ya generado sigue vivo) → suspendido (crítico: cierra sesiones, anula QR, arrastra a su rama o cuenta) → eliminado (soft delete).** No usar «bloqueado» (login por intentos), «anulado» (QR) ni «cancelado» (suscripción) para esto. Un estado impuesto por un superior solo lo levanta ese rol o uno superior; todo cambio lleva motivo y va a la bitácora.

## Autoadministración y aislamiento

Cada cuenta administra sus usuarios, puertas, lecturas y QR dentro de su rama; el Administrador ve toda la cuenta, el Titular su rama. Anulación masiva y exportación son permisos por acción de ámbito `cuenta`. Nada cruza cuentas: cuenta A pidiendo algo de B → 404. Un test recorre el OpenAPI y exige la prueba de aislamiento de cada ruta con datos de cuenta.

## Incidentes y reincidencia (ADR 0033 §4)

Un caso raro crea un **incidente**; quien administra la rama lo descarta o lo confirma con motivo. Los confirmados en una ventana móvil cuentan para la reincidencia, que **propone** restringir y luego suspender. Aplicar es de una persona; solo la restricción automática es opcional por cuenta y viene apagada. `perdida_o_robo` confirmado propone suspender de inmediato.

## Tests mínimos

Inyección en filtros y orden; URL con `.js` sin datos ni caché; cabeceras en la API y el panel; rate limit con `Retry-After`; aislamiento por ruta; estados y cascada; un inferior no levanta el estado del superior; exportación acotada y con bitácora.

## Qué no hacer

Cachear `/api/`; agregar `unsafe-inline` a la CSP; dejar un log con un secreto; automatizar la suspensión; comparar el permiso en la app en lugar de la API.
