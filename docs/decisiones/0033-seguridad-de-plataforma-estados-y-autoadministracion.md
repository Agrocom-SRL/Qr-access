# ADR 0033 — Seguridad de la plataforma, estados de usuario y autoadministración por cuenta

**Estado:** Propuesta (2026-10-23). Complementa los ADR 0004, 0018, 0030, 0031 y 0032. El §1 (nombres) y el §3 (qué administra cada rol) se aceptan con Miguel antes de implementar; el §2 es una lista de verificación con el estado real del código.

## Contexto

Antes de cerrar la planificación hay que responder tres cosas: si, además de los topes y las señales de abuso, hay defensas contra ataques de bots, inyección SQL, deserialización, envío masivo y robo de datos por caché o cookies; si cada cuenta (SaaS) puede administrar por completo sus usuarios, puertas y lecturas sin ver las de otra; y cómo se pasa de «caso raro» a una baja cuando hay reincidencia. Se revisó el código actual para no responder de memoria.

## Decisión

### 1. Vocabulario de estados (un solo nombre por cosa)

| Estado | Nivel | Efecto | Se revierte |
|---|---|---|---|
| **Activo** | — | Funciona todo | — |
| **Restringido** | Leve | No genera QR nuevos; conserva sesión y consulta; **sus QR ya generados siguen vivos** hasta su vencimiento | Sí, por quien lo restringió o un superior |
| **Suspendido** | Crítico | Cierra sesiones, anula sus QR vigentes y suspende toda su rama (o toda la cuenta) | Sí; los QR anulados no reviven, se generan de nuevo |
| **Eliminado** | Baja | Soft delete (`deleted_at`, invariante 8); sale de los listados y se conserva en el historial | Restaurable por AGROCOM |

Por qué estos nombres: *restringido* dice qué pasa (se limita una función) sin sugerir que el usuario ya no existe; *suspendido* es el término común para un corte temporal y reversible; *eliminado* es el soft delete. Se evitan palabras que ya significan otra cosa: **bloqueado** es el bloqueo del login por intentos fallidos (`sesion.bloqueada`, ADR 0018), **anulado** es un QR (`anulado_at`), **cancelado** es una suscripción y **pausado** es ambiguo. Se aplica igual a usuarios y a cuentas (`usuarios.estado` y `cuentas.estado`, que reemplazan al `activo` actual, más `deleted_at`).

**Quién puede cambiar un estado:** cada nivel actúa sobre su rama (ADR 0028) y AGROCOM sobre todo. Un estado impuesto por un superior **no lo levanta quien está debajo**: se guarda quién lo impuso y desde cuándo, y solo ese rol o uno superior lo revierte. Todo cambio de estado va a la bitácora con motivo obligatorio (texto libre corto) y origen (`persona`, `sistema`).

Precisiones de implementación (W4):

- **Agravar lo impuesto desde arriba queda prohibido.** Quien está debajo no puede pasar a un estado más grave un usuario que ya tiene un estado impuesto por un superior (p. ej. suspender a quien el Administrador restringió): responde 403 `estado.impuesto_por_superior`. Es una decisión conservadora, no un requisito funcional; se puede aflojar sin romper el contrato.
- **Bajar la gravedad exige el permiso del estado que se levanta**, no el del destino: pasar de suspendido a restringido pide `seguridad.usuario.suspender`.
- **Salida de los estados sin dueño.** Lo migrado (sin autor), lo impuesto por AGROCOM o por quien ya no está sobre el usuario lo levanta AGROCOM con `POST /plataforma/cuentas/:id/usuarios/:usuarioId/reactivacion` (permiso `seguridad.cuenta.editar`, motivo obligatorio). Al reasignar una rama a otro Administrador, los estados que había impuesto el Administrador anterior pasan al nuevo; los impuestos dentro de lo movido o sin autor no cambian.

### 2. Defensas de seguridad: estado real y lo que falta

Verificado en el código (2026-10-23).

| Amenaza | Hoy | Falta |
|---|---|---|
| **Inyección SQL** | SQL a mano siempre con `?`; no se encontró ninguna consulta con valores interpolados | Una regla de ESLint que prohíba plantillas en el SQL, para que no dependa de la revisión; test con cargas típicas (`' OR 1=1`, `;DROP`) en los endpoints con filtros y orden |
| **Deserialización / entradas manipuladas** | Solo JSON; cada ruta valida entrada y salida con zod (la salida también, así no se filtran campos de más); Fastify rechaza `__proto__`; el cuerpo tiene límite de tamaño | Esquemas `.strict()` donde no se esperan campos extra; límite de profundidad y de largo de arrays; validar el tipo real de los comprobantes por su firma (magic bytes) y no por la extensión |
| **Tokens (JWT)** | HS256 fijado (no se acepta `none` ni cambio de algoritmo), emisor y vencimiento verificados, `sid` revalidado contra la base en cada petición, refresh rotativo y hasheado, secreto de 32+ caracteres | Rotación de la clave de firma documentada (`kid`); migrar a clave asimétrica solo si hay más de un verificador |
| **Fuerza bruta / bots** | Limitador de intentos del login en memoria (por IP + cuenta y por cuenta) | `@fastify/rate-limit` general (ADR 0030 §3); el bloqueo por cuenta puede usarse para **dejar afuera a todos los usuarios de una cuenta**: debe ceder ante dispositivos o sesiones ya conocidos y avisar al propietario; evaluar un reto anti-bot (Turnstile o similar) solo en el login web, si hace falta |
| **Envío masivo por endpoint** | Límite de tamaño de cuerpo | Rate limit por ruta y por clave, topes de generación y `503` ante saturación (ADR 0030 y 0032) |
| **Caché de datos autenticados (URL con `.js`, *web cache deception*)** | La API no emite `Cache-Control`; `crear-servidor.ts` no define cabeceras de seguridad; el nginx del panel solo cachea `/assets/` (con hash) | **`Cache-Control: no-store` y `Vary: Authorization` en toda respuesta de la API**, errores incluidos (`onSend`); NPMplus **sin caché** para `/api/` (y sin «cache assets» sobre ese host); rutas que no existen devuelven 404 y nunca el contenido de otra ruta; test: pedir `/api/v1/sesiones/actual/x.js` no devuelve datos ni queda cacheado |
| **Robo de sesión (XSS / cookies)** | No se usan cookies; el token de acceso va en memoria y el de refresco en `sessionStorage` del panel, en `flutter_secure_storage` en la app | **CSP estricta** en el panel y en la app web (`default-src 'self'`, sin `unsafe-inline`), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS en NPMplus; revisar que no se use `dangerouslySetInnerHTML` ni `innerHTML`; mover el refresco de las apps web a una cookie `HttpOnly` con su protección CSRF (§5) |
| **CORS** | Sin plugin: solo mismo origen (el panel y la API comparten dominio) | Documentarlo como decisión; si algún día hay otro origen, lista blanca explícita |
| **Fugas por logs y errores** | `redact` de `authorization` y `cookie`; errores RFC 9457 con código | Redactar también `pin`, `contrasena`, `refresh` y `texto` del QR en los cuerpos; que un 500 no devuelva trazas |
| **Dependencias y secretos** | Dependabot; secretos fuera del repo | `npm audit` y revisión de licencias en CI; escaneo de secretos (gitleaks o el de GitHub); CodeQL para `api`, `web` y `app` |
| **Aislamiento entre cuentas** | Contexto + repositorio base que falla cerrado; test de aislamiento por endpoint | Un test global que **recorra todas las rutas del OpenAPI** y falle si alguna con datos de cuenta no tiene su prueba cuenta A → B = 404 |
| **Permisos mínimos en la base** | ADR 0007 lo declara | Verificar que el usuario de la API no tenga `UPDATE`/`DELETE` sobre `eventos_acceso` ni `bitacoras` en producción |

**Enmienda 2026-10-26 (entrada estricta).** Los cuerpos con `.strictObject` (rechazan campos de más con 400) son una excepción aceptada de endurecimiento de la entrada: cierran el mass-assignment sin cambiar el contrato de los campos válidos. `cuerpoDeMiPerfil` y `cuerpoDeEdicionDeUsuario` siguen sin `strict` por sus tests de mass-assignment actuales; pasarlos a estricto queda pendiente para una ola posterior.

### 3. Autoadministración por cuenta (SaaS)

Cada cuenta administra **todo lo suyo** sin intervención de AGROCOM, siempre dentro de su rama y de su cuenta (invariante 1):

| Qué | Administrador (propietario) | Titular | Miembro / Guardia |
|---|---|---|---|
| Usuarios | Crea, edita, restringe, suspende y elimina a Titulares y Guardias de su cuenta | Lo mismo sobre sus Miembros | Nada |
| Puertas y dispositivos | Todas las de su cuenta, dentro del plan | Solo ver las asignadas | Nada |
| Lecturas (registro de accesos) | Todas las de su cuenta, con filtros y exportación | Las de su rama | Las propias |
| QR | Ver y anular los de su cuenta | Ver y anular los suyos y los de sus Miembros | Los propios |
| **Anulación masiva** (ADR 0031 §3) | De un usuario, de una rama o de toda la cuenta | De sus Miembros y de los suyos | Los propios |
| Señales y faltas de su rama (§4) | Ve, descarta o confirma | Las de sus Miembros | Las propias |

Permisos nuevos (por acción y ámbito `cuenta`): `seguridad.usuario.restringir`, `seguridad.usuario.suspender`, `accesos.qr.anular_masivo`, `accesos.evento.exportar`, `seguridad.incidente.ver` y `seguridad.incidente.resolver`. El árbol de visibilidad del ADR 0028 impone el alcance. **Exportación:** la cuenta puede descargar sus datos (usuarios, puertas, lecturas) en CSV; se hace por la API paginada y con tope de filas, queda en la bitácora y está sujeta al rate limit. Lo que **no** administra una cuenta: su plan, su suscripción, sus topes de plataforma, ni las placas (AGROCOM).

### 4. De «caso raro» a baja: incidentes y reincidencia

1. **Incidente de uso:** tabla `incidentes_uso` (con `tenant_id`, de solo inserción para el hecho; la resolución es una fila aparte). Lo crea el sistema cuando se dispara una señal (ADR 0030 §4 y 0031 §19) o una persona lo registra a mano. Campos: usuario, tipo (`uso_masivo`, `uso_imposible`, `pin_compartido`, `qr_reenviado`, `generacion_ruidosa`, `perdida_o_robo`, `otro`), gravedad, evidencia (ids de QR y de intentos, nunca el token) y origen (`sistema` o `persona`).
2. **Resolución:** quien administra la rama lo marca como **descartado** (falso positivo), **confirmado** o **pendiente**. Confirmar exige un motivo.
3. **Reincidencia:** se cuentan los incidentes **confirmados** por usuario en una ventana móvil (por ejemplo, 3 en 30 días; valores en la configuración de plataforma, ADR 0030 §7). Un incidente aislado nunca limita nada. Al cruzar el umbral, el sistema **propone** el siguiente paso y avisa a quien administra la rama y a AGROCOM:
   - 1.ª reincidencia → **restringir** (nivel leve);
   - nueva reincidencia estando restringido → proponer **suspender**;
   - `perdida_o_robo` confirmado → proponer **suspender** de inmediato y anular sus QR vigentes.
4. **Quién aplica:** por omisión, **una persona** (el Administrador para su rama; AGROCOM para una cuenta), con un solo botón desde el aviso. Opcional por cuenta y apagado por omisión: que el sistema **restrinja** (solo el nivel leve) automáticamente al cruzar el umbral; el nivel crítico siempre lo decide una persona, para que un falso positivo no deje a una cuenta sin funcionar (consistente con el ADR 0030).
5. **Política de negocio:** los umbrales y qué incidentes cuentan para la reincidencia son comerciales y los ajusta AGROCOM; la cuenta ve la política que le aplica.

### 5. Refresco en cookie `HttpOnly` y CSRF (aceptado con Miguel, 2026-10-23)

**Qué es y qué no es CSRF.** CSRF es una petición falsificada desde otro sitio que aprovecha credenciales que el navegador adjunta solo (cookies). **No sirve contra datos basura en formularios**: eso lo frenan la validación de esquemas, el rate limit y los topes (ADR 0030). Hoy el sistema **no usa tokens CSRF ni los necesita**, porque el token de acceso viaja en la cabecera `Authorization` y el navegador no la adjunta a una petición ajena. Al introducir una cookie sí aparece esa superficie, y se cierra así.

**Decisión.** En las apps web (panel y app Flutter web, ambas en `acceso.agrocom.com.bo`) el refresco deja de guardarse en `sessionStorage` y va en una cookie:
- `__Host-refresco; HttpOnly; Secure; SameSite=Strict; Path=/` (el prefijo `__Host-` exige `Secure`, `Path=/` y ningún `Domain`). JavaScript no la lee: un XSS ya no puede **llevarse** el refresco.
- Solo la usa `POST /api/v1/sesiones/refresco` y el cierre de sesión. Esos dos endpoints, cuando reciben la cookie: (1) exigen una cabecera propia (`X-Requested-With: agrocom`), que un sitio ajeno no puede enviar sin permiso CORS; (2) comprueban que `Origin` sea el del propio dominio; (3) con `SameSite=Strict` el navegador ni la adjunta desde otro sitio. Tres capas, ninguna depende de un token por formulario.
- La **app nativa** (Android e iOS) sigue enviando el refresco en el cuerpo y guardándolo en el almacenamiento seguro: no es un navegador y no tiene CSRF. La API acepta ambas vías y rechaza la petición que traiga las dos distintas. El contrato es una adición compatible (ADR 0005).
- El token de acceso sigue en memoria y en `Authorization`. La rotación del refresco (nuevo hash en cada uso) y su detección de reuso se mantienen.

**Alcance honesto.** La cookie `HttpOnly` impide el robo del refresco, pero **no detiene a un XSS que actúe desde la propia página** (puede llamar a la API con lo que ya hay en memoria mientras la pestaña está abierta). Por eso la defensa principal contra XSS sigue siendo la CSP estricta y no usar `innerHTML` (§2); la cookie reduce el daño, no sustituye eso.

## Alternativas descartadas

- **Un solo nivel de baja:** no distingue una medida contra generar de una contra el acceso.
- **Suspensión automática sin persona:** un falso positivo dejaría a una cuenta afuera.
- **Reutilizar «bloqueado»:** ya es el bloqueo del login por intentos y se confundiría en códigos y textos.
- **Cookies para todo el sistema:** el token de acceso sigue en la cabecera `Authorization` y en memoria; la cookie es solo para el refresco de las apps web (§5). La app nativa no usa cookies.

## Consecuencias

- **Base:** migraciones `usuarios.estado` y `cuentas.estado` (con `estado_impuesto_por` y `estado_desde`), `incidentes_uso` y su resolución, y permisos nuevos en el catálogo.
- **API:** `onSend` con `Cache-Control: no-store`, cabeceras de seguridad, redacción ampliada de logs, esquemas estrictos, endpoints de estado, de anulación masiva, de incidentes y de exportación; códigos `qr.generacion_restringida`, `sesion.cuenta_suspendida`.
- **Distribución:** NPMplus sin caché en `/api/`, HSTS y CSP; CodeQL, `npm audit` y escaneo de secretos en CI.
- **App y panel:** pantallas de incidentes, estados y anulación masiva; textos en ARB y en `web/src/l10n/`.
- **Tests obligatorios:** cuenta A no ve, anula ni restringe nada de B (404); un Titular no restringe a un par ni a un superior; un estado impuesto por el superior no lo levanta el inferior; restringido no genera pero sus QR vigentes abren; suspendido arrastra a su rama y anula sus QR; la URL con `.js` no devuelve datos ni se cachea; cargas de inyección rechazadas o inertes; la reincidencia propone, no aplica, salvo el automático leve activado.
- **Orden sugerido:** cabeceras y `no-store` (rápido, alto valor) → rate limit → estados → anulación masiva → incidentes y reincidencia → exportación → CI de seguridad.
