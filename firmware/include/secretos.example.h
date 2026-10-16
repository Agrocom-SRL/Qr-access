// Plantilla de secretos SOLO para desarrollo en la mesa (docs/gestion/entornos.md).
// Copia a secretos.h (que no se versiona) y completa. Solo la lee la compilación
// `pio run -e esp32-dev` (flag ACCESO_DESARROLLO): el binario `esp32` de producción
// ni lo incluye. En una puerta real, estos valores llegan por aprovisionamiento
// serie y quedan en NVS (ADR 0009 y 0025, docs/hardware/README.md). Ya no hay WiFi.
#pragma once

// API local del Mac por la red cableada (HTTP plano, solo en esp32-dev) o una https:// real.
#define API_URL "http://192.168.1.10:3000"
#define DISPOSITIVO_ID ""
#define DISPOSITIVO_CLAVE ""
