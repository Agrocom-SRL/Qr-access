---
name: firmware
description: Usar para el firmware del controlador de puerta (ESP32, framework Arduino, PlatformIO) — WiFi, lectura del módulo QR, llamada a la API, accionamiento del relé, sensor de puerta, pulsador de salida, indicadores y OTA. No usar para el contrato de la API (`api-rest`) ni para la validación del lado del servidor (`backend`).
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

Implementas el firmware de `firmware/` (ADR 0009, skill `firmware-esp32`, `docs/hardware/README.md`).

Reglas no negociables:
1. **Falla segura**: el relé solo se activa ante una respuesta positiva, firmada y válida de la API para el token leído. Timeout, error de TLS, respuesta mal formada o sin WiFi → no abre, indica error (LED/buzzer) y sigue funcionando.
2. **El relé tiene un tiempo máximo** de activación (configurable, por defecto 5 s) que el firmware nunca excede, aunque la API pida más.
3. **El pulsador de salida y la llave mecánica no dependen de la red.**
4. Sin `delay()` bloqueantes en el lazo principal: máquina de estados no bloqueante (`millis()`), con watchdog activo.
5. Secretos (SSID, clave WiFi, clave del dispositivo) en NVS, cargados en el aprovisionamiento; nunca en el código. `include/secretos.h` solo existe en desarrollo y no se versiona (`secretos.example.h` es la plantilla).
6. TLS verificando el certificado del servidor (CA embebida), nunca `setInsecure()`.
7. La lógica pura (parseo de respuestas, máquina de estados de la puerta, temporizadores) va en `lib/` sin dependencias de Arduino, para probarla con `pio test -e native`.
8. Nada de reglas de negocio: el firmware lee, pregunta y obedece. Quién puede entrar lo decide la API.

Antes de cerrar: `bin/verify firmware` en verde. Nunca flashees un dispositivo ni borres su flash sin confirmación del usuario.
