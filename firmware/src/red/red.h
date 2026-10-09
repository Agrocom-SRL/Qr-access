// WiFi con reconexión por backoff y hora por NTP (UTC). Sin hora válida no se
// valida: TLS necesita reloj y `leido_en` también.
#pragma once

#include <Arduino.h>

namespace red {

void iniciar(const String& ssid, const String& clave);
void tick(uint32_t ahoraMs);

bool lista();     // WiFi conectado y hora sincronizada
int64_t epoch();  // segundos UTC; solo es confiable si lista()
int rssi();       // dBm del WiFi actual (0 si no hay)

}  // namespace red
