# Hardware del controlador de puerta

**Estado:** Referencia (2026-10-08). Confirmado: ESP32 con lector QR en la puerta y cerradura por pulso (D-01, D-03, D-04). El modelo del lector y la cerradura se eligen al comprar. ADR 0009.

## Lista de materiales (por puerta)

| Componente | Referencia sugerida | Notas |
|---|---|---|
| Microcontrolador | ESP32-DevKitC (ESP32-WROOM-32E) o ESP32-S3-DevKitC | WiFi 2.4 GHz, TLS por hardware; framework Arduino |
| Lector QR | GM65 o GM861S (UART, 5 V / 3.3 V) | Lee QR en pantalla de teléfono; configurar modo continuo/sensor |
| Actuador | Módulo relé 1 canal con optoacoplador (5 V) **o** MOSFET logic-level (IRLZ44N) + diodo flyback | El MOSFET es silencioso y más durable para electroimán |
| Cerradura | Electroimán 280 kg (fail-safe) o cerradero eléctrico 12 V (fail-secure) | D-04: definir según la puerta y la norma de evacuación |
| Sensor de puerta | Contacto magnético (reed) NC | Detecta puerta abierta y apertura forzada |
| Pulsador de salida | Pulsador NO de "salida" | Abre sin red (RF-08) |
| Indicadores | LED RGB (o 2 LEDs) + buzzer activo 5 V | Permitido / denegado / sin red |
| Alimentación | Fuente 12 V 3 A + regulador buck 12→5 V 2 A | Separar la alimentación de la cerradura de la lógica |
| Respaldo (opcional) | UPS 12 V con batería | Para cortes de energía |
| Gabinete | Caja IP54 para el controlador; el lector, en la cara exterior | |

## Conexiones de referencia (ESP32-DevKitC)

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

## Aprovisionamiento

V1 se hace **por serie** (USB, 115200 baudios; `pio device monitor` o cualquier terminal). El portal AP queda para una versión posterior.

1. Flashear el firmware de producción (`pio run -t upload`, env `esp32`).
2. En la app, dar de alta el dispositivo: entrega el `id` y la `clave` (se muestra una sola vez).
3. Por serie, un campo por línea (el firmware no repite nunca un valor; una clave no aparece en ningún log):

```
set wifi_ssid <red>
set wifi_clave <clave>        (vacía = red abierta)
set api_url https://acceso.agrocom.com.bo
set disp_id <id>
set disp_clave <clave>
estado                        (qué hay cargado, sin claves)
reiniciar
```

4. Se guarda en NVS; el dispositivo envía su primer latido y la app lo muestra "en línea".
5. `borrar` elimina lo aprovisionado (solo el espacio `acceso` de la NVS; no borra la flash). Después, `reiniciar`.

Sin aprovisionar, el controlador solo atiende el pulsador de salida. La URL tiene que ser `https://`: el firmware de producción no acepta `http://`.

## Compilación de desarrollo

`pio run -e esp32-dev -t upload` compila con `ACCESO_DESARROLLO`: permite una API `http://` (la API local del Mac por la WiFi) y lee `include/secretos.h` (copia de `secretos.example.h`, no versionado) cuando no hay nada en NVS. Imprime un aviso al arrancar y reporta la versión `1.0.0-dev` en el latido. Es solo para la mesa de trabajo: nunca se publica ni se instala en una puerta real. El env `esp32` (el que compila `bin/verify`) no contiene ninguno de esos dos caminos.

## Indicaciones

| Situación | LED | Buzzer |
|---|---|---|
| Validando | azul fijo | - |
| Permitido (`acceso.permitido`) | verde fijo 1,5 s | 1 beep corto |
| Denegado (cualquier `motivo_code` con `abrir:false`: `qr.vencido`, `qr.usado`, `suscripcion.vencida`...) | rojo fijo 1,5 s | 2 beeps |
| Sin red (sin WiFi o sin hora NTP: no se valida) | azul parpadeando | 3 beeps cortos |
| Error (timeout, TLS, respuesta inválida, 401) | rojo parpadeando rápido | 1 beep largo |

El motivo exacto sale por el serie (`[puerta] denegado: QR vencido`), sin el token completo.

## Probar con la placa

1. `pio test -e native` y `pio run` en verde.
2. Flashear (con tu confirmación; no se flashea sin ella) y abrir el monitor serie. Provisionar como arriba.
3. Sin WiFi: leer un QR da el patrón "sin red" y la cerradura no se mueve; el pulsador de salida abre igual (3 s).
4. Con la API: QR válido, relé 5 s (o lo que diga `segundos_apertura`, nunca más de 10 s); el mismo QR otra vez da denegado (`qr.usado`).
5. Apagar la API durante una lectura: a los 3 s, patrón de error y no abre.
