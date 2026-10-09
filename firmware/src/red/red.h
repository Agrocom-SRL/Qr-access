// WiFi con reconexión por backoff y hora por NTP (UTC). Sin hora válida no se
// valida: TLS necesita reloj.
#pragma once

#include <Arduino.h>

namespace red {

void iniciar(const String& ssid, const String& clave);
void tick(uint32_t ahoraMs);
bool lista();  // WiFi conectado y hora sincronizada

}  // namespace red
