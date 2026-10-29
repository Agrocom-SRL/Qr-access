# Hardware del controlador de puerta

**Estado:** Referencia (2026-10-13, lector RS485 de mesa). Confirmado: ESP32 con lector QR en la puerta y cerradura por pulso (D-01, D-03, D-04). La cerradura se elige al comprar; el lector de la mesa de trabajo es RS485 (ver abajo). ADR 0009 y ADR 0025 (solo Ethernet y vinculación remota).

## Lista de materiales (por puerta)

| Componente | Referencia sugerida | Notas |
|---|---|---|
| Microcontrolador | ESP32-ETH01 (ESP32 + Ethernet LAN8720) | Ethernet por cable, **sin WiFi** (ADR 0025); TLS por hardware; framework Arduino |
| Lector | Lector de control de acceso con salida RS485 y Wiegand (etiqueta "ID RS485 USB, WG26/34/32/66"; modelo exacto sin confirmar) + módulo TTL-RS485 (MAX485) | Sustituye al GM65/GM861S previsto; confirmar que lee QR y su velocidad y formato de salida |
| Actuador | Módulo relé 1 canal con optoacoplador (5 V, o 12 V como el de la mesa: Tongling JQC-3FF-S-Z, jumper H/L; su bobina va a la fuente de 12 V) **o** MOSFET logic-level (IRLZ44N) + diodo flyback | El MOSFET es silencioso y más durable para electroimán |
| Cerradura | Electroimán 280 kg (fail-safe) o cerradero eléctrico 12 V (fail-secure) | D-04: definir según la puerta y la norma de evacuación |
| Sensor de puerta | Contacto magnético (reed) NC | Detecta puerta abierta y apertura forzada |
| Pulsador de salida | Pulsador NO de "salida" | Abre sin red (RF-08) |
| Indicadores | LED RGB (o 2 LEDs) + buzzer activo 5 V | Permitido / denegado / sin red |
| Alimentación | Fuente 12 V 3 A + regulador buck 12→5 V 2 A | Separar la alimentación de la cerradura de la lógica |
| Respaldo (opcional) | UPS 12 V con batería | Para cortes de energía |
| Gabinete | Caja IP54 para el controlador; el lector, en la cara exterior | |

## Conexiones de referencia (ESP32-ETH01)

| Señal | Pin ESP32 | Notas |
|---|---|---|
| Módulo RS485 RO → ESP32 RX | GPIO5 (pin "RXD" del conector) | Si el módulo va a 5 V, divisor resistivo o level shifter |
| ESP32 TX → módulo RS485 DI | GPIO17 (pin "TXD" del conector) | Sin uso mientras DE esté a GND |
| Relé / MOSFET (cerradura) | GPIO4 (pin "IO4") | Salida; nivel activo configurable (`CERRADURA_NIVEL_ACTIVO`) |
| Sensor de puerta | GPIO14 | `INPUT_PULLUP` |
| Pulsador de salida | GPIO12 | `INPUT_PULLUP`, con antirrebote por software; al arrancar debe estar bajo |
| LED verde / rojo / azul | GPIO2 / GPIO32 (pin "CFG") / GPIO33 (pin "485_EN") | Con resistencia |
| Buzzer | GPIO4 (pin "IO4", el mismo del relé) | Buzzer activo en paralelo al relé: suena solo mientras la cerradura está activa. El firmware no lo maneja aparte |

En la ESP32-ETH01 la PHY LAN8720 (RMII) ocupa los GPIO 0, 18, 19, 21, 22, 23, 25, 26 y 27, y el GPIO16 enciende su oscilador: ninguno está libre ni sale al conector. Por eso el lector usa GPIO5 y GPIO17, y el resto de las señales van en los pines de la tabla. Los GPIO25/26/27 y 18/19/21/22 de una ESP32 genérica **no** sirven en esta placa.

Los pines viven solo en `firmware/include/pines.h` (la asignación de la tabla es la de `ACCESO_ETH01`; la rama `#else` es para una ESP32 genérica). Evitar GPIO 0, 2, 12 y 15 (pines de arranque) y 34–39 como salidas (son solo entrada).

## Lector RS485 en la mesa de trabajo (2026-10-13)

El lector trae un cable de 9 hilos (etiqueta del lector):

| Color | Señal | Se usa |
|---|---|---|
| Rojo | VCC | Sí: alimentación del lector (la fuente de la mesa es de 12 V, confirmar el voltaje del lector) |
| Negro | GND | Sí |
| Azul | 485A | Sí, a A del módulo RS485 |
| Naranja | 485B | Sí, a B del módulo RS485 |
| Blanco / Verde | WD1 / WD0 (Wiegand) | No |
| Morado / Gris | Beeper / LED | No |
| Amarillo | NC | No |

Cableado:

1. **Tierra común:** negativo de la fuente, GND del lector, GND del módulo RS485 y GND de la placa son un solo nodo. Se mide continuidad antes de energizar.
2. **RE y DE del módulo a GND:** RE es activo en bajo (receptor siempre encendido) y DE activo en alto (transmisor apagado). El módulo solo recibe, porque el lector transmite y la placa escucha. Si algún día el firmware tiene que mandar comandos al lector, DE pasa a un GPIO. RE y DE **nunca** a 12 V.
3. **Módulo RS485 ↔ placa:** RO a GPIO5 (RXD). VCC del módulo a 3,3 V si es posible; a 5 V obliga a un divisor en RO porque el ESP32 tolera 3,3 V. El módulo de la foto (MAX485, serigrafía "TTL to RS-485 module") es de 5 V.
4. **La placa nunca recibe los 12 V.** Se alimenta a 5 V (buck 12→5 V, o el módulo USB-serie en la mesa).
5. Si no llegan datos, se invierten A y B. La velocidad por defecto es 115200 (confirmada con el ZKTeco QR600); se cambia con `-DLECTOR_BAUDIOS=<n>` en `build_flags`.

**Pendiente:** el modelo y el protocolo del lector. Con el lector enchufado se lee por el monitor serie lo que llega al pasar un QR; el firmware espera una línea de texto terminada en CR o LF (`lector_qr`). Si el lector manda tramas binarias o un formato distinto, se ajusta `lector_qr` y se anota aquí.

### Alimentar y programar la placa con el módulo USB-serie

Conexiones: TX del módulo a RXO de la placa, RX del módulo a TXO, GND con GND y 5 V con el pin 5V (o 3,3 V con 3V3, pero un módulo USB suele quedarse corto de corriente con el Ethernet). Para flashear se puentea IO0 a GND y se resetea (EN a GND un instante); **se quita el puente** después. Esta placa puede no tener LED de encendido: que no alumbre no indica falla. Se comprueba con un multímetro (3V3 contra GND) o con el arranque por el monitor serie a 115200.

## Relé en la mesa de trabajo (2026-10-15)

El relé actúa como un pulsador: sus contactos secos **COM** y **NO** se conectan en paralelo a la entrada de apertura del equipo de la puerta, y la placa solo los une durante el pulso. No transporta datos ni corta la alimentación del equipo.

1. Fuente de 12 V (la del lector): (+) a DC+ y (−) a DC− del relé.
2. Tierra común: el (−) de la fuente también va a GND de la placa. La placa se alimenta a 5 V, nunca con los 12 V.
3. IN del relé a **IO4** de la placa (GPIO4, `PIN_CERRADURA`).
4. Sin carga todavía, se prueba con el multímetro en continuidad entre COM y NO: en reposo no suena; con un QR válido suena y el relé hace clic durante `segundos_apertura`.
5. Si no hay clic, se prueba la otra posición del jumper H/L; si hace falta, se cambia `CERRADURA_NIVEL_ACTIVO` en `pines.h`.
6. Los bornes (DC+, DC−, IN y contactos) se identifican con la serigrafía o el multímetro, no por posición.

**Pendiente:** el equipo de la puerta (tensión y tipo de su entrada de apertura) para cablear COM y NO.

## Seguridad física

- El controlador (ESP32 + relé) va **del lado seguro** de la puerta; afuera solo el lector. Si alguien arranca el lector, no llega a los cables del relé.
- Diodo flyback en la bobina de la cerradura; masa común entre la lógica y el relé solo si el módulo no está optoacoplado.
- Puerto USB del ESP32 inaccesible desde afuera (permite reflashear).

## Alta y vinculación de una placa (ADR 0026)

**Todas las placas son iguales**: no llevan credenciales de ninguna cuenta ni código de fábrica, y la URL de la API va en el binario. No hay nada que registrar ni que cargar por serie: la placa se anuncia sola y AGROCOM la asigna a una puerta desde el panel web.

**En el taller, una vez por placa:** flashear el firmware de producción (`pio run -e esp32 -t upload`). Para cargar por USB-serie en la ESP32-ETH01 se puentea GPIO0 a GND y se resetea; **se quita el puente** después de flashear. El mismo binario sirve para todas las placas.

**En la instalación** (lo hace cualquiera, sin conocimientos técnicos):

1. Conectar el cable de red y la corriente. La placa sortea su clave (generador del hardware, nunca viaja del servidor a la placa) y se anuncia cada 30 s (`POST /dispositivos/anunciar`). En el panel aparece sola como **Detectada**.
2. En el panel (**Placas**, solo super admin), **Vincular**: elige cuenta, una puerta sin lector y un nombre. La placa pasa a **Esperando el botón** durante 10 minutos.
3. En la puerta, la placa lo avisa con el **LED azul parpadeando y un beep cada 2 s**. Se **mantiene pulsado el pulsador de salida 5 segundos**: esa es la prueba de presencia física que impide que alguien que solo conoce la MAC se quede con el vínculo.
4. La placa avisa al servidor (`POST /dispositivos/confirmar`), recibe el id de su dispositivo, da un destello verde con un beep y empieza a validar QR y a enviar latidos.

Si la ventana vence o se cancela desde el panel, la placa vuelve a **Detectada**; basta con volver a vincular.

**Liberar y dar de baja** (panel web, solo super admin):

- **Liberar:** revoca el dispositivo. La placa recibe 401, olvida su id, sortea una clave nueva y vuelve a anunciarse como detectada; para otra cuenta se repite la confirmación con el botón.
- **Dar de baja:** una placa libre que se perdió o dañó sale del inventario. Una placa detectada que no se anuncia en 7 días sale sola; si sigue enchufada, reaparece.

Sin vínculo (o con la credencial rechazada, por ejemplo una cuenta suspendida) la placa **no valida ningún QR**: solo atiende el pulsador de salida. Con la credencial rechazada sigue anunciándose con la misma clave, y retoma sola si el servidor confirma el mismo dispositivo. La URL tiene que ser `https://`: el firmware de producción no acepta `http://`.

**Recuperación:** `borrar` elimina lo cargado (solo el espacio `acceso` de la NVS; no borra la flash). `set api_url <https://…>` reemplaza la URL de fábrica si hiciera falta. Para una mesa de trabajo, `set disp_id` y `set disp_clave` cargan una credencial a mano.

## Confirmación de la apertura y latido ampliado (ADR 0031 §18; contrato de la API, ola W10)

La placa sigue sin lógica de negocio: lee pines y reporta. Lo de abajo es **solo un informe**: nada de esto abre, cierra ni retrasa una validación, y la puerta **nunca** abre por una respuesta de estos endpoints. Todas las rutas llevan `Authorization: Dispositivo <id>.<clave>`, usan el pool del dispositivo y responden `Cache-Control: no-store`.

**1. Configuración** — `GET /api/v1/dispositivos/configuracion` → `200`:

```json
{ "segundos_apertura": 6, "zona_horaria": "America/La_Paz", "ota": null,
  "sensor_puerta": { "instalado": false, "nivel_abierto": "alto" },
  "espera_confirmacion_segundos": 11 }
```

- `sensor_puerta.instalado` (bool): si el contacto magnético está habilitado para esta puerta. **Vale `false` hasta que AGROCOM lo habilite** (`PUT /plataforma/placas/{id}/sensor`) tras verificar el cableado; una placa no puede saberlo sola. Con `false` la placa no interpreta el pin y informa `sin_sensor`. El servidor juzga las aperturas desde que se habilitó el sensor (`sensor_habilitado_at`, no se expone en la API); si con `instalado: true` la placa informa `sin_sensor`, el servidor lo cuenta como falla.
- `sensor_puerta.nivel_abierto` (`"alto"` o `"bajo"`): nivel que lee el pin (`INPUT_PULLUP`) con la puerta ABIERTA. **Polaridad pendiente de confirmar en campo**: por omisión `"alto"`; el firmware usa el valor del servidor (ya no hay constante de compilación en `pines.h`; el valor por omisión, marcado como pendiente de confirmar, es `NIVEL_ABIERTO_POR_OMISION` en `firmware/lib/confirmacion`). Mientras no haya leído la primera configuración válida la placa **no sabe** si hay sensor: no observa ninguna apertura (no informa nada, el servidor lo toma como «sin respuesta») y el latido omite `sensor_puerta` (manda solo `puerta_abierta: false`, campo obligatorio); nunca afirma `sin_sensor` por no haber leído nada. Con el sensor no instalado el latido manda `puerta_abierta: false`, porque el pin al aire con pull-up leería «abierta».
- `espera_confirmacion_segundos` (int): cuánto espera la placa ver la puerta abierta, contado desde el inicio del pulso del relé (`segundos_apertura` + 5).

**2. Latido ampliado** — `POST /api/v1/dispositivos/latidos` (sin cambios de ruta, cada 60 s) → `204`. Cuerpo estricto (cualquier campo no listado es `400`):

```json
{ "firmware": "1.3.0", "rssi": -61, "puerta_abierta": false,
  "lector_responde": true, "sensor_puerta": "cerrada" }
```

- `firmware` (string 1–20), `rssi` (int −200..100), `puerta_abierta` (bool): obligatorios, como hasta ahora.
- `lector_responde` (bool, opcional): si el lector QR responde por UART.
- `sensor_puerta` (opcional): `"abierta"`, `"cerrada"` o `"sin_sensor"` (la placa no lo tiene habilitado). Omitirlo no borra el último valor guardado. Es diagnóstico; no decide nada.

**3. Confirmación de apertura** — `POST /api/v1/dispositivos/confirmaciones`. Tras un `abrir: true` de `POST /dispositivos/validaciones`, la placa conserva el `evento_id` de la respuesta y, cuando sabe el desenlace, informa **una sola vez** (cuerpo estricto):

| `resultado` | Campos | Cuándo |
|---|---|---|
| `"ejecutada"` | `evento_id` | El sensor vio abrir la puerta (`nivel_abierto`) dentro de `espera_confirmacion_segundos`. Se envía en cuanto se ve, sin esperar al fin del plazo |
| `"fallida"` | `evento_id`, `causa` (opcional, por omisión `"puerta_no_abrio"`) | `"puerta_no_abrio"`: se accionó el relé y venció el plazo sin ver abrir. `"rele_no_accionado"`: la placa no pudo accionar el relé. `"puerta_no_cerro"`: opcional, si decide esperar al cierre y no ocurrió |
| `"sin_sensor"` | `evento_id` | `sensor_puerta.instalado` es `false`: se informa igualmente, una vez |

`evento_id` es el string de dígitos devuelto por la validación. `leido_en` (ISO 8601, opcional, ≤ 40 caracteres) es la hora del reloj de la placa, solo informativa (la hora válida es la del servidor).

Respuestas: `204` sin cuerpo (registrado, **o ya había un informe de esa apertura**: es idempotente, el primer informe es el que vale); `400` cuerpo inválido; `401` credencial inválida (mismo trato que en las validaciones); `404 evento.no_encontrado` si el evento no es una apertura permitida de ESTE dispositivo (de otra puerta, de otra cuenta, rechazado o inexistente); `409 confirmacion.fuera_de_plazo` si pasaron más de 10 minutos de la orden; `429 limite.excedido` (límite por credencial, aparte del de validaciones: nunca compite con ellas); `503 servicio.no_disponible` (con `Retry-After`).

Reglas para el firmware:
- Enviarlo **en segundo plano, después** de haber accionado y atendido la lectura siguiente: nunca debe retrasar una validación ni mantener el relé.
- Reintentar solo ante falta de red, `429` o `5xx`, con espera creciente, hasta unos 10 minutos desde la orden; con cualquier otro `4xx` se descarta. Perder el informe es aceptable (el servidor lo toma como «sin respuesta»); no hace falta persistirlo.
- Un solo informe por apertura. Si la puerta se vuelve a abrir con otro QR, es otro `evento_id`.
- Plazo por omisión de observación (sin `espera_confirmacion_segundos` en la configuración): los segundos reales de apertura vigentes (`segundos_apertura` de la configuración, tope duro 10 s) más 5 s.
- Segundo plano acotado: latido, informe y configuración usan 1 s por fase (conexión, handshake TLS, lectura) y no se inician hasta 10 s después del último byte del lector, para no retener la tarea de red cuando llega una validación. Un pedido de validación que esperó 3 s o más se descarta sin enviarse (la máquina de estados ya lo abandonó; enviarlo solo consumiría el QR sin abrir).

Limitaciones conocidas del diagnóstico (informativas; el servidor las tolera):
- **Aperturas solapadas.** Si una apertura ocurre mientras se observa otra, la primera se cierra con lo que se vio hasta entonces; si la puerta aún no se había abierto puede informarse `puerta_no_abrio` aunque el usuario esté entrando (falso negativo). Es raro: el lector se ignora mientras hay una validación o el relé activo.
- **Apertura física dentro de la ventana.** Si alguien abre la puerta con el pulsador de salida o la llave dentro del plazo de observación, el sensor la ve abrir y la apertura cuenta como `ejecutada`; el sensor no distingue quién la abrió.
- **`lector_responde` cuenta cualquier byte.** El lector es pasivo; basta un byte por la UART (incluso ruido) para marcarlo como «responde». Sin bytes desde el arranque el campo se omite; pasado un día sin bytes se informa `false` (puede estar caído o solo sin uso).

Qué hace el servidor (para quien consuma el estado): ver la ficha `docs/modelo-datos/tablas/32_confirmaciones_apertura.md` y el ADR 0031 §18.

## Apertura manual y dos placas por puerta (ADR 0035)

- **Una placa por lector.** Si una puerta necesita entrada y salida, lleva **dos placas ESP32-ETH01**, cada una con su lector y su relé (o la segunda solo con relé mientras no tenga lector). Una placa con dos lectores se descartó: el ESP32-ETH01 no tiene pines libres para un segundo lector (los pines del PHY Ethernet RMII ocupan buena parte del chip; ver `firmware/include/pines.h`). Cada placa se vincula con su propio sentido (`entrada` o `salida`; `ambos` si hay una sola).
- **Cableado de la cerradura con dos placas.** Cada placa acciona su propio relé. Si ambos relés actúan sobre la **misma** cerradura, se conectan en **paralelo** (contactos `NO`/`COM` de los dos relés en el mismo circuito del pulso); nunca se unen las salidas de dos placas entre sí. Verifica con el electricista antes de energizar.
- **Una placa, una puerta.** Si la puerta lleva una sola placa (`ambos`), el lector y la apertura manual abren por el **mismo relé**: es la misma cerradura, y para salir basta la app. Si la entrada y la salida son **dos puertas físicas**, cada una necesita su placa y su relé; una puerta de salida sin placa no se puede abrir ni con el botón de la app.
- **Interruptor en la placa.** La configuración de la API trae `apertura_manual` (bool). Con `false` la placa no hace la petición larga de órdenes; solo atiende el lector QR.
- **Apertura manual (sin lector).** La placa pregunta por órdenes de apertura a la API con una petición larga (`GET /api/v1/dispositivos/ordenes`, ~20 s) por la misma Ethernet y la misma credencial. Al recibir una orden vigente, da el **mismo pulso** del relé (`segundos_apertura`, con su tope) y reporta el resultado; el sensor de puerta la confirma como en las aperturas por QR. Esta función sirve de respaldo si se avería o roban el lector.
- **Falla segura:** sin red, sin orden o con una orden cuyo plazo (`valida_por_ms`) ya corrió, la placa no abre. Las únicas aperturas sin servidor son el pulsador de salida y la llave mecánica.
- El contrato exacto de los endpoints de la placa se agrega aquí al implementar el firmware (ola AM2), como el de la ola W10.

## Compilación de desarrollo

`pio run -e esp32-dev -t upload` compila con `ACCESO_DESARROLLO`: permite una API `http://` (la API local del Mac, por la red cableada) y lee `include/secretos.h` (copia de `secretos.example.h`, no versionado) cuando no hay nada en NVS. Imprime un aviso al arrancar y reporta la versión `0.5.0-dev` en el latido. Es solo para la mesa de trabajo: nunca se publica ni se instala en una puerta real. El env `esp32` (el que compila `bin/verify`) no contiene ninguno de esos dos caminos.

## Indicaciones

| Situación | LED | Buzzer |
|---|---|---|
| Validando | azul fijo | - |
| Permitido (`acceso.permitido`) | verde fijo 1,5 s | 1 beep corto |
| Denegado (cualquier `motivo_code` con `abrir:false`: `qr.vencido`, `qr.usado`, `suscripcion.vencida`...) | rojo fijo 1,5 s | 2 beeps |
| Sin red (sin cable, sin vincular o sin hora NTP: no se valida) | azul parpadeando | 3 beeps cortos |
| Error (timeout, TLS, respuesta inválida, 401) | rojo parpadeando rápido | 1 beep largo |

El motivo exacto sale por el serie (`[puerta] denegado: QR vencido`), sin el token completo.

## Probar con la placa

1. `pio test -e native` y `pio run` en verde.
2. Flashear (con tu confirmación; no se flashea sin ella) y abrir el monitor serie. Dar de alta y vincular como arriba.
3. Sin el cable de red: leer un QR da el patrón "sin red" y la cerradura no se mueve; el pulsador de salida abre igual (3 s).
4. Con la API: QR válido, relé 5 s (o lo que diga `segundos_apertura`, nunca más de 10 s); el mismo QR otra vez da denegado (`qr.usado`).
5. Apagar la API durante una lectura: a los 3 s, patrón de error y no abre.
