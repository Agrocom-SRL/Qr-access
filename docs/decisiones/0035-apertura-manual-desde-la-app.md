# ADR 0035 — Apertura manual de la puerta desde la app y hasta dos placas por puerta

**Estado:** Aceptada (2026-10-29), decidida con Miguel. Ajusta el ADR 0009 (el servidor ahora también le habla a la placa) y la invariante 2 de `CLAUDE.md`. No cambia el ADR 0008: el QR sigue siendo de un solo uso.

## Contexto

Hoy se entra con el lector QR de la placa, pero en las casetas de los condominios no hay un segundo lector para salir. Hasta decidir si cada puerta lleva **una placa con dos lectores** o **dos placas, una por lado**, hace falta una forma de abrir sin lector: la persona la pide desde la app (Flutter, móvil o web) y la API se la ordena a la placa.

También sirve de respaldo cuando el lector se avería, se pierde o se lo roban, cuando se actualiza la placa o cuando falla el internet de la caseta. Y para quien ya usa su QR propio es el camino más rápido de entrar o salir.

Restricciones que ya existían:
- La placa solo hace peticiones HTTPS salientes (validar, latido cada 60 s, configuración). La API **no puede** conectarse a ella (ADR 0009; ADR 0025: solo Ethernet).
- Una puerta admite un solo dispositivo en servicio (`uq_dispositivos_puerta`).
- `lecturas` solo admite los métodos `qr`, `pulsador` y `forzada`, y no guarda quién abrió.
- Qué pasó con una orden de abrir ya tiene su registro: `confirmaciones_apertura` (ADR 0031 §18).

## Decisión

### 1. La apertura manual es un QR sin imagen: misma validación, otro canal

Quien abre desde la app no escanea nada, pero **la API lo valida igual** que valida un QR: sesión vigente, usuario activo (no restringido, suspendido ni eliminado), suscripción vigente, puerta de su cuenta y puerta con el modo manual habilitado. Si todo pasa, la API **ordena** la apertura a la placa. La placa no decide nada: espera una orden positiva del servidor y obedece.

Por eso la **invariante 2 se mantiene en su espíritu y se reescribe**: *la puerta nunca abre sin una orden positiva del servidor* (validación de un QR **o** apertura manual autorizada). Sin red, sin orden o con una orden inválida o vencida, no abre. Las únicas aperturas sin servidor siguen siendo las físicas (pulsador de salida y llave).

**La app no sabe de sentidos.** Sin geovalla nadie sabe si la persona está entrando o saliendo; lo único que existe es de qué lado de la propiedad está el lector. Por eso la app solo muestra las puertas que se pueden abrir y la persona elige una: **un botón «Abrir puerta» que no dice entrada ni salida**, y la petición no lleva ningún sentido.

### 2. Cómo recibe la orden la placa: petición larga (*long polling*) sobre HTTPS

La placa ya está conectada por Ethernet y habla HTTPS con la API. En lugar de abrir un canal nuevo, **pregunta por órdenes**:

- `GET /api/v1/dispositivos/ordenes`: la API **retiene la petición hasta ~20 s**. Si entra una orden para la puerta de esa placa, responde al instante con ella; si no, responde `204` y la placa vuelve a preguntar de inmediato. La latencia de una orden es de ~1 s.
- `POST /api/v1/dispositivos/ordenes/{id}/resultado`: la placa informa que ejecutó la orden (o por qué no pudo).
- Misma credencial `Dispositivo <id>.<clave>` (invariante 5) y mismo pool de base reservado a dispositivos (ADR 0032 §1).

**Por qué no MQTT.** Hace falta un *broker* (Mosquitto propio en el `docker-compose` o un servicio administrado), un puerto TLS nuevo abierto a internet, usuarios y ACL por dispositivo, y mantener una conexión persistente. Es más inmediato, pero suma una pieza que operar y una superficie de ataque. Las plataformas de IoT administradas (AWS IoT, etc.) cobran por mensaje y conexión; **The Things Network** es para LoRaWAN, no sirve con una placa Ethernet. La petición larga es **gratis**, reutiliza toda la seguridad existente y sale por el mismo camino que ya usa la placa. Si algún día la latencia o la cantidad de placas lo exigen, MQTT se suma sin cambiar el modelo de órdenes (la tabla y las reglas son las mismas; cambia el transporte).

**Cuidado con el ADR 0032 §1.** Una petición retenida ocupa un manejador de Fastify, no una conexión de base: la API no debe tomar una conexión del pool mientras espera. Se espera en memoria (una señal por puerta, con la base como árbitro y respaldo) y solo se consulta la base al llegar la orden, al vencer los 20 s o al arrancar la petición. El tiempo máximo de ruta de dispositivo (2,5 s, ADR 0032 §1) **no** aplica a esta ruta: tiene su propio plazo (`PETICION_MS_ORDENES`, mayor que la espera), y el firmware usa un tiempo de espera propio para ella.

### 3. La orden es de la puerta, no de una placa: la primera que la toma la ejecuta

Tabla nueva `ordenes_apertura` (ficha 38):

- La crea la API al validar la petición de la app, con `puerta_id`, `usuario_id`, la `lectura_id` que la registra y `vence_at` (por defecto 15 s; ninguna orden dura más de 30 s). **No lleva sentido ni placa destino.**
- **Una puerta tiene una o dos placas** (el lector de afuera y el de adentro) y todas accionan **la misma cerradura**. La orden se la lleva **la primera placa de esa puerta que la reclame** dentro de su petición larga; la otra no recibe nada. Con una sola pulsación basta: el resultado es el mismo.
- Estados: `pendiente` → `entregada` (una placa la tomó; se guarda cuál en `dispositivo_id`) → `ejecutada` / `fallida`, o `vencida`. La entrega es **atómica** (`UPDATE … SET estado = 'entregada', dispositivo_id = ? WHERE id = ? AND estado = 'pendiente' AND vence_at > ahora`, una fila): una orden se entrega **una sola vez a una sola placa**, igual que el consumo de un QR (invariante 3, por analogía). Si una de las dos placas está caída, la otra la toma.
- La placa recibe el plazo **relativo** (`valida_por_ms`), no una hora absoluta, para no depender de su reloj. Si lo pasó (red lenta, reintentos), **no abre**.
- Al reconectarse tras una caída, la placa **no ejecuta órdenes viejas**: la API solo entrega las vigentes, y la placa descarta cualquier orden cuyo `valida_por_ms` ya corrió.
- `ordenes_apertura` guarda el estado de la entrega y cambia (no es de solo inserción). El hecho queda en `lecturas` (solo inserción) y el resultado en `confirmaciones_apertura`.

### 4. Una puerta con una o dos placas: `dispositivos.sentido` es la ubicación del lector

Se **mantiene el modelo de una placa por lector**: si la puerta tiene un lector afuera y otro adentro, lleva **dos placas**, cada una con su lector y su relé, y los dos relés se cablean en paralelo sobre la misma cerradura. (Una placa con dos lectores se descartó: el ESP32-ETH01 no tiene pines libres para un segundo lector; es un límite de hardware, no de software.)

- `dispositivos.sentido`: `entrada` (lector del lado de afuera), `salida` (lector del lado de adentro) o `ambos` (valor por omisión, una sola placa). Dice **dónde está el lector**; no interviene en la apertura manual.
- Una puerta tiene como máximo **un dispositivo en servicio por ubicación**, y `ambos` es exclusivo (no se combina con `entrada` ni `salida`). La unicidad pasa de `uq_dispositivos_puerta (puerta_id, en_servicio)` a `uq_dispositivos_puerta_sentido (puerta_id, sentido, en_servicio)`; la exclusividad de `ambos` la hace cumplir la acción de vincular, dentro de la transacción.
- Si la entrada y la salida son **dos puertas físicas** con su propia cerradura, son **dos puertas** en el sistema, cada una con su placa. La que no tenga placa en servicio **no se puede abrir** por ningún método y no aparece en el botón de la app; si la petición llega igual, la API responde `409 puerta.sin_dispositivo`.
- Si la puerta tiene placa pero **ninguna está en línea** (`estado_conexion` distinto de `en_linea`), `409 puerta.sin_conexion`, para que la app avise al instante en vez de esperar un tiempo agotado.

### 5. Quién habilita y quién usa

- **Habilita** el administrador de la cuenta, **por puerta** (`puertas.apertura_manual`), con el permiso `accesos.apertura_manual.configurar`. La cuenta entera es del Administrador de la cuenta; ningún otro rol lo cambia. La pantalla ofrece apagarlo o encenderlo en todas las puertas de la cuenta de una vez.
- **El modo manual convive con el lector.** Que la puerta tenga lector QR y placa no lo impide: el administrador puede dejarlo activo (como respaldo o como el camino más rápido) o apagarlo.
- **Valor inicial y puertas nuevas.** La cuenta nace con el modo manual activo (`cuentas.apertura_manual_por_omision = 1`) y cada puerta nueva toma ese valor. Si el administrador apaga el modo manual de todas las puertas desde la pantalla, esa pantalla también apaga el valor de la cuenta y las puertas que registre después nacen apagadas; vuelve a encenderlas cuando quiera. **Nada lo enciende solo después:** si el administrador lo apagó, sigue apagado aunque la puerta no tenga placa o lector.
- **Disponibilidad efectiva.** Una puerta ofrece la apertura manual solo si el interruptor está encendido **y** tiene al menos una placa en servicio. Donde no hay placa, el administrador no tiene nada que encender o apagar: la pantalla muestra «Sin placa» sin interruptor, y la app no muestra la puerta en el botón. La API devuelve en la configuración de la app la lista de puertas con la función disponible; la app solo muestra u oculta, la autoridad sigue siendo la API (que rechaza igual con `409`).
- **Usan** todos los usuarios de la cuenta, de cualquier rol (permiso `accesos.apertura_manual.usar`, en todos los roles base), sobre esas puertas. Es lo mismo que ya pueden hacer con su QR propio: entrar y salir.
- **La placa también tiene el interruptor.** `GET /dispositivos/configuracion` agrega `apertura_manual` (bool): `true` si la puerta de esa placa tiene el modo manual encendido. Con `false` la placa **no hace la petición larga**: no consulta por órdenes. La placa vuelve a leer su configuración periódicamente (con `ETag`, para que sea barata) y el cambio llega en un minuto; la API además rechaza las órdenes con el modo apagado, así que la seguridad no depende de que la placa se entere.
- Sin geovalla en esta versión (decisión de Miguel): exigir cercanía necesitaría el GPS de la placa y del móvil. Quedó como idea futura, no implementada.

### 6. Registro: sigue siendo una lectura

Cada petición de apertura manual, aceptada o rechazada, queda en `lecturas` (invariante 4):

- `metodo = 'manual'` y `usuario_id` (quién). `qr_acceso_id` y `token_hash` nulos. `dispositivo_id` nulo: al crear la lectura todavía no se sabe qué placa tomará la orden (la tabla es de solo inserción); la placa que la ejecutó queda en `ordenes_apertura` y en `confirmaciones_apertura`.
- `resultado = 'permitido'` con `motivo_code = 'manual.ordenada'` cuando la API crea la orden; `rechazado` con su motivo cuando no (`manual.no_habilitada`, `manual.sin_conexion`, `manual.sin_dispositivo`, `manual.orden_en_curso`, `manual.limite`, `manual.suscripcion_vencida`, …).
- El resultado físico sigue en `confirmaciones_apertura` (misma fila que hoy, colgada de la lectura permitida): `ejecutada`, `fallida` o `sin_confirmacion`. Una orden `vencida` sin respuesta genera `sin_confirmacion` / `sin_respuesta` con origen `servidor`, y alimenta el aviso de aperturas fallidas existente.
- Para el usuario es una lectura más, con «Apertura manual», como las de su QR propio. No muestra entrada ni salida.

### 7. Límites y abuso (ADR 0030)

Abrir sin QR no tiene el tope natural de «un QR, un uso», así que se limita desde el primer día:

- **Enfriamiento** por usuario y puerta (por omisión 10 s entre órdenes) y **tope diario** por usuario (configurable en `configuracion_limites`).
- **Idempotencia:** `Idempotency-Key` obligatoria en `POST /puertas/{id}/abrir`; el reintento de la app devuelve la misma orden, nunca otra.
- **Una orden viva por puerta:** mientras haya una pendiente o entregada, la petición del mismo usuario con la misma `Idempotency-Key` recibe la misma orden y la de otro usuario recibe `409 manual.orden_en_curso` (no se acumulan pulsos sobre el mismo relé).
- **Señales** para el panel de AGROCOM (ADR 0030 §4): uso intensivo por usuario, uso de la puerta fuera de horario habitual y órdenes sin ejecutar repetidas.
- **Aviso al administrador:** cada apertura manual aparece en su bandeja de lecturas; el uso inusual genera una notificación (reutiliza la bandeja de W9).
- Estos límites **no aplican al QR**: validar un QR nunca se limita (ADR 0030).

### 8. Qué ve cada nivel

- **Placa:** pregunta órdenes (solo si `apertura_manual` es `true`), ejecuta el mismo pulso del relé con el mismo tope de `segundos_apertura`, informa el resultado y el sensor confirma como hoy. Máquina de estados no bloqueante; la espera de órdenes no frena la lectura del QR (son canales independientes). Una sola placa lee el QR y recibe las órdenes por el mismo relé.
- **API:** acciones `abrir-puerta-manual`, `configurar-apertura-manual`, `entregar-orden` (placa), `registrar-resultado-de-orden` (placa) y `vencer-ordenes` (proceso periódico).
- **App:** botón «Abrir puerta»: la persona elige entre las puertas disponibles, sin sentidos ni «modo manual» en el texto. Historial con «Apertura manual». Pantalla del administrador. Sin conexión (ADR 0027) no se ofrece: es una acción en línea.
- **Panel web (AGROCOM):** estadísticas del modo manual: usos totales, por puerta y por cuenta, frecuencia por día y hora, cuentas con el modo activo, proporción manual contra QR y fallos.

## Alternativas descartadas

- **MQTT / servicio administrado de IoT:** ver §2. Se reevalúa si hace falta inmediatez o crece la flota.
- **WebSocket persistente:** misma complejidad operativa que MQTT sin su ecosistema; la petición larga logra lo mismo para una orden cada tanto.
- **Sondeo corto (cada 1–2 s):** carga constante de peticiones vacías por cada placa, 24 horas; la petición larga hace una cada 20 s.
- **Que la app hable con la placa por la red local:** exige que el móvil esté en la misma red, rompe el aislamiento por cuenta y deja a la API sin registro.
- **Un QR «oculto» que la app genera y le pasa a la placa:** obligaría a la placa a validar algo que no escaneó y mezclaría los dos caminos. Se prefiere una orden explícita con su propia tabla; la analogía con el QR está en que la API valida todo y la orden se consume una vez.
- **Una placa con dos lectores:** sin pines libres en el ESP32-ETH01 (ver `docs/hardware/`). Se mantiene una placa por lector.
- **Elegir entrada o salida en la app y habilitar el modo por sentido:** sin geovalla nadie sabe hacia dónde va la persona; solo se sabe de qué lado está el lector. Se descartó el sentido en la petición, en la orden y en la lectura.
- **Dirigir la orden a una placa concreta:** obligaría a elegir cuál y a reintentar si está caída; con una orden de la puerta que toma la primera placa disponible no hace falta.
- **Geovalla:** descartada en esta versión (§5).

## Consecuencias

- **CLAUDE.md** (invariante 2) y **RF-02** se reescriben; **RF-11 y RF-12** son nuevas. El ADR 0009 queda ajustado en su párrafo de comunicación.
- **Base:** `cuentas.apertura_manual_por_omision`, `puertas.apertura_manual`, `dispositivos.sentido` (y su unicidad nueva), `ordenes_apertura`, `lecturas.metodo = manual` con `usuario_id`, permisos nuevos y topes en `configuracion_limites`. Los datos de local y producción son de prueba: se puede reestructurar y volver a sembrar. El `CHECK` de `lecturas.metodo` se rehace con `DROP CONSTRAINT` + `ADD CONSTRAINT` (en MariaDB cambiar un `CHECK` exige `ALGORITHM=COPY`, que copia la tabla y bloquea las escrituras; con datos de prueba no importa). Con datos reales habría que hacerlo con la API detenida un instante, como en W14.
- **Firmware:** un lazo nuevo de órdenes, independiente del lector y apagable con `apertura_manual`; es parte de lo que **no se delega sin revisión línea por línea** (acciona la cerradura).
- **Tests obligatorios:** cuenta A pidiendo abrir una puerta de la cuenta B → 404; puerta con el modo apagado → rechazo registrado; puerta sin placa → `409`; usuario restringido, suspendido o eliminado → rechazo; orden vencida o ya entregada no se vuelve a entregar; con dos placas en la puerta, solo una toma la orden; la placa de otra puerta no la recibe; sin conexión la placa no abre; con la placa apagada por configuración no hay petición larga; reintento con la misma `Idempotency-Key` no duplica; enfriamiento y tope diario; la espera de órdenes no consume conexiones del pool; la ejecución queda en `confirmaciones_apertura`.
- **Pendiente para después de esta versión:** geovalla por puerta (GPS de ambos lados), MQTT si hace falta, y la política de retención de `ordenes_apertura` junto con la duda D-06.
