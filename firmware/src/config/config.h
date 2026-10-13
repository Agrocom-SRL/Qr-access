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
  String apiUrl;
  String codigo;  // código de vinculación de la placa (ADR 0025); lo carga el taller
  String id;      // lo recibe al vincularla AGROCOM; vacío mientras está de fábrica
  String clave;   // la sortea la propia placa; el servidor solo guarda su hash

  /// Puede operar con su credencial: URL, id y clave válidos.
  bool completa() const {
    return aprovisionamiento::urlValida(apiUrl.c_str(), MODO_DESARROLLO) &&
           aprovisionamiento::idValido(id.c_str()) &&
           aprovisionamiento::claveValida(clave.c_str());
  }

  /// Puede preguntar al servidor por su vínculo: URL, código y clave válidos.
  bool reclamable() const {
    return aprovisionamiento::urlValida(apiUrl.c_str(), MODO_DESARROLLO) &&
           aprovisionamiento::codigoValido(codigo.c_str()) &&
           aprovisionamiento::claveValida(clave.c_str());
  }
};

Dispositivo cargar();

// Guarda un campo ya validado por lib/aprovisionamiento. false si la NVS falla.
bool guardar(aprovisionamiento::Campo campo, const char* valor);

// Sortea una clave nueva con el generador del hardware (32 bytes), la guarda y la deja en
// `dispositivo.clave`. La usa la placa la primera vez y cada vez que el servidor la libera.
bool sortearClave(Dispositivo& dispositivo);

// Olvida el id del dispositivo (la placa fue liberada); conserva URL, código y clave.
void olvidarId();

// MAC Ethernet de la placa ("AA:BB:CC:00:11:22"): con ella se registra en el panel de AGROCOM.
String macDeLaPlaca();

// Borra solo lo aprovisionado (el espacio "acceso" de la NVS); no toca el resto de la flash.
void borrar();

}  // namespace config
