# Hardware del controlador de puerta

**Estado:** Propuesta (2026-10-08) — confirmar con las dudas D-01, D-03 y D-04. ADR 0009.

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

1. Flashear el firmware de la versión publicada.
2. En el primer arranque, el ESP32 levanta un AP `AGROCOM-ACCESO-XXXX` con un portal para cargar WiFi, URL de la API y la credencial (`id` + `clave`) que dio la app al dar de alta el dispositivo.
3. Se guarda en NVS; el dispositivo envía su primer latido y la app lo muestra "en línea".
