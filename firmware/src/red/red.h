// Red del controlador: Ethernet (ESP32-ETH01, principal) con WiFi de respaldo, o solo WiFi
// en una placa sin Ethernet; reconexión por backoff y hora por NTP (UTC). Sin hora válida
// no se valida: TLS necesita reloj y `leido_en` también.
#pragma once

#include <Arduino.h>

namespace red {

void iniciar(const String& ssid, const String& clave);
void tick(uint32_t ahoraMs);

bool lista();     // enlace con IP (cable o WiFi) y hora sincronizada
int64_t epoch();  // segundos UTC; solo es confiable si lista()
int rssi();       // dBm del WiFi actual (0 por cable o sin red)
String medio();   // "ethernet", "wifi" o "sin red" (solo para el log)

}  // namespace red
