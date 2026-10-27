# ADR 0030 — Límites de uso, detección de abuso y notificaciones

**Estado:** Aceptada (2026-10-23), salvo el canal de las notificaciones (§6), que queda como propuesta. Enmienda el ADR 0017 (los QR dejan de ser ilimitados).

## Contexto

La app se publica al público y no hay certeza de cómo se usará en el mundo real. Hay tres riesgos distintos:

1. **Ataques de rendimiento o estrés** (bots, malware, una sesión robada) que quieran tumbar la API: generar QR sin freno, golpear el login o los endpoints de dispositivos, agotar el pool de MySQL.
2. **Usuarios fantasma o conflictivos** dentro de una cuenta (Administrador, Titular, Miembro o Guardia): sin actividad por mucho tiempo, o con una generación de QR que consume el plan sin que se usen.
3. **Uso de mala fe del plan:** una cuenta del plan barato que crea pocos usuarios (por ejemplo, los guardias de un condominio) y los usa de porteros, generando QR propios para dejar entrar a todos los vecinos y visitantes, en lugar de que cada uno tenga su usuario.

Hoy solo existe el limitador de intentos del login (ADR 0018, en memoria) y las estadísticas informativas del ADR 0028 (inactivos, ruidosos, Titulares cerca del tope). No hay rate limit general, ni tope en `generar-qr`, ni aviso cuando alguien se pasa. Además, el ADR 0017 declara los QR ilimitados.

## Decisión

### 1. Lo que nunca se limita

**Validar un QR no tiene límite de cantidad.** La lectura del lector en la puerta y la consulta del dispositivo a la API (ADR 0008 y 0009) no se cortan por cuota, ni por consumo, ni por cuenta suspendida de generación: quien ya tiene un QR vigente entra, y las aperturas físicas (pulsador y llave) no se tocan. El límite es **solo para generar QR nuevos**. La protección del endpoint de validación frente a un flood (§3) no es una cuota de negocio: se mide por credencial de dispositivo y con un umbral muy por encima de cualquier uso real.

### 2. Los QR dejan de ser ilimitados (enmienda al ADR 0017)

Para el cliente el plan se sigue viendo "sin límite de QR": con un flujo normal nunca lo toca. Internamente la plataforma lo controla con tres mecanismos:

- **Tope diario por usuario**, global y no por plan (cada usuario cuenta lo suyo, sea cual sea el tamaño de la cuenta). Superarlo hace que la API responda **429** con el código `qr.limite_diario` (RFC 9457) y **no bloquea** al usuario: puede volver a generar al día siguiente. El valor inicial lo fija AGROCOM en configuración (§7).
- **Tope de QR vigentes sin usar por usuario**, también global, para que un bot no acumule miles de tokens que ocupan la tabla. Código `qr.limite_pendientes`.
- **Bolsa de QR por cuenta y por mes (cupo de consumo).** Número fijo por plan al inicio. **Por ahora no hay corte**: superarlo solo se registra y se avisa (§5), y se negocia con el propietario de la cuenta. El corte (o una recarga estilo telefonía) queda como decisión futura, cuando haya datos reales; si llega, afectará únicamente a generar, nunca a validar (§1).

### 2.1. QR propio: se reutiliza mientras no se use

El QR propio ("Mi QR de acceso") es de un solo uso y hoy cada generación anula el anterior. Quien entra y sale de esa pantalla repetidas veces, sin usar el QR, genera y anula tokens para nada (y así trabaja también quien hace de portero, ver §4). Regla nueva:

1. **Mientras el QR propio anterior siga activo** (no usado, no anulado, no vencido) **y sea para las mismas puertas**, pedir "Mi QR" **no genera nada**: la API responde 200 con `reutilizado: true` y el estado del QR vigente (vencimiento, puertas), sin crear ni anular ningún registro.
2. **El token no se puede devolver:** el servidor solo guarda su hash (invariante 6). Por eso la app guarda el token que recibió al generarlo en el almacenamiento seguro del dispositivo, y al reabrir la pantalla consulta el estado del QR (`consultar-estado-qr`): si sigue activo, lo vuelve a mostrar desde su copia local; si ya se usó, venció o fue anulado, pide uno nuevo.
3. **Si la app no tiene el token** (reinstalación, otro dispositivo, navegador limpio) pero el servidor tiene uno activo, el usuario puede pedir **reemplazarlo**: el anterior queda anulado y se genera otro. Cuenta como "reemplazo sin uso".
4. **Cuando el QR anterior ya se usó** (o venció), pedir uno nuevo es una generación normal, sin espera, sujeta solo a los topes del §2.
5. **Reemplazos sin uso:** como máximo **5 por día** por usuario y con **2 minutos de espera** entre uno y otro. Pasarse responde 429 con `qr.limite_propios_sin_uso` (y `Retry-After` si es por la espera). No bloquea al usuario: solo frena el ciclo generar-anular-generar. Los valores son de partida y se afinan con datos reales (§7).
6. **Cambiar las puertas** del QR propio cuenta como reemplazo (es otro QR), pero el tope diario es holgado para no molestar a quien de verdad entra por puertas distintas.

Esto no toca la puerta: un QR propio vigente y sin usar sigue abriendo igual (§1). La regla solo evita generar tokens inútiles.

### 2.2. QR propio usado con flujo dudoso

Si el QR sí se usa pero el patrón es dudoso (uso masivo por día, uso en puertas distintas con una diferencia de tiempo físicamente imposible, o ciclos de generar-usar-generar de pocos minutos todo el día; ver §4), **no se corta nada**: el uso se acepta y se registra, y se notifica al **propietario de la cuenta y a los administradores de AGROCOM** (§5). La persona decide qué hacer.

### 3. Protección de la API contra estrés y bots

En capas, de la más barata a la más fina:

1. **Borde (NPMplus/Nginx):** `limit_req` y `limit_conn` por IP, tope de tamaño de cuerpo y timeouts cortos. Frena el flood antes de que llegue a Node. Va por el despliegue (`docs/gestion/despliegue.md`).
2. **API, `@fastify/rate-limit`** con clave por IP y, si hay sesión, por usuario; por dispositivo en las rutas de dispositivo. Límites por tipo de ruta: login y anuncio de placas, muy estrictos; generar QR, moderado (por ejemplo, ráfagas cortas por minuto además del tope diario); validación de dispositivo, por credencial y holgado; lecturas, holgado. Las respuestas son 429 con `Retry-After`.
3. **Estado compartido:** con una sola instancia (V1) el contador puede vivir en memoria. Con más de una, sale a Redis o a la base; el limitador del login entra en el mismo cambio (hoy está anotado como pendiente en `estado_proyecto.md`).
4. **Pool de MySQL y timeouts:** el pool de 10 conexiones se revisa junto con un tiempo máximo por consulta y por petición, para que unos pocos clientes lentos no lo agoten.
5. **Pruebas de carga** (por ejemplo `k6`) contra un entorno de prueba antes de abrir la app al público; nunca contra producción.

   Las pruebas de carga con un cliente HTTP real destaparon que la validación de QR respondía `503` por usar `request.signal` como presupuesto (detalle y corrección en el ADR 0032 §1, "Hallazgo y corrección"). El tope de petición de los dispositivos es un plazo propio (`presupuestoDePeticion`), y la API debe probarse también con servidor real, no solo con `app.inject()`.

**Implementado (ola W3, API):** `@fastify/rate-limit` en `api/src/plugins/limites.ts`, registrado después de la autenticación. Cuenta por (clase de ruta, identidad): el dispositivo por su credencial, el usuario por su sesión y, sin sesión, la IP; una cabecera sin verificar nunca elige la clave. Ventana de un minuto; el contador está en memoria (una instancia, V1). Pasado el tope responde `429` `limite.excedido` con `Retry-After`. Valores por defecto (todos en variables `LIMITE_*_POR_MINUTO`, ver `.env.example`):

| Clase | Rutas | Clave | Por defecto |
|---|---|---|---|
| `login` | `POST /sesiones`, `POST /plataforma/sesiones` | IP | 20 |
| `refresco` | `POST /sesiones/refresco` | IP | 60 |
| `anuncio` | `POST /dispositivos/anunciar` y `/confirmar` | IP | 20 |
| `generar_qr` | `POST /qr-accesos` | usuario | 10 |
| `escritura` | el resto de POST/PUT/PATCH/DELETE | usuario (o IP) | 60 |
| `lectura` | GET | usuario (o IP) | 240 |
| `validacion` | `POST /dispositivos/validaciones` | dispositivo | 600 |
| `dispositivo` | latidos y configuración | dispositivo | 120 |

La validación nunca usa el límite de un usuario; su tope es anti-flood por credencial. Un `429` en ella llega antes de consumir el QR y el firmware lo trata como "sin respuesta" (no abre). Queda pendiente el limitador compartido para más de una instancia (punto 3).

**IP del cliente y autenticaciones fallidas (auditoría W3).** La IP sale de `X-Forwarded-For` solo con `TRUST_PROXY` como número de saltos (por omisión 1) o lista de IP/CIDR, nunca `true`; el Nginx de delante sobrescribe la cabecera (`docs/gestion/despliegue.md`). Las autenticaciones fallidas (JWT o credencial de dispositivo inválidos) se cuentan por IP (`LIMITE_FALLOS_AUTENTICACION_POR_MINUTO`, 30 por omisión): pasado el tope, esa IP recibe `429` durante el resto de la ventana sin que se verifique su credencial. Los aciertos no consumen, y un dispositivo que autenticó bien desde esa IP en los últimos 15 minutos se sigue verificando (IP compartida de un sitio). Todo en memoria y acotado (una instancia).

### 4. Estadísticas: qué se considera sospechoso

Las estadísticas siguen siendo **informativas**: no disparan una baja ni un corte; decide una persona. Se ajustan y se amplían:

| Señal | Regla | Qué detecta |
|---|---|---|
| **Fantasma** | Sin QR generados en 30 días y con más de 30 días de antigüedad (sin cambio) | Cuentas llenas de usuarios que no usan el plan |
| **Ruidoso** | Más de **20** QR generados **y no usados** en un mismo día (antes, 10 de cualquier tipo). Un QR usado no suma | Bots, errores o abuso de generación |
| **Uso masivo** (nueva) | Más de N aperturas con QR propio de un mismo usuario en un día; N distinto por rol (para el Guardia, bajo) | El Guardia o usuario que hace de portero de todos |
| **Uso imposible** (nueva) | Dos usos del mismo usuario en puertas distintas con una diferencia de tiempo que no alcanza para ir de una a otra | QR propio compartido con otra persona |
| **Ciclo generar-usar** (nueva) | Un QR propio usado y otro generado a los pocos minutos, repetido durante el día | El portero que abre con su QR a cada persona |
| **Flujo atípico de cuenta** (nueva) | Aperturas por día divididas entre usuarios activos, muy por encima de lo habitual para el plan | El plan barato usado como portería de muchos |
| **Altas en ráfaga** (nueva) | Muchos usuarios creados en poco tiempo por un mismo Administrador o Titular, aunque no llegue al tope | Creación de usuarios "a diestra y siniestra" |
| **Tasa de uso** (nueva) | Generados / usados por usuario, junto al volumen | Distinguir flujo real de abuso: muchos generados y pocos usados es sospechoso; muchos generados y muchos usados es una puerta con tráfico |
| **Titular cerca del tope** | 80 % del tope de Miembros (sin cambio) | — |

Los umbrales empiezan como constantes en el código (como hoy en `actividad-de-usuarios.ts`) y se pasan a configuración (§7) cuando haya datos.

### 4.1. Un mismo usuario en varios dispositivos o en la web

**Iniciar sesión en varios dispositivos (o en la app web) nunca se bloquea.** Una persona legítima puede tener teléfono, tablet y navegador a la vez. Lo que se vigila es el patrón, no el hecho de tener varias sesiones.

**Qué se registra.** La tabla `sesiones` ya guarda `agente`, `ip` y fechas. Se le agregan una **instalación** (un identificador aleatorio que la app genera y guarda localmente la primera vez; en la web, en el navegador) y la **plataforma** (`android`, `ios` o `web`). Y cada QR generado guarda la sesión con la que se generó, para poder relacionar un uso en una puerta con el dispositivo que lo creó. Son datos operativos: no llevan secretos, y se tratan como tal (invariante 6).

**Qué se vigila.** Cada señal por separado es informativa; lo que sube de gravedad es la **combinación**:

| Señal | Qué dice | Gravedad por sí sola |
|---|---|---|
| Varias instalaciones activas de un mismo usuario | Un PIN compartido, o una persona con varios aparatos | Baja: se ve en su ficha, no se avisa |
| Muchas instalaciones nuevas en poco tiempo, o muchas IP distintas a la vez | Un PIN filtrado o repartido | Media: se avisa |
| **Uso imposible** (§4): QR de un mismo usuario usados en puertas distintas con un tiempo que no alcanza | Dos personas usando el mismo usuario a la vez | Alta: se avisa |
| Varias instalaciones **y** uso masivo o ciclo generar-usar | Un PIN que opera como portería con varios aparatos | Alta: se avisa |

La relación entre sesión y QR es lo que separa a quien usa dos aparatos de quien presta su usuario: los QR de uno aparecen siempre cerca (misma puerta o puertas de un mismo recorrido), los de dos personas aparecen lejos y a la vez.

**Qué se le da a quien administra** (sin bloquear ningún ingreso por sí solo):
- **Lista de dispositivos conectados** de cada usuario, con plataforma, última actividad y IP, visible para el propietario de la cuenta (la de su cuenta) y para AGROCOM (todas).
- **Cerrar una sesión** concreta, o todas las de un usuario, y **regenerar su PIN** (ya existe). Es la respuesta al PIN filtrado: el usuario legítimo vuelve a entrar con el nuevo.
- **Aviso al propietario y a AGROCOM** cuando se cumple una combinación de gravedad media o alta, con el mismo criterio del §5 (una vez por evento y día).

**Debilidad que se asume.** Un PIN compartido es un punto débil del modelo de negocio: nada técnico impide que dos personas conozcan el mismo PIN. Se mitiga con detección y con la vía comercial (§5), no con bloqueo. Si en la práctica el compartir PIN entre turnos de guardias es habitual, se evalúa en su momento una regla propia (por ejemplo, un usuario por turno).

### 5. Quién ve qué y cuándo se avisa

- **El propietario de la cuenta** (Administrador) ve las estadísticas de **su** cuenta, en la app, con baja directa de un usuario (ya existe, #67). Aislamiento por cuenta como siempre (invariante 1).
- **AGROCOM** ve todo en el panel web: una lista de cuentas ordenable por consumo de la bolsa y por flujo atípico, y el detalle de cada cuenta con sus usuarios ruidosos, el uso masivo y el consumo por día. Desde ahí sube el tope de un usuario o amplía la bolsa de la cuenta; ambas acciones quedan en la bitácora.
- **Se avisa al propietario de la cuenta y a AGROCOM** cuando: un usuario supera el tope diario (`qr.limite_diario`); una cuenta cruza el 80 % de su bolsa mensual; una cuenta supera el 100 % (sin corte, §2); o se dispara una señal del §4. No se avisa dos veces por el mismo evento en el mismo día.
- Un pico de un día es normal; lo que importa es la persistencia (una semana entera con el tope alto). El panel muestra la serie por día para que la persona lo juzgue.
- **El caso del condominio** (guardias que generan para los vecinos) no se corta automáticamente: se detecta con "uso masivo" y "flujo atípico de cuenta" y se **negocia con el propietario** (que compre el plan de más usuarios, o lo regularice). Es un tema comercial, no técnico.

### 6. Notificaciones (propuesta)

Las notificaciones para propietario y AGROCOM necesitan un canal. Se propone por pasos, para no depender de un servicio con costo incierto en el lanzamiento:

1. **Primero, una bandeja de notificaciones propia:** tabla `notificaciones` (con `tenant_id` y destinatario) y endpoints para listarlas y marcarlas leídas. La app las muestra con una insignia y el panel web también. No depende de ningún tercero y sirve para Android, iOS y web.
2. **Después, push nativo con Firebase Cloud Messaging (FCM).** FCM es gratuito y sin costo por mensaje; en iOS pasa por APNs a través de FCM, que es el único camino a las notificaciones push de iOS (requiere la cuenta de desarrollador de Apple, que se necesita igual para publicar). El costo de Firebase que preocupa no es el de FCM. Supabase **no** es un proveedor de push (su Realtime solo notifica con la app abierta), así que no lo reemplaza y agregarlo sumaría otro servicio sin resolver el push.
3. Opcionalmente, un correo al propietario (la cuenta ya guarda el correo del responsable) para los avisos de bolsa.

La bandeja (paso 1) se implementa con este ADR; el push (paso 2) se decide aparte cuando se publique la app.

### 7. Configuración y registro

- Los topes y umbrales viven en una configuración de plataforma que AGROCOM edita desde el panel, con valores iniciales por defecto y bitácora de cada cambio. Un tope puede tener excepción por usuario o por cuenta (el que se sube tras analizar un pico).
- Cada vez que se rechaza una generación por límite queda un registro. Los intentos de **acceso** siguen yendo a `eventos_acceso` (invariante 4); los rechazos de **generación** no son intentos de acceso, van a la bitácora o a una tabla de solo inserción propia.
- **Refinamiento con datos reales:** el tamaño inicial de la bolsa y de los topes es un número fijo. Con el uso real se estiman a partir del promedio y de los casos más altos observados, dejando rangos entre ambos, y se ajustan (§4 y §7).

## Alternativas descartadas

- **Un tope global de QR para todas las cuentas:** no es justo entre un plan chico y uno grande; por eso la bolsa es por plan y el tope diario es por usuario.
- **Bloqueo automático al superar el tope:** un falso positivo (un evento masivo legítimo) dejaría a una cuenta sin generar QR. Se prefiere 429 con aviso y decisión humana.
- **Cortar la validación en el lector cuando se agota algo:** pondría a la gente afuera de la puerta y rompe la idea de que el servidor decide con datos del QR, no de cuotas (ADR 0008).
- **Supabase como canal de notificaciones:** no ofrece push móvil; no resuelve el problema (§6).
- **Limitar solo en la app:** la app se puede saltear; el único lugar que hace cumplir un límite es la API (ADR 0017).

## Consecuencias

- **Código (a implementar en ramas aparte):** `@fastify/rate-limit`, `qr.limite_diario` y `qr.limite_pendientes` en `generar-qr`, tabla `notificaciones`, bolsa mensual por plan (columna en `planes`), configuración de topes y las señales nuevas del §4. Nuevas migraciones, una por tabla (ADR 0011).
- **Contrato:** los códigos nuevos son una adición al contrato `/api/v1` (compatible, ADR 0005). La app debe traducir `qr.limite_diario` y `qr.limite_pendientes` en los ARB.
- **Sesiones (§4.1):** migración que agrega `instalacion_id` y `plataforma` a `sesiones` y la sesión de origen a `qr_accesos`; la app genera y guarda el identificador de instalación y lo envía en el login; pantalla de dispositivos conectados en la app y en el panel. Los tests de aislamiento cubren que el propietario solo ve las sesiones de su cuenta.
- **QR propio (§2.1):** cambia `generar-qr` (la rama `propio` deja de anular a ciegas), el contrato (`reutilizado` en la respuesta, código `qr.limite_propios_sin_uso`) y la app (copia local segura del token y consulta de estado al reabrir). Cualquier cambio de pantalla se revisa contra el handoff.
- **Tests obligatorios:** pedir el QR propio con uno activo no crea ni anula nada; con el anterior usado, vencido o anulado genera uno nuevo; reemplazos sobre el tope diario o antes de la espera → 429; el QR reutilizado sigue validando; superar el tope diario → 429 con su `code` y sin bloqueo al día siguiente; superar los pendientes → rechazo; la validación de QR no se ve afectada por ningún límite de generación; un usuario no ve ni cuenta lo de otra cuenta; el aviso se emite una vez por evento y día.
- **Documentación:** el ADR 0017 se enmienda; `estado_proyecto.md` lleva el pendiente de rate limit y limitador compartido como parte de este trabajo.
- **Pendiente de valores:** el tope diario, el tope de pendientes, N de uso masivo por rol, el tamaño de la bolsa por plan y los límites por ruta se fijan al implementar y se refinan con datos reales.
