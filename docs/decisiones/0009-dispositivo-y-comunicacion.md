# ADR 0009 — Controlador de puerta: ESP32 + Arduino, HTTPS con la API y falla segura

**Estado:** Aceptada (2026-10-08). Cerradas las dudas D-02 a D-05. El modelo del lector y el detalle eléctrico de la cerradura se confirman cuando se compre el hardware.

## Contexto

Se pidió "Arduino con conexión WiFi" para controlar una puerta eléctrica leyendo QR. Un Arduino UNO/Nano no tiene WiFi ni memoria para TLS, y el ESP8266 anda justo de memoria para HTTPS. El ESP32 tiene WiFi, 520 KB de RAM y TLS por hardware, y se programa con el mismo framework Arduino. El cliente confirmó que usa un ESP32 con un lector QR (D-03), que la cerradura se acciona con un pulso (D-04) y que sin internet no se abre (D-05).

## Decisión

- **Placa**: ESP32 (DevKitC o ESP32-S3), **framework Arduino**, compilado con **PlatformIO**: es reproducible, sirve para CI y el código se puede seguir abriendo en Arduino IDE.
- **Lector**: módulo QR por UART (referencia GM65 / GM861S).
- **Cerradura por pulso**: una salida (relé o MOSFET) da un pulso de `segundos_apertura`, un parámetro de la puerta que entrega la configuración de la API. El firmware le impone un tope máximo. Si después hace falta otro modo (mantener la cerradura energizada, por ejemplo un electroimán *fail-safe*), se agrega como parámetro sin cambiar el flujo.
- **Entradas**: pulsador de salida, que abre sin red por diseño (RF-08), y, opcionalmente, un sensor magnético de puerta.
- **Comunicación: HTTPS sobre WiFi** hacia la API, con TLS verificado contra una CA embebida. Es la opción más simple que cumple: la placa pregunta y la API contesta. La validación se hace en cada lectura, hay un latido cada 60 s y la configuración se pide al arrancar. La placa se autentica con su propia credencial (ADR 0004).
- **Falla segura** (invariante 2): sin una respuesta positiva y válida, no abre. **Sin red no se abre** (D-05): no hay validación local ni lista en la placa.
- **Aprovisionamiento**: la primera vez, la placa levanta un AP con un portal propio (o se configura por serie) para cargar el WiFi, la URL de la API y la credencial del dispositivo, que quedan en la NVS.
- **OTA**: la configuración de la API indica qué binario instalar, y se verifica su hash o firma antes de instalarlo.

## Alternativas descartadas

- **RS485**: es un bus cableado entre equipos; la placa ya tiene WiFi y no hay otro equipo con el que hablar.
- **Firebase / MQTT / AWS IoT**: sirven para que el servidor le hable a la placa en tiempo real (abrir remoto), algo que queda fuera de V1. Agregan un servicio que operar y una dependencia externa. Si se pide abrir desde la app, se suma MQTT sin cambiar el flujo de validación.
- **Arduino UNO/Nano + shield WiFi**: poca memoria para TLS y JSON.
- **Validación local en la placa**: ver ADR 0008 y D-05.
- **Arduino IDE sin PlatformIO**: no es reproducible en CI ni fija las dependencias.

## Consecuencias

- Sin red, solo entra quien usa la salida física o la llave mecánica.
- La lógica de la máquina de estados vive en `lib/` y se prueba en la PC (`pio test -e native`), también desde Docker (ADR 0010).
