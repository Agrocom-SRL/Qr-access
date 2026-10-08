# ADR 0009 — Controlador de puerta: ESP32 + Arduino, HTTPS con la API y falla segura

**Estado:** Propuesta (2026-10-08) — confirmar hardware (dudas D-03 y D-04)

## Contexto

Se pidió "Arduino con conexión WiFi" para controlar una puerta eléctrica leyendo QR. Un Arduino UNO/Nano no tiene WiFi ni memoria para TLS; el ESP8266 queda justo de memoria para HTTPS. El ESP32 tiene WiFi, 520 KB de RAM, TLS por hardware y se programa con el mismo framework Arduino.

## Decisión

- **Placa**: ESP32 (DevKitC o ESP32-S3), **framework Arduino**, compilado con **PlatformIO** (reproducible y apto para CI; el código sigue abriendo en Arduino IDE).
- **Lector**: módulo QR por UART (GM65 / GM861S o equivalente).
- **Actuador**: relé o MOSFET hacia la cerradura (electroimán o cerradero eléctrico, 12 V). Detalle en `docs/hardware/README.md`.
- **Entradas**: sensor magnético de puerta (reed), pulsador de salida (abre sin red, por diseño).
- **Comunicación**: HTTPS (TLS verificado con CA embebida) hacia la API: validación por lectura, latido cada 60 s y configuración. Autenticación con la credencial propia del dispositivo (ADR 0004).
- **Falla segura** (invariante 2): sin respuesta positiva válida, no abre. El relé tiene un tiempo máximo que el firmware impone.
- **Tipo de cerradura**: el firmware soporta "fail-secure" (cerrada sin corriente) y "fail-safe" (abierta sin corriente, exigida a veces por normas de evacuación) con un parámetro; la elección es de la instalación (duda D-04).
- **Aprovisionamiento**: la primera vez, modo AP con un portal propio (o por serie) para cargar WiFi, URL de la API y credencial del dispositivo en NVS.
- **OTA**: el binario lo indica la configuración de la API, con verificación de hash/firma.

## Alternativas descartadas

- **Arduino UNO/Nano + shield WiFi**: poca memoria para TLS y JSON.
- **MQTT desde el inicio**: necesario solo para "abrir remoto" en tiempo real; agrega un broker que operar. Se suma si se confirma esa función (duda D-02), sin cambiar el flujo de validación.
- **Validación local en la placa**: ver ADR 0008.
- **Arduino IDE sin PlatformIO**: no reproducible en CI ni con dependencias fijadas.

## Consecuencias

- Sin red, solo entra quien usa la salida física o la llave. Si el cliente necesita operar sin red (duda D-05), se evaluará una lista local firmada con vencimiento, con un ADR nuevo.
- La lógica de la máquina de estados vive en `lib/` y se prueba en la PC (`pio test -e native`).
