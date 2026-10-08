// Configuración del dispositivo en NVS (Preferences). La carga el
// aprovisionamiento; secretos.h solo sirve para desarrollo en la mesa.
#pragma once

#include <Arduino.h>

namespace config {

struct Dispositivo {
  String wifiSsid;
  String wifiClave;
  String apiUrl;
  String id;
  String clave;

  bool completa() const {
    return wifiSsid.length() > 0 && apiUrl.startsWith("https://") && id.length() > 0 &&
           clave.length() > 0;
  }
};

Dispositivo cargar();

}  // namespace config
