---
name: firmware-esp32
description: Mapa del firmware del controlador de puerta de AGROCOM Acceso (ESP32, framework Arduino, PlatformIO) — estructura, máquina de estados no bloqueante, falla segura, lector QR por UART, relé, sensor de puerta, pulsador de salida, cliente HTTPS, aprovisionamiento, NVS, OTA y tests nativos. Usar antes de escribir o cambiar código en firmware/.
---

# Firmware — mapa de `firmware/`

ADR 0009. Hardware y cableado: `docs/hardware/README.md`.

## Estructura (PlatformIO)

```
firmware/
  platformio.ini        envs: esp32 (placa real) y native (tests en la PC)
  include/
    secretos.example.h  plantilla (WIFI_SSID, WIFI_CLAVE, DISPOSITIVO_ID, DISPOSITIVO_CLAVE) — solo desarrollo
    pines.h             asignación de pines (una sola fuente)
    ca_servidor.h       certificado raíz para verificar TLS
  lib/                  lógica PURA, sin Arduino.h → se prueba con `pio test -e native`
    puerta/             máquina de estados (Reposo → Validando → Abierta), id por validación, tope de apertura; motivo.h: motivo_code
    respuesta/          parseo de validación y configuración (ArduinoJson, tamaño acotado, estricto)
    temporizador/       Periodico, Backoff y Tarea sobre un reloj inyectable
    tiempo/             hora válida y formato ISO 8601 UTC (leido_en)
    patron/             patrones de LED y buzzer en función del tiempo
    aprovisionamiento/  comandos serie (set/estado/borrar/reiniciar) y encabezado Authorization
  src/
    main.cpp            setup()/loop(): solo arma componentes y llama a tick()
    red/                WiFi (reconexión con backoff), hora por NTP
    lector_qr/          UART del módulo GM65/GM861 (lectura por línea, longitud máxima)
    cerradura/          relé con tiempo máximo forzado, sensor magnético, pulsador de salida
    api/                tarea FreeRTOS: validación (prioritaria), latido y configuración; HTTPClient + WiFiClientSecure (CA embebida)
    indicadores/        LED RGB y buzzer (patrones: permitido, denegado, sin red, error)
    config/             NVS (Preferences) y consola serie de aprovisionamiento
    ota/                actualización firmada desde la URL que entrega la API
  test/                 Unity: un test por lib/ (puerta, respuesta, temporizador, tiempo, patron, aprovisionamiento)
```

## Flujo de una lectura

1. `lector_qr` entrega una línea (máx. 256 caracteres; más larga se descarta).
2. `puerta` pasa a **Validando** y `api` hace `POST /api/v1/dispositivos/validaciones` con timeout total de 3 s.
3. Respuesta `abrir: true` válida → **Abierta**: relé activo `min(segundos, MAX_APERTURA_S)`, LED verde, beep corto.
4. Cualquier otra cosa (rechazo, timeout, TLS, JSON inválido, sin WiFi) → **no abre**, LED rojo / patrón de error, vuelve a **Reposo**.
5. Mientras está en Validando o Abierta, se ignoran lecturas nuevas (antirebote de 2 s del mismo texto).

## Reglas

- **Falla segura** (invariante 2). Ningún camino de código activa el relé sin `abrir: true`, salvo el pulsador de salida (entrada física directa).
- **No bloqueante**: nada de `delay()` en `loop()`; todo con `millis()` y `tick()`. Watchdog (`esp_task_wdt`) activo.
- **Secretos en NVS**, cargados por aprovisionamiento por serie (`set <campo> <valor>`, `borrar`; ver `docs/hardware/README.md`). `secretos.h` solo lo lee `pio run -e esp32-dev` (flag `ACCESO_DESARROLLO`, que además permite HTTP plano para la API local); el env `esp32` no tiene esos caminos y es el único que se publica.
- **Contrato con la API** (V1): `POST /dispositivos/validaciones` `{token, leido_en}` → 200 `{abrir, segundos, evento_id, motivo_code}`; `POST /dispositivos/latidos`; `GET /dispositivos/configuracion`. Autenticación `Authorization: Dispositivo <id>.<clave>`. Cada validación lleva un id: una respuesta de otra lectura o tardía se descarta. Solo `abrir:true` con `acceso.permitido` y `segundos` entero en 1..3600 abre, acotado por el tope vigente (config, por defecto 5 s, duro 10 s).
- **TLS verificado** con `setCACert(CA_SERVIDOR)`; nunca `setInsecure()`.
- **Hora** por NTP (UTC) antes de la primera validación; sin hora válida no se valida.
- **Latido** cada 60 s con versión, RSSI y estado del sensor de puerta; la API detecta un dispositivo caído.
- **OTA** solo desde la URL que entrega la configuración de la API, con verificación de firma/hash del binario.
- Logs por serie sin secretos ni el contenido completo del token (solo sus primeros caracteres).

## Compilar y probar

```
cd firmware
cp include/secretos.example.h include/secretos.h   # solo desarrollo; completa tus valores
pio run                     # compila el binario de producción (env esp32)
pio run -e esp32-dev -t upload   # desarrollo: flashea con HTTP local y secretos.h (con el ESP32 por USB)
pio device monitor          # serie a 115200
pio test -e native          # tests de lib/ en la PC
```
