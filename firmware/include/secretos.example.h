// Plantilla de secretos SOLO para desarrollo en la mesa (docs/gestion/entornos.md).
// Copia a secretos.h (que no se versiona) y completa. Solo la lee la compilación
// `pio run -e esp32-dev` (flag ACCESO_DESARROLLO): el binario `esp32` de producción
// ni lo incluye. En una puerta real, estos valores llegan por aprovisionamiento
// serie y quedan en NVS (ADR 0009, docs/hardware/README.md).
#pragma once

#define WIFI_SSID ""
#define WIFI_CLAVE ""
// API local del Mac por la WiFi (HTTP plano, solo en esp32-dev) o una https:// real.
#define API_URL "http://192.168.1.10:3000"
#define DISPOSITIVO_ID ""
#define DISPOSITIVO_CLAVE ""
