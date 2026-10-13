# Hardware del controlador de puerta

**Estado:** Referencia (2026-10-08). Confirmado: ESP32 con lector QR en la puerta y cerradura por pulso (D-01, D-03, D-04). El modelo del lector y la cerradura se eligen al comprar. ADR 0009 y ADR 0025 (solo Ethernet y vinculación remota).

## Lista de materiales (por puerta)

| Componente | Referencia sugerida | Notas |
|---|---|---|
| Microcontrolador | ESP32-ETH01 (ESP32 + Ethernet LAN8720) | Ethernet por cable, **sin WiFi** (ADR 0025); TLS por hardware; framework Arduino |
| Lector QR | GM65 o GM861S (UART, 5 V / 3.3 V) | Lee QR en pantalla de teléfono; configurar modo continuo/sensor |
| Actuador | Módulo relé 1 canal con optoacoplador (5 V) **o** MOSFET logic-level (IRLZ44N) + diodo flyback | El MOSFET es silencioso y más durable para electroimán |
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
| Lector QR TX → ESP32 RX | GPIO16 (UART2 RX) | Si el lector es de 5 V, divisor resistivo o level shifter |
| ESP32 TX → Lector QR RX | GPIO17 (UART2 TX) | Para configurar el lector por comandos |
| Relé / MOSFET | GPIO25 | Salida; nivel activo configurable |
| Sensor de puerta | GPIO26 | `INPUT_PULLUP` |
| Pulsador de salida | GPIO27 | `INPUT_PULLUP`, con antirrebote por software |
| LED verde / rojo / azul | GPIO18 / GPIO19 / GPIO21 | Con resistencia |
| Buzzer | GPIO22 | |

Los pines viven solo en `firmware/include/pines.h`. Evitar GPIO 0, 2, 12 y 15 (pines de arranque) y 34–39 como salidas (son solo entrada).

## Seguridad física

- El controlador (ESP32 + relé) va **del lado seguro** de la puerta; afuera solo el lector. Si alguien arranca el lector, no llega a los cables del relé.
- Diodo flyback en la bobina de la cerradura; masa común entre la lógica y el relé solo si el módulo no está optoacoplado.
- Puerto USB del ESP32 inaccesible desde afuera (permite reflashear).

## Alta y vinculación de una placa (ADR 0025)

La placa **no lleva credenciales de ninguna cuenta**: sale del taller con su MAC y un código de vinculación, y AGROCOM la asigna a una puerta desde el panel web. No hace falta volver a conectarle un cable USB cuando cambia de cuenta.

**En el taller, una vez por placa** (USB, 115200 baudios; `pio device monitor`):

1. Flashear el firmware de producción (`pio run -t upload`, env `esp32`). Para cargar por USB-serie en la ESP32-ETH01 se puentea GPIO0 a GND y se resetea; **se quita el puente** después de flashear.
2. Por serie, `estado` muestra la **MAC** de la placa.
3. En el panel web (**Placas › Registrar placa**) se registra la MAC; el panel muestra **una sola vez** el código de vinculación y el comando para cargarlo.
4. Por serie, un campo por línea (el firmware no repite nunca un valor y una clave no aparece en ningún log):

```
set api_url https://acceso.agrocom.com.bo
set codigo <código de 16 caracteres del panel>
estado                        (qué hay cargado, sin claves)
reiniciar
```

La placa sortea su propia clave en el primer arranque (generador del hardware) y la guarda en la NVS; nunca viaja del servidor a la placa.

**En la instalación:** el cliente conecta el cable de red y la corriente. La placa pregunta a la API cada 30 s (`POST /dispositivos/reclamar`) y el panel la muestra como **Lista para vincular**.

**Vincular y liberar** (panel web, solo super admin):

- **Vincular:** elige cuenta, una puerta sin lector y un nombre. En su siguiente sondeo la placa recibe el id de su dispositivo y empieza a validar QR y a enviar latidos.
- **Liberar:** revoca el dispositivo. La placa recibe 401, olvida su id, sortea una clave nueva y vuelve a esperar; se puede vincular a otra cuenta sin tocarla.
- **Dar de baja:** una placa libre que se perdió o dañó sale del inventario.

Sin vínculo (o con la credencial rechazada, por ejemplo una cuenta suspendida) la placa **no valida ningún QR**: solo atiende el pulsador de salida. Con la credencial rechazada sigue preguntando con la misma clave, y retoma sola si el servidor confirma el mismo dispositivo. La URL tiene que ser `https://`: el firmware de producción no acepta `http://`.

**Recuperación:** `borrar` elimina lo cargado (solo el espacio `acceso` de la NVS; no borra la flash). Para una mesa de trabajo, `set disp_id` y `set disp_clave` cargan una credencial a mano, como antes.

## Compilación de desarrollo

`pio run -e esp32-dev -t upload` compila con `ACCESO_DESARROLLO`: permite una API `http://` (la API local del Mac, por la red cableada) y lee `include/secretos.h` (copia de `secretos.example.h`, no versionado) cuando no hay nada en NVS. Imprime un aviso al arrancar y reporta la versión `0.4.0-dev` en el latido. Es solo para la mesa de trabajo: nunca se publica ni se instala en una puerta real. El env `esp32` (el que compila `bin/verify`) no contiene ninguno de esos dos caminos.

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
