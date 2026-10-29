# ADR 0035 — Apertura manual de la puerta desde la app y hasta dos placas por puerta

**Estado:** Aceptada (2026-10-29), decidida con Miguel. Ajusta el ADR 0009 (el servidor ahora también le habla a la placa) y la invariante 2 de `CLAUDE.md`. No cambia el ADR 0008: el QR sigue siendo de un solo uso.

## Contexto

Hoy se entra con el lector QR de la placa, pero en las casetas de los condominios no hay un segundo lector para salir. Hasta decidir si cada puerta lleva **una placa con dos lectores** o **dos placas, una por sentido**, hace falta una forma de abrir sin lector: la persona la pide desde la app (Flutter, móvil o web) y la API se la ordena a la placa.

También sirve de respaldo cuando el lector se avería, se pierde o se lo roban, o cuando se actualiza la placa. Y para quien ya usa su QR propio es el camino más rápido de entrar o salir.

Restricciones que ya existían:
- La placa solo hace peticiones HTTPS salientes (validar, latido cada 60 s, configuración). La API **no puede** conectarse a ella (ADR 0009; ADR 0025: solo Ethernet).
- Una puerta admite un solo dispositivo en servicio (`uq_dispositivos_puerta`).
- `lecturas` solo admite los métodos `qr`, `pulsador` y `forzada`, y no guarda quién abrió ni el sentido.
- Qué pasó con una orden de abrir ya tiene su registro: `confirmaciones_apertura` (ADR 0031 §18).

## Decisión

### 1. La apertura manual es un QR sin imagen: misma validación, otro canal

Quien abre desde la app no escanea nada, pero **la API lo valida igual** que valida un QR: sesión vigente, usuario activo (no restringido, suspendido ni eliminado), suscripción vigente, puerta de su cuenta y puerta con el modo manual habilitado. Si todo pasa, la API **ordena** la apertura a la placa. La placa no decide nada: espera una orden positiva del servidor y obedece.

Por eso la **invariante 2 se mantiene en su espíritu y se reescribe**: *la puerta nunca abre sin una orden positiva del servidor* (validación de un QR **o** apertura manual autorizada). Sin red, sin orden o con una orden inválida o vencida, no abre. Las únicas aperturas sin servidor siguen siendo las físicas (pulsador de salida y llave).

### 2. Cómo recibe la orden la placa: petición larga (*long polling*) sobre HTTPS

La placa ya está conectada por Ethernet y habla HTTPS con la API. En lugar de abrir un canal nuevo, **pregunta por órdenes**:

- `GET /api/v1/dispositivos/ordenes`: la API **retiene la petición hasta ~20 s**. Si entra una orden para ese dispositivo, responde al instante con ella; si no, responde `204` y la placa vuelve a preguntar de inmediato. La latencia de una orden es de ~1 s.
- `POST /api/v1/dispositivos/ordenes/{id}/resultado`: la placa informa que ejecutó la orden (o por qué no pudo).
- Misma credencial `Dispositivo <id>.<clave>` (invariante 5) y mismo pool de base reservado a dispositivos (ADR 0032 §1).

**Por qué no MQTT.** Hace falta un *broker* (Mosquitto propio en el `docker-compose` o un servicio administrado), un puerto TLS nuevo abierto a internet, usuarios y ACL por dispositivo, y mantener una conexión persistente. Es más inmediato, pero suma una pieza que operar y una superficie de ataque. Las plataformas de IoT administradas (AWS IoT, etc.) cobran por mensaje y conexión; **The Things Network** es para LoRaWAN, no sirve con una placa Ethernet. La petición larga es **gratis**, reutiliza toda la seguridad existente y sale por el mismo camino que ya usa la placa. Si algún día la latencia o la cantidad de placas lo exigen, MQTT se suma sin cambiar el modelo de órdenes (la tabla y las reglas son las mismas; cambia el transporte).

**Cuidado con el ADR 0032 §1.** Una petición retenida ocupa un manejador de Fastify, no una conexión de base: la API no debe tomar una conexión del pool mientras espera. Se espera en memoria (una señal por dispositivo, con la base como árbitro y respaldo) y solo se consulta la base al llegar la orden, al vencer los 20 s o al arrancar la petición. El tiempo máximo de ruta de dispositivo (2,5 s, ADR 0032 §1) **no** aplica a esta ruta: tiene su propio plazo (`PETICION_MS_ORDENES`, mayor que la espera), y el firmware usa un tiempo de espera propio para ella.

### 3. La orden: una fila corta, de un solo uso y que vence

Tabla nueva `ordenes_apertura` (ficha 38):

- La crea la API al validar la petición de la app, con `dispositivo_id` (la placa que debe abrir), `sentido`, `usuario_id`, la `lectura_id` que la registra y `vence_at` (por defecto 15 s; ninguna orden dura más de 30 s).
- Estados: `pendiente` → `entregada` (la placa la recibió) → `ejecutada` / `fallida`, o `vencida`. La entrega es **atómica** (`UPDATE … WHERE estado = 'pendiente' AND vence_at > ahora`, una fila): una orden se le entrega **una sola vez a una sola placa**, igual que el consumo de un QR (invariante 3, por analogía).
- La placa recibe el plazo **relativo** (`valida_por_ms`), no una hora absoluta, para no depender de su reloj. Si lo pasó (red lenta, reintentos), **no abre**.
- Al reconectarse tras una caída, la placa **no ejecuta órdenes viejas**: la API solo entrega las vigentes, y la placa descarta cualquier orden cuyo `valida_por_ms` ya corrió.
- `ordenes_apertura` guarda el estado de la entrega y cambia (no es de solo inserción). El hecho queda en `lecturas` (solo inserción) y el resultado en `confirmaciones_apertura`.

### 4. Una puerta con una o dos placas: `dispositivos.sentido`

Se **mantiene el modelo de una placa por lector**: si la puerta necesita entrada y salida, lleva **dos placas**, cada una con su lector. (Una placa con dos lectores se descartó: el ESP32-ETH01 no tiene pines libres para un segundo lector; es un límite de hardware, no de software.)

- `dispositivos.sentido`: `entrada`, `salida` o `ambos` (valor por omisión: `ambos`, el comportamiento de hoy).
- Una puerta tiene como máximo **un dispositivo en servicio por sentido**, y `ambos` es exclusivo (no se combina con `entrada` ni `salida`). La unicidad pasa de `uq_dispositivos_puerta (puerta_id, en_servicio)` a `uq_dispositivos_puerta_sentido (puerta_id, sentido, en_servicio)`; la exclusividad de `ambos` la hace cumplir la acción de vincular, dentro de la transacción.
- **A qué placa va la orden.** El `sentido` de la placa dice qué hace su relé: una placa `ambos` abre una sola puerta para entrar y para salir; una `entrada` o una `salida` abre una puerta física **solo** para ese lado. La petición lleva el `sentido` que quiere la persona y la API la manda a la placa en servicio de ese sentido, o a la `ambos`. **Nunca a la de otro sentido**: si la entrada y la salida son dos puertas físicas, el relé de una no abre la otra. Si no hay una placa que sirva a ese sentido, la API responde `409 puerta.sin_dispositivo`, aunque el botón haya ofrecido abrir. Si la placa está sin conexión (`estado_conexion` distinto de `en_linea`), `409 puerta.sin_conexion`, para que la app avise al instante en vez de esperar un tiempo agotado.
- **Una sola placa `ambos` hace todo:** lee el QR y recibe las órdenes manuales, y las dos cosas abren por el mismo relé (es la misma puerta). Con dos puertas físicas (entrada y salida), cada una lleva su placa con su sentido; una puerta de salida sin placa conectada no se puede abrir por ningún método.

### 5. Quién habilita y quién usa

- **Habilita** el administrador de la cuenta, **por puerta y por sentido**: `puertas.apertura_manual_entrada` y `puertas.apertura_manual_salida`, ambas en `1` por omisión (**una cuenta nueva nace con el modo manual activo**). Apagar o encender el «uso total» de una puerta mueve las dos; la pantalla también ofrece aplicarlo a todas las puertas de la cuenta de una vez. El permiso es `accesos.apertura_manual.configurar`. La cuenta entera es del Administrador de la cuenta; ningún otro rol lo cambia.
- **El modo manual convive con el lector.** Que un sentido tenga lector QR y placa no lo impide: el administrador puede dejar la apertura manual activa (como respaldo o como el camino más rápido) o apagarla.
- **Valor inicial y puertas nuevas.** La cuenta nace con el modo manual activo (`cuentas.apertura_manual_por_omision = 1`) y cada puerta nueva toma ese valor para sus dos sentidos. Si el administrador apaga el modo manual de todas las puertas desde la pantalla, esa pantalla también apaga el valor de la cuenta y las puertas que registre después nacen apagadas; vuelve a encenderlas cuando quiera. **Nada lo enciende solo después:** si el administrador lo apagó, sigue apagado aunque la puerta no tenga placa o lector.
- **Disponibilidad efectiva.** Un sentido ofrece la apertura manual solo si el interruptor está encendido **y** hay una placa en servicio que lo sirve. Donde no hay placa, el administrador no tiene nada que encender o apagar: la pantalla muestra «Sin placa» sin interruptor, y la app no muestra el botón. La API devuelve en la configuración de la app, por puerta y sentido, si la función está disponible; la app solo muestra u oculta, la autoridad sigue siendo la API (que rechaza igual con `409`).
- **La placa también tiene el interruptor.** `GET /dispositivos/configuracion` agrega `apertura_manual` (bool): vale `true` si el administrador tiene encendido algún sentido que esa placa sirve. Con `false` la placa **no hace la petición larga**: no consulta por órdenes. La placa vuelve a leer su configuración periódicamente (con `ETag`, para que sea barata) y el cambio llega en un minuto; la API además rechaza las órdenes con el modo apagado, así que la seguridad no depende de que la placa se entere.
- **Usan** todos los usuarios de la cuenta, de cualquier rol (permiso `accesos.apertura_manual.usar`, en todos los roles base), sobre las puertas habilitadas de su cuenta. Es lo mismo que ya pueden hacer con su QR propio: entrar y salir.
- La app recibe la lista de puertas habilitadas junto con su configuración y muestra el botón **solo** donde corresponde. La autoridad es siempre la API (la app no decide).
- Sin geovalla en esta versión (decisión de Miguel): exigir cercanía necesitaría el GPS de la placa y del móvil. Quedó como idea futura, no implementada.

### 6. Registro: sigue siendo una lectura

Cada petición de apertura manual, aceptada o rechazada, queda en `lecturas` (invariante 4):

- `metodo = 'manual'`, `usuario_id` (quién), `sentido` (hacia dónde) y `qr_acceso_id`/`token_hash` nulos.
- `resultado = 'permitido'` con `motivo_code = 'manual.ordenada'` cuando la API crea la orden; `rechazado` con su motivo cuando no (`manual.no_habilitada`, `manual.sin_conexion`, `manual.sin_dispositivo`, `manual.limite`, `manual.suscripcion_vencida`, …).
- El resultado físico sigue en `confirmaciones_apertura` (misma fila que hoy, colgada de la lectura permitida): `ejecutada`, `fallida` o `sin_confirmacion`. Una orden `vencida` sin respuesta genera `sin_confirmacion` / `sin_respuesta` con origen `servidor`, y alimenta el aviso de aperturas fallidas existente.
- Para el usuario es una lectura más, con «Apertura manual» y el sentido, como las de su QR propio.

### 7. Límites y abuso (ADR 0030)

Abrir sin QR no tiene el tope natural de «un QR, un uso», así que se limita desde el primer día:

- **Enfriamiento** por usuario y puerta (por omisión 10 s entre órdenes) y **tope diario** por usuario (configurable en `configuracion_limites`).
- **Idempotencia:** `Idempotency-Key` obligatoria en `POST /puertas/{id}/abrir`; el reintento de la app devuelve la misma orden, nunca otra.
- **Una orden viva por placa:** mientras haya una pendiente o entregada, la petición del mismo usuario con la misma `Idempotency-Key` recibe la misma orden y la de otro usuario recibe `409 manual.orden_en_curso` (no se acumulan pulsos sobre el mismo relé).
- **Señales** para el panel de AGROCOM (ADR 0030 §4): uso intensivo por usuario, uso de la puerta fuera de horario habitual y órdenes sin ejecutar repetidas.
- **Aviso al administrador:** cada apertura manual aparece en su bandeja de lecturas; el uso inusual genera una notificación (reutiliza la bandeja de W9).
- Estos límites **no aplican al QR**: validar un QR nunca se limita (ADR 0030).

### 8. Qué ve cada nivel

- **Placa:** pregunta órdenes, ejecuta el mismo pulso del relé con el mismo tope de `segundos_apertura`, informa el resultado y el sensor confirma como hoy. Máquina de estados no bloqueante; la espera de órdenes no frena la lectura del QR (son canales independientes).
- **API:** acciones `abrir-puerta-manual`, `configurar-apertura-manual`, `entregar-orden` (placa), `registrar-resultado-de-orden` (placa) y `vencer-ordenes` (proceso periódico).
- **App:** botón «Abrir puerta» (entrada o salida), pantalla del administrador, historial con «Apertura manual». Sin conexión (ADR 0027) no se ofrece: es una acción en línea.
- **Panel web (AGROCOM):** estadísticas del modo manual: usos totales, por puerta y por cuenta, frecuencia por día y hora, cuentas con el modo activo, proporción manual contra QR y fallos.

## Alternativas descartadas

- **MQTT / servicio administrado de IoT:** ver §2. Se reevalúa si hace falta inmediatez o crece la flota.
- **WebSocket persistente:** misma complejidad operativa que MQTT sin su ecosistema; la petición larga logra lo mismo para una orden cada tanto.
- **Sondeo corto (cada 1–2 s):** carga constante de peticiones vacías por cada placa, 24 horas; la petición larga hace una cada 20 s.
- **Que la app hable con la placa por la red local:** exige que el móvil esté en la misma red, rompe el aislamiento por cuenta y deja a la API sin registro.
- **Un QR «oculto» que la app genera y le pasa a la placa:** obligaría a la placa a validar algo que no escaneó y mezclaría los dos caminos. Se prefiere una orden explícita con su propia tabla; la analogía con el QR está en que la API valida todo y la orden se consume una vez.
- **Una placa con dos lectores:** sin pines libres en el ESP32-ETH01 (ver `docs/hardware/`). Se mantiene una placa por lector.
- **Geovalla:** descartada en esta versión (§5).

## Consecuencias

- **CLAUDE.md** (invariante 2) y **RF-02** se reescriben; **RF-11 y RF-12** son nuevas. El ADR 0009 queda ajustado en su párrafo de comunicación.
- **Base:** `dispositivos.sentido` (y su unicidad nueva), `cuentas.apertura_manual_por_omision`, `puertas.apertura_manual_entrada` y `apertura_manual_salida`, `ordenes_apertura`, `lecturas.metodo = manual` con `usuario_id` y `sentido`, permisos nuevos y topes en `configuracion_limites`. Los datos de local y producción son de prueba: se puede reestructurar y volver a sembrar. El `CHECK` de `lecturas.metodo` se rehace con `DROP CONSTRAINT` + `ADD CONSTRAINT` (en MariaDB cambiar un `CHECK` exige `ALGORITHM=COPY`, que copia la tabla y bloquea las escrituras; con datos de prueba no importa). Con datos reales habría que hacerlo con la API detenida un instante, como en W14.
- **Firmware:** un lazo nuevo de órdenes, independiente del lector; es parte de lo que **no se delega sin revisión línea por línea** (acciona la cerradura).
- **Tests obligatorios:** cuenta A pidiendo abrir una puerta de la cuenta B → 404; puerta no habilitada → rechazo registrado; usuario restringido, suspendido o eliminado → rechazo; orden vencida o ya entregada no se vuelve a entregar; dos placas no se llevan la misma orden; la placa de otra puerta o de otro sentido no la recibe; sin conexión la placa no abre; reintento con la misma `Idempotency-Key` no duplica; enfriamiento y tope diario; la espera de órdenes no consume conexiones del pool; la ejecución queda en `confirmaciones_apertura`.
- **Pendiente para después de esta versión:** geovalla por puerta (GPS de ambos lados), MQTT si hace falta, y la política de retención de `ordenes_apertura` junto con la duda D-06.
