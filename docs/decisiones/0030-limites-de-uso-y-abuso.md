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

### 2.1.1. Cómo se implementa: serialización y casos límite (enmienda 2026-10-27)

- **Serialización por rama.** Generar bloquea (`FOR UPDATE`) la fila del generador y las de todos sus superiores, siempre de abajo hacia arriba, y toma la cuenta en modo compartido. Dos generaciones del mismo usuario se esperan entre sí (así ven los conteos una de la otra); dos de ramas distintas solo coinciden en los superiores comunes, por lo que una cadena corta (un administrador con muchos hijos) se serializa en el administrador. Es el precio de que una suspensión concurrente no deje un QR vivo (ADR 0031 §1); la transacción es corta (unas pocas lecturas y dos inserts).
- **La bolsa mensual no corre bajo esos bloqueos.** Como nunca corta, su conteo y la marca de aviso (80 %) o de exceso (100 %) se hacen en una transacción propia, ya con el QR confirmado; si esa marca falla, se anota en el log (sin datos sensibles) y la siguiente generación la deja. Dos generaciones casi simultáneas pueden ver el mismo conteo y marcar una vez de menos o de más en el límite exacto; la marca es idempotente por su clave única (`bolsa.aviso:<mes>`, `bolsa.superada:<día>`), así que no se duplica.
- **Validar nunca espera a generar.** La validación lee el estado del generador sin bloquear (lectura consistente) y consume el QR con un `UPDATE` atómico; solo puede esperar, unos milisegundos, al `FOR UPDATE` que `buscarPropioSinUso` toma sobre el QR propio sin usar de ese mismo usuario mientras dura su transacción de generación.
- **Reutilización.** Al reutilizar el QR propio vigente se ignoran `vence_at` y `etiqueta` del pedido: rige lo del QR existente, salvo que se pida `reemplazar`.
- **Precedencia de valores.** Excepción de usuario > excepción de cuenta > valor del plan > valor general (la bolsa y las puertas por QR admiten el valor del plan). El plan manda sobre el valor general.
- **Reemplazos sin uso.** El ciclo anular-generar queda acotado por el tope diario además de por el tope de reemplazos (§2.1.5): cada reemplazo es una generación.
- **Soft delete.** Los conteos (diario, pendientes, bolsa) pasan por el repositorio de cuenta, que excluye lo borrado: si algún día se hiciera soft delete de un QR generado, dejaría de contar y el conteo bajaría (se podría volver a generar). Hoy ningún flujo borra QR (se anulan con `anulado_at`, que sí cuenta); si aparece uno, hay que decidir si el conteo debe incluir lo borrado.
- **Configuración incompleta.** Si falta un tope general en `configuracion_limites`, generar falla cerrado con 503 `limite.configuracion_incompleta`, sin decir qué clave falta (ADR 0033).

### 2.2. QR propio usado con flujo dudoso

Si el QR sí se usa pero el patrón es dudoso (uso masivo por día, uso en puertas distintas con una diferencia de tiempo físicamente imposible, o ciclos de generar-usar-generar de pocos minutos todo el día; ver §4), **no se corta nada**: el uso se acepta y se registra, y se notifica al **propietario de la cuenta y a los administradores de AGROCOM** (§5). La persona decide qué hacer.

**Implementado (ola W5, API).** `generar-qr` aplica, dentro de la transacción que inserta y con la cuenta y la cadena del generador bloqueadas: el estado del generador releído (`qr.generacion_restringida`, `qr.generador_suspendido`, `qr.cuenta_suspendida`), la reutilización del QR propio (200, `reutilizado: true`, `texto: null`, sin crear ni anular nada), el reemplazo sin uso (`qr.limite_propios_sin_uso`, con `Retry-After` por la espera o hasta el día siguiente), el tope diario (`qr.limite_diario`), el de pendientes (`qr.limite_pendientes`) y el máximo de puertas por QR (`qr.limite_puertas`, 422). La reutilización se mira antes que los topes: no genera nada, así que no los gasta. La bolsa mensual no corta: al llegar al 80 % y al pasarse deja una marca en `eventos_de_limite` (una vez por mes y una vez por día). Los valores viven en `configuracion_limites` (editables con `PUT /api/v1/plataforma/limites/{clave}`) y admiten excepción por cuenta o usuario (`/plataforma/cuentas/{id}/excepciones-de-limite`); el plan puede fijar la bolsa y las puertas por QR. Cada rechazo queda en `eventos_de_limite` (§7). Los valores iniciales que el ADR no fija (tope diario 100, pendientes 50, bolsa 5000) y el calendario `America/La_Paz` son supuestos: dudas D-26 a D-28. La bandeja de avisos (§6) y las señales (§4) siguen pendientes (olas W9 y W12).

### 3. Protección de la API contra estrés y bots

En capas, de la más barata a la más fina:

1. **Borde (NPMplus/Nginx):** `limit_req` y `limit_conn` por IP, tope de tamaño de cuerpo y timeouts cortos. Frena el flood antes de que llegue a Node. Va por el despliegue (`docs/gestion/despliegue.md`).
2. **API, `@fastify/rate-limit`** con clave por IP y, si hay sesión, por usuario; por dispositivo en las rutas de dispositivo. Límites por tipo de ruta: login y anuncio de placas, muy estrictos; generar QR, moderado (por ejemplo, ráfagas cortas por minuto además del tope diario); validación de dispositivo, por credencial y holgado; lecturas, holgado. Las respuestas son 429 con `Retry-After`.
3. **Estado compartido:** con una sola instancia (V1) el contador puede vivir en memoria. Con más de una, sale a Redis o a la base; el limitador del login entra en el mismo cambio (hoy está anotado como pendiente en `estado_proyecto.md`).
4. **Pool de MySQL y timeouts:** el pool de 10 conexiones se revisa junto con un tiempo máximo por consulta y por petición, para que unos pocos clientes lentos no lo agoten.
5. **Pruebas de carga** (por ejemplo `k6`) contra un entorno de prueba antes de abrir la app al público; nunca contra producción.

   Las pruebas de carga con un cliente HTTP real destaparon que la validación de QR respondía `503` por usar `request.signal` como presupuesto (detalle y corrección en el ADR 0032 §1, "Hallazgo y corrección"). El tope de petición de los dispositivos es un plazo propio (`presupuestoDePeticion`), y la API debe probarse también con servidor real, no solo con `app.inject()`.

**Implementado (ola W3, API):** `@fastify/rate-limit` en `api/src/plugins/limites.ts`, registrado después de la autenticación. Cuenta por (clase de ruta, identidad): el dispositivo por su credencial, el usuario por su sesión y, sin sesión, la IP; una cabecera sin verificar nunca elige la clave. Ventana de un minuto; el contador está en memoria (una instancia, V1). Pasado el tope responde `429` `limite.excedido` con `Retry-After`. Valores por defecto (todos en variables `LIMITE_*_POR_MINUTO`, ver `.env.example`):

| Clase         | Rutas                                         | Clave          | Por defecto |
| ------------- | --------------------------------------------- | -------------- | ----------- |
| `login`       | `POST /sesiones`, `POST /plataforma/sesiones` | IP             | 20          |
| `refresco`    | `POST /sesiones/refresco`                     | IP             | 60          |
| `anuncio`     | `POST /dispositivos/anunciar` y `/confirmar`  | IP             | 20          |
| `generar_qr`  | `POST /qr-accesos`                            | usuario        | 10          |
| `escritura`   | el resto de POST/PUT/PATCH/DELETE             | usuario (o IP) | 60          |
| `lectura`     | GET                                           | usuario (o IP) | 240         |
| `validacion`  | `POST /dispositivos/validaciones`             | dispositivo    | 600         |
| `dispositivo` | latidos y configuración                       | dispositivo    | 120         |

La validación nunca usa el límite de un usuario; su tope es anti-flood por credencial. Un `429` en ella llega antes de consumir el QR y el firmware lo trata como "sin respuesta" (no abre). Queda pendiente el limitador compartido para más de una instancia (punto 3).

**Clase `exportacion` (ola W11).** `GET /exportaciones/{recurso}` (CSV de la cuenta, ADR 0033 §3) cuenta aparte de las lecturas: por usuario, `LIMITE_EXPORTACION_POR_MINUTO` (10 por omisión), con el mismo `429` `limite.excedido` y `Retry-After`.

**IP del cliente y autenticaciones fallidas (auditoría W3).** La IP sale de `X-Forwarded-For` solo con `TRUST_PROXY` como número de saltos (por omisión 1) o lista de IP/CIDR, nunca `true`; el Nginx de delante sobrescribe la cabecera (`docs/gestion/despliegue.md`). Las autenticaciones fallidas (JWT o credencial de dispositivo inválidos) se cuentan por IP (`LIMITE_FALLOS_AUTENTICACION_POR_MINUTO`, 30 por omisión): pasado el tope, esa IP recibe `429` durante el resto de la ventana sin que se verifique su credencial. Los aciertos no consumen, y un dispositivo que autenticó bien desde esa IP en los últimos 15 minutos se sigue verificando (IP compartida de un sitio). Todo en memoria y acotado (una instancia).

### 4. Estadísticas: qué se considera sospechoso

Las estadísticas siguen siendo **informativas**: no disparan una baja ni un corte; decide una persona. Se ajustan y se amplían:

| Señal                               | Regla                                                                                                             | Qué detecta                                                                                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Fantasma**                        | Sin QR generados en 30 días y con más de 30 días de antigüedad (sin cambio)                                       | Cuentas llenas de usuarios que no usan el plan                                                                                            |
| **Ruidoso**                         | Más de **20** QR generados **y no usados** en un mismo día (antes, 10 de cualquier tipo). Un QR usado no suma     | Bots, errores o abuso de generación                                                                                                       |
| **Uso masivo** (nueva)              | Más de N aperturas con QR propio de un mismo usuario en un día; N distinto por rol (para el Guardia, bajo)        | El Guardia o usuario que hace de portero de todos                                                                                         |
| **Uso imposible** (nueva)           | Dos usos del mismo usuario en puertas distintas con una diferencia de tiempo que no alcanza para ir de una a otra | QR propio compartido con otra persona                                                                                                     |
| **Ciclo generar-usar** (nueva)      | Un QR propio usado y otro generado a los pocos minutos, repetido durante el día                                   | El portero que abre con su QR a cada persona                                                                                              |
| **Flujo atípico de cuenta** (nueva) | Aperturas por día divididas entre usuarios activos, muy por encima de lo habitual para el plan                    | El plan barato usado como portería de muchos                                                                                              |
| **Altas en ráfaga** (nueva)         | Muchos usuarios creados en poco tiempo por un mismo Administrador o Titular, aunque no llegue al tope             | Creación de usuarios "a diestra y siniestra"                                                                                              |
| **Tasa de uso** (nueva)             | Generados / usados por usuario, junto al volumen                                                                  | Distinguir flujo real de abuso: muchos generados y pocos usados es sospechoso; muchos generados y muchos usados es una puerta con tráfico |
| **Titular cerca del tope**          | 80 % del tope de Miembros (sin cambio)                                                                            | —                                                                                                                                         |

Los umbrales empiezan como constantes en el código (como hoy en `actividad-de-usuarios.ts`) y se pasan a configuración (§7) cuando haya datos.

### 4.1. Un mismo usuario en varios dispositivos o en la web

**Iniciar sesión en varios dispositivos (o en la app web) nunca se bloquea.** Una persona legítima puede tener teléfono, tablet y navegador a la vez. Lo que se vigila es el patrón, no el hecho de tener varias sesiones.

**Qué se registra.** La tabla `sesiones` ya guarda `agente`, `ip` y fechas. Se le agregan una **instalación** (un identificador aleatorio que la app genera y guarda localmente la primera vez; en la web, en el navegador) y la **plataforma** (`android`, `ios` o `web`). Y cada QR generado guarda la sesión con la que se generó, para poder relacionar un uso en una puerta con el dispositivo que lo creó. Son datos operativos: no llevan secretos, y se tratan como tal (invariante 6).

**Qué se vigila.** Cada señal por separado es informativa; lo que sube de gravedad es la **combinación**:

| Señal                                                                                                   | Qué dice                                             | Gravedad por sí sola                 |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------ |
| Varias instalaciones activas de un mismo usuario                                                        | Un PIN compartido, o una persona con varios aparatos | Baja: se ve en su ficha, no se avisa |
| Muchas instalaciones nuevas en poco tiempo, o muchas IP distintas a la vez                              | Un PIN filtrado o repartido                          | Media: se avisa                      |
| **Uso imposible** (§4): QR de un mismo usuario usados en puertas distintas con un tiempo que no alcanza | Dos personas usando el mismo usuario a la vez        | Alta: se avisa                       |
| Varias instalaciones **y** uso masivo o ciclo generar-usar                                              | Un PIN que opera como portería con varios aparatos   | Alta: se avisa                       |

La relación entre sesión y QR es lo que separa a quien usa dos aparatos de quien presta su usuario: los QR de uno aparecen siempre cerca (misma puerta o puertas de un mismo recorrido), los de dos personas aparecen lejos y a la vez.

**Qué se le da a quien administra** (sin bloquear ningún ingreso por sí solo):

- **Lista de dispositivos conectados** de cada usuario, con plataforma, última actividad y IP, visible para el propietario de la cuenta (la de su cuenta) y para AGROCOM (todas).
- **Cerrar una sesión** concreta, o todas las de un usuario, y **regenerar su PIN** (ya existe). Es la respuesta al PIN filtrado: el usuario legítimo vuelve a entrar con el nuevo.
- **Aviso al propietario y a AGROCOM** cuando se cumple una combinación de gravedad media o alta, con el mismo criterio del §5 (una vez por evento y día).

**Riesgos aceptados y reglas de presentación de las sesiones (enmienda W8).**

- **Cierre cruzado por el tope de instalación.** El tope por instalación cuenta las sesiones de todos los usuarios de un mismo aparato y cierra la más antigua, aunque sea de otro usuario: quien conoce un `instalacion_id` ajeno (es un valor aleatorio que no se muestra) o comparte aparato puede desplazar sesiones de otros. Se acepta: el cierre es acotado a la cuenta, queda en la bitácora con su autor y quien lo sufre vuelve a entrar sin bloqueo. Iniciar sesión nunca se rechaza por un tope; los ingresos que se pisan en la base se reintentan (hasta 3 veces, con pausa aleatoria) solo en el login.
- **Bucle con un PIN válido.** Quien tiene un PIN válido puede iniciar sesión en bucle y cerrar así sus propias sesiones más antiguas, o generar bitácora. Se acepta: el límite por IP y por cuenta frena los fallos, no los aciertos, y cada ingreso queda registrado. Es una señal para las estadísticas del W12 (muchas aperturas de sesión en poco tiempo), no un bloqueo.
- **El nombre del dispositivo es texto plano.** `dispositivo` lo manda el cliente (texto libre acotado): la web y la app deben mostrarlo siempre como texto plano, nunca como HTML ni con formato interpretado.

**Debilidad que se asume.** Un PIN compartido es un punto débil del modelo de negocio: nada técnico impide que dos personas conozcan el mismo PIN. Se mitiga con detección y con la vía comercial (§5), no con bloqueo. Si en la práctica el compartir PIN entre turnos de guardias es habitual, se evalúa en su momento una regla propia (por ejemplo, un usuario por turno).

**Implementado (ola W12, API).** Las señales de la tabla anterior que tienen datos hoy: «Varias instalaciones activas» **no** (la columna `sesiones.instalacion_id` es de la ola W8 y no está en este esquema: vacío documentado en D-37); «Muchas… IP distintas a la vez» sí (PIN compartido, solo por IP, media); «Uso imposible» sí (alta); «combinación con uso masivo» queda pendiente de W8. Ver la sección «Implementado (ola W12)» al final del §5.

### 5. Quién ve qué y cuándo se avisa

- **El propietario de la cuenta** (Administrador) ve las estadísticas de **su** cuenta, en la app, con baja directa de un usuario (ya existe, #67). Aislamiento por cuenta como siempre (invariante 1).
- **AGROCOM** ve todo en el panel web: una lista de cuentas ordenable por consumo de la bolsa y por flujo atípico, y el detalle de cada cuenta con sus usuarios ruidosos, el uso masivo y el consumo por día. Desde ahí sube el tope de un usuario o amplía la bolsa de la cuenta; ambas acciones quedan en la bitácora.
- **Se avisa al propietario de la cuenta y a AGROCOM** cuando: un usuario supera el tope diario (`qr.limite_diario`); una cuenta cruza el 80 % de su bolsa mensual; una cuenta supera el 100 % (sin corte, §2); o se dispara una señal del §4. No se avisa dos veces por el mismo evento en el mismo día.
- Un pico de un día es normal; lo que importa es la persistencia (una semana entera con el tope alto). El panel muestra la serie por día para que la persona lo juzgue.
- **El caso del condominio** (guardias que generan para los vecinos) no se corta automáticamente: se detecta con "uso masivo" y "flujo atípico de cuenta" y se **negocia con el propietario** (que compre el plan de más usuarios, o lo regularice). Es un tema comercial, no técnico.

**Implementado (ola W12, API).** Señales nuevas de abuso y vista de AGROCOM, con lo escrito en §4, §4.1 y §5 tomado como aceptado por indicación de Miguel y los supuestos de las dudas D-36 a D-41. El panel web es el paso siguiente: este es el contrato. **Ninguna señal limita, bloquea ni corta nada** (ni la generación ni, menos, la validación): solo abre un incidente del sistema y avisa; decide una persona.

*Detectores (tareas periódicas, `api/src/modules/senales/`).* Cada uno recibe el reloj (`ahora`) y corre en `tareas.ts`; lee de TODAS las cuentas con un salto explícito del aislamiento (solo lectura, paginado con un cursor, sin un tope fijo que tape a los ya tratados) y trata cada hallazgo DENTRO de su cuenta (`ContextoCuenta.ejecutarEn`). Hacen todas sus lecturas con el pool antes de escribir; lo que escriben es una transacción corta tomada con `GET_LOCK` por cuenta (`senales:<cuenta>`, sin esperar: si otra pasada lo tiene, el hallazgo se cuenta como `ocupadas` y la próxima lo reintenta). En las señales de un usuario, primero se abre el incidente (el contrato de W11, en su propia transacción, idempotente por su clave) y después se deja el aviso: si una pasada cae entre los dos, la siguiente completa el aviso. Idempotentes por una **clave del día local** (`America/La_Paz`) en `avisos_de_senal` (ficha 37): la constancia y el aviso se escriben en la misma transacción, así que no se avisa dos veces el mismo evento el mismo día aunque corran dos instancias. El resultado de cada pasada es `{ revisados, senales, omitidos, errores, ocupadas }`.

| Tarea | Cada | Qué detecta | Incidente (`incidentes_uso`, origen `sistema`) | Gravedad | Aviso |
|---|---|---|---|---|---|
| `senal-uso-masivo` | 10 min | Más de N aperturas por QR **propio** de un usuario en el día local (hoy hasta ahora, y ayer completo), N por nivel (`senal.uso_masivo_<nivel>`) | `uso_masivo`, clave `uso_masivo:<usuario>:<día>`, evidencia = ids de los intentos, `descripcion = aperturas=<n>;umbral=<N>` | media; alta desde 3×N | sí |
| `senal-uso-imposible` | 10 min | Dos usos de un QR **propio** del mismo usuario en sitios distintos con menos de `senal.uso_imposible_entre_sitios_minutos`, o en puertas distintas del mismo sitio con menos de `senal.uso_imposible_entre_puertas_segundos` (0 = no se juzga) | `uso_imposible`, clave `uso_imposible:<usuario>:<día>`, evidencia = ids de ambos intentos de cada par, `descripcion = pares=<n>;sitios_min=<m>;puertas_s=<s>` | alta | sí |
| `senal-qr-reenviado` | 10 min | QR con al menos `senal.qr_reenviado_rechazos_minimo` rechazos `qr.usado` en la ventana (todas las filas, repeticiones de W7 incluidas), por **lectores** distintos | `qr_reenviado`, un incidente por generador y día, clave `qr_reenviado:<usuario>:<día>`, evidencia = ids de QR e intentos, `descripcion = qrs=<n>;rechazos=<n>;lectores=<n>;minimo=<m>` | 3+ lectores alta; 2 media; 1 lector solo si insiste 3× el mínimo, baja | media y alta |
| `senal-pin-compartido` | 15 min | Sesiones activas (vivas y con actividad en la ventana) de un usuario desde al menos `senal.pin_compartido_ips_minimo` IP distintas | `pin_compartido`, clave `pin_compartido:<usuario>:<día>`, `descripcion = ips=<n>;sesiones=<n>;umbral=<m>`; **la IP nunca se guarda ni se devuelve** | media | sí |
| `senal-bolsa` | 5 min | Las marcas `bolsa.aviso` (80 %) y `bolsa.superada` que la generación deja en `eventos_de_limite` (de los últimos 3 días) | ninguno (es de la cuenta) | — | `bolsa.aviso` (`info`) y `bolsa.superada` (`aviso`) |
| `senal-flujo-atipico` | 15 min | Día local (hoy hasta ahora, y ayer) con al menos `senal.flujo_aperturas_minimo` aperturas por QR y al menos `senal.flujo_aperturas_por_usuario` por usuario activo | ninguno (es de la cuenta) | — | `flujo.atipico` (`aviso`) |

Lo común: la señal de un usuario se descarta si él, un superior o su cuenta están suspendidos o dados de baja; la de gravedad baja deja incidente y constancia pero **no** aviso (§4.1). El incidente nace sin resolver (no cuenta para la reincidencia hasta que una persona lo confirme, ADR 0033 §4) y se resuelve desde la cuenta con las rutas de `/incidentes`. Una excepción de cuenta que BAJA un umbral no deja a su cuenta sin revisar (la búsqueda usa el piso más bajo entre el valor general y todas las excepciones; el hallazgo se juzga luego con el valor efectivo).

*Quién recibe el aviso (bandeja de W9, `GET /notificaciones` y `GET /plataforma/notificaciones`).* Tipos nuevos de `notificaciones.tipo`: `senal.uso`, `bolsa.aviso`, `bolsa.superada`, `flujo.atipico`. `senal.uso` va a los superiores del usuario que reciben avisos de la cuenta (el Administrador de su rama) y a todo AGROCOM; si el usuario es un Administrador, solo a AGROCOM. Los de bolsa y flujo van a todos los Administradores con `notificaciones.aviso.ver` y a todo AGROCOM. Un aviso abierto por (usuario, señal), por (cuenta, tipo de bolsa, mes) y por cuenta (flujo): los días siguientes lo ACTUALIZAN con la novedad en vez de abrir otro. Severidades: `senal.uso` media = `aviso`, alta = `critica`; `bolsa.aviso` = `info`; `bolsa.superada` = `aviso`; `flujo.atipico` = `aviso`. `datos` de cada uno (todos llevan además `cuenta`, `sitio: null` y `placas: []`):

- `senal.uso`: `datos.senal = { tipo: "uso_masivo"|"uso_imposible"|"qr_reenviado"|"pin_compartido", usuario_id, usuario_etiqueta, gravedad: "baja"|"media"|"alta", incidente_id (GET /incidentes/{id}) | null, dia: "aaaa-mm-dd", valor, umbral }`.
- `bolsa.aviso` y `bolsa.superada`: `datos.bolsa = { mes: "aaaa-mm", dia: "aaaa-mm-dd", usado, tope }` (`usado` y `tope` pueden ser `null` si la marca no los guardó).
- `flujo.atipico`: `datos.flujo = { dia, aperturas, usuarios_activos, por_usuario, umbral_por_usuario, base | null }`.

*Umbrales (`configuracion_limites`, `GET/PUT /plataforma/limites`; excepciones en `/plataforma/cuentas/{id}/excepciones-de-limite`).* Valores de partida y rangos; la columna `excepcion` es la de `GET /plataforma/limites`:

| Clave | Parte en | Rango | Excepción |
|---|---|---|---|
| `senal.uso_masivo_administrador` / `_titular` / `_miembro` / `_guardia` | 40 / 30 / 20 / 12 | 1–10 000 | `usuario` (usuario o cuenta) |
| `senal.uso_imposible_entre_sitios_minutos` | 10 | 1–1 440 | `global` |
| `senal.uso_imposible_entre_puertas_segundos` | 20 | 0–3 600 | `global` |
| `senal.ventana_horas` | 24 | 1–168 | `global` |
| `senal.qr_reenviado_rechazos_minimo` | 3 | 1–10 000 | `cuenta` |
| `senal.pin_compartido_ips_minimo` | 4 | 2–1 000 | `cuenta` |
| `senal.flujo_aperturas_minimo` | 50 | 1–100 000 000 | `cuenta` |
| `senal.flujo_aperturas_por_usuario` | 25 | 1–1 000 000 | `cuenta` |

Si falta una clave en la base, rige el valor de partida (no falla cerrado: un aviso de más o de menos no abre ni cierra ninguna puerta).

*Vista de AGROCOM (solo lectura, plataforma).* Rutas bajo `/api/v1`. Un rol de cuenta (token de usuario) NUNCA llega acá: `401 autenticacion.requerida`, igual que sin sesión; un super admin sin el permiso recibe `403 permiso.denegado` (`permiso` en el problema). Permisos nuevos de ámbito plataforma, en `db/seeds/01_catalogo.sql` y solo para el rol Super admin: `limites.consumo.ver` y `seguridad.senal.ver`. Un query inválido (`por_pagina` > 100, enum desconocido, `dias` fuera de rango, id no numérico) es `400 validacion.invalida`; una cuenta inexistente en la ruta, `404 cuenta.no_encontrada`. Todas llevan `Cache-Control: no-store` y `Vary: Authorization`. Las fechas van en ISO 8601 UTC; los días (`dia`, `hoy`) son `aaaa-mm-dd` del calendario de `America/La_Paz` (D-27).

| Ruta | Permiso | Query | Respuesta 200 |
|---|---|---|---|
| `GET /plataforma/consumo-de-bolsa` | `limites.consumo.ver` | `pagina`, `por_pagina` (≤100, 25), `estado` (`normal`, `aviso`, `superada`, `sin_tope`), `buscar` (1–60, parte del código o nombre), `orden` (`porcentaje` por omisión, `usado`, `tope`, `nombre`), `sentido` (`desc` por omisión, `asc`) | `{ datos: [{ cuenta: {id, codigo, nombre, estado}, plan, usado, tope, porcentaje, estado, origen_del_tope, aviso_at, superada_at }], meta: { pagina, por_pagina, total, mes, desde, aviso_porcentaje, por_estado: {normal, aviso, superada, sin_tope} } }` |
| `GET /plataforma/cuentas/{cuenta_id}/consumo-de-bolsa` | `limites.consumo.ver` | — | Lo mismo de un ítem más `mes`, `desde`, `aviso_porcentaje` y `serie: [{ dia, generados }]` (los QR generados por día del mes en curso, hasta hoy, con ceros) |
| `GET /plataforma/senales` | `seguridad.senal.ver` | `pagina`, `por_pagina`, `cuenta_id`, `usuario_id`, `tipo` (los de `incidentes_uso`), `gravedad`, `estado` (`abiertas` = sin resolver o pendientes, `sin_resolver`, `pendiente`, `confirmado`, `descartado`), `desde` (incl.), `hasta` (excl.) sobre `ocurrido_at` (ISO con desfase) | `{ datos: [{ id, cuenta: {id, codigo, nombre}, usuario: {id, etiqueta}, tipo, gravedad, descripcion, evidencia: {qr_ids, evento_acceso_ids, evento_limite_ids}, estado, ocurrido_at, created_at }], meta: {pagina, por_pagina, total} }`, del más reciente al más antiguo; solo incidentes de origen `sistema` |
| `GET /plataforma/senales/resumen` | `seguridad.senal.ver` | `dias` (1–90, 7) | `{ desde, hasta, dias, total, abiertas, por_tipo: [{ tipo, total, abiertas, altas }], cuentas: [{ cuenta: {id, codigo, nombre}, total, abiertas, altas }] }` (las 10 cuentas con más señales, primero las de más gravedad alta) |
| `GET /plataforma/flujo-de-cuentas` | `seguridad.senal.ver` | `pagina`, `por_pagina`, `dias` (1–30, 7), `solo_atipicas` (`true`/`false`), `buscar`, `orden` (`por_usuario` por omisión, `aperturas`, `dias_atipicos`, `nombre`), `sentido` | `{ datos: [{ cuenta, usuarios_activos, umbrales: {aperturas_minimo, aperturas_por_usuario}, aperturas_hoy, por_usuario_hoy, atipica_hoy, aperturas_periodo, dias_atipicos, ultimo_dia_atipico, base }], meta: { pagina, por_pagina, total, dias, hoy } }` |
| `GET /plataforma/cuentas/{cuenta_id}/flujo` | `seguridad.senal.ver` | `dias` (1–90, 30) | `{ cuenta, usuarios_activos, umbrales, zona_horaria, serie: [{ dia, aperturas, rechazos, generados, por_usuario, atipico, base, veces_la_base }] }`, un ítem por día hasta hoy (los días sin actividad van en cero) |

Cómo leer los campos: `usado` = QR generados desde el día 1 del mes local (todos, como los cuenta la generación); `tope` = la bolsa que rige (`origen_del_tope`: `excepcion` de la cuenta > `plan` > `general`, ADR 0030 §2.1.1; `null` y `estado: "sin_tope"` si no hay ninguna); `porcentaje` con un decimal, puede pasar de 100; `estado`: `superada` si `usado > tope`, `aviso` desde `aviso_porcentaje` (80), `normal`; `aviso_at`/`superada_at` = la última marca del mes. La lista de consumo se calcula para todas las cuentas y se pagina en memoria, así que `total` y `por_estado` no dependen de la página; `por_estado` ignora el filtro `estado` (sí respeta `buscar`). En el flujo, `usuarios_activos` es el de HOY (no se guarda cuántos hubo cada día); `aperturas` cuenta solo aperturas por QR (no pulsador ni llave) y todas las filas, repeticiones incluidas; `atipico` = `aperturas ≥ aperturas_minimo` **y** `aperturas / usuarios_activos ≥ aperturas_por_usuario`; `base` = mediana de aperturas de los 14 días anteriores con actividad (`null` sin historia) y `veces_la_base` = `aperturas / base`: sirven para que la persona juzgue si es un pico de un día o persiste (§5), no deciden nada.

*Lo que no se hizo.* Detectores para «Ciclo generar-usar», «Altas en ráfaga» y «Tasa de uso» (D-40); contar instalaciones distintas y la combinación «varias instalaciones y uso masivo» (D-37, pendiente de la integración de W8); retención de `avisos_de_senal` (D-41); acciones de AGROCOM desde la vista (subir el tope de un usuario o ampliar la bolsa ya existen por `PUT …/excepciones-de-limite`); aviso por correo o push (§6, pasos 2 y 3). El PIN compartido dentro de una misma red (misma IP) no se ve.

*Rendimiento y topes (auditoría de la ola W12).* (1) **Uso imposible** se evalúa cuenta por cuenta y los pares se emparejan en memoria, por usuario y ordenados por hora, comparando solo aperturas a menos del mayor umbral: un self-join de `eventos_acceso` era cuadrático en los eventos de la cuenta porque MariaDB no acota por fila el rango de `(tenant_id, ocurrido_at)`. Cada página del cursor salta las cuentas ya recorridas. (2) **Vistas de plataforma**: `GET /plataforma/consumo-de-bolsa` y `GET /plataforma/flujo-de-cuentas` guardan su cálculo de TODAS las cuentas 45 s por proceso (`CacheCorta`, `VIGENCIA_DE_VISTAS_DE_PLATAFORMA_MS`), porque el panel las vuelve a pedir al ordenar o paginar; es una vista de plataforma, sin datos que separar por cuenta; el detalle de una cuenta no se guarda. Las cifras pueden tener hasta 45 s de atraso. (3) **Tope por pasada** (`MAXIMO_DE_SENALES_POR_PASADA`, 500 por detector): al sumar 500 señales abiertas, ocupadas o con error la pasada se corta y la siguiente sigue con el resto (lo tratado queda «omitido» y no gasta cupo), para que una avalancha no ocupe un cupo de tareas simultáneas. (4) **Uso masivo** revisa también AYER, como el flujo atípico. (5) Si una pasada cayó entre el incidente y el aviso, la siguiente recupera el id del incidente por su clave (`idPorClaveUnica`) para que el aviso lleve `incidente_id`. (6) La migración de índices (`20261102100003`) declara `ALGORITHM=INPLACE, LOCK=NONE` en todos sus `ALTER` y fija `lock_wait_timeout = 5`; ver `docs/gestion/despliegue.md`.

*Tareas de integración (W7 y W8): hechas al integrar las olas.* La rama `claude/integracion-olas` las implementa (ver `docs/gestion/integracion-de-olas.md`): (a) las aperturas se cuentan DISTINTAS (`repetido_de_id IS NULL AND resultado = 'permitido'`, constante `ES_APERTURA_POR_QR`) en uso masivo, flujo atípico, emparejamiento de uso imposible y vistas de plataforma (también los rechazos por día de la serie de flujo cuentan solo intentos distintos); (b) `qr_reenviado` exige el umbral sobre intentos distintos, las repeticiones solo hacen VOLUMEN (llegar al mínimo de filas y la constancia baja del triple) y los lectores se cuentan solo si tuvieron un intento distinto; (c) `pin_compartido` mide la dispersión como la MAYOR entre las IP distintas y las instalaciones distintas de W8 (no su suma, para que un aparato no cuente doble); (d) pruebas en `api/test/senales/integracion-repeticiones-e-instalaciones.test.ts` que fallan si se olvida cualquiera. **Sigue pendiente** la combinación «varias instalaciones y uso masivo» (gravedad alta).

*Limitaciones conocidas de las señales.* (i) **QR de visita**: `uso_masivo` y `uso_imposible` miran solo QR propios (`es_propio = 1`); un usuario que reparte QR de visita a muchas personas no dispara estas dos (sí `flujo_atipico` por cuenta y los topes de generación). (ii) **CGNAT y redes compartidas**: `pin_compartido` cuenta IP públicas; muchos usuarios legítimos tras una misma IP cuentan como una, y un solo usuario con datos móviles que rota de IP puede sumar de más. (iii) **Esclusas y dobles puertas**: el tiempo mínimo entre puertas del mismo sitio es un umbral global (`senal.uso_imposible_entre_puertas_segundos`, 20 s), no una distancia; una esclusa de dos puertas seguidas a menos de ese tiempo es uso normal que dispara `uso_imposible` (sube el umbral a 0 para no juzgar el mismo sitio). Son límites aceptados de una señal que solo informa.

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
