// Configuración del dispositivo en NVS (Preferences). La carga el
// aprovisionamiento por serie (consola.h); secretos.h solo sirve en la
// compilación de desarrollo.
#pragma once

#include <Arduino.h>
#include <aprovisionamiento.h>

namespace config {

// Compilación de desarrollo (env esp32-dev): admite HTTP plano y secretos.h.
#ifdef ACCESO_DESARROLLO
constexpr bool MODO_DESARROLLO = true;
#else
constexpr bool MODO_DESARROLLO = false;
#endif

struct Dispositivo {
  String wifiSsid;
  String wifiClave;  // vacía = red abierta
  String apiUrl;
  String id;
  String clave;

  bool completa() const {
    return wifiSsid.length() > 0 &&
           aprovisionamiento::urlValida(apiUrl.c_str(), MODO_DESARROLLO) &&
           aprovisionamiento::idValido(id.c_str()) &&
           aprovisionamiento::claveValida(clave.c_str());
  }
};

Dispositivo cargar();

// Guarda un campo ya validado por lib/aprovisionamiento. false si la NVS falla.
bool guardar(aprovisionamiento::Campo campo, const char* valor);

// Borra solo lo aprovisionado (el espacio "acceso" de la NVS); no toca el resto de la flash.
void borrar();

}  // namespace config
