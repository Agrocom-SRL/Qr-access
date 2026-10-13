// Estado del vínculo de la placa con su cuenta y puerta (ADR 0025). Lógica PURA, probada en la PC:
// decide cuándo la placa opera con su credencial, cuándo reclama y qué hace con cada respuesta.
//
//   sin id ............ reclama cada 30 s con MAC + código + clave propia; no valida nada.
//   con id ............ opera con `Dispositivo <id>.<clave>`.
//   con id y un 401 ... deja de operar y reclama CON LA MISMA clave: si la cuenta solo estaba
//                       suspendida, el servidor responde `vinculado` y la placa retoma; si la
//                       liberaron, responde `pendiente` y la placa olvida el vínculo.
//
// Falla segura (invariante 2): solo `opera()` permite validar QR; ante cualquier duda, no.
#pragma once

#include <respuesta.h>

namespace vinculo {

/// Qué debe hacer quien llama (config, API) tras interpretar un reclamo.
enum class Efecto : uint8_t {
  Nada,
  /// Guardar `dispositivoId` de la respuesta en la NVS y usarlo en la credencial.
  GuardarId,
  /// Borrar el id de la NVS y sortear una clave nueva: el servidor ya no tiene este vínculo.
  OlvidarVinculo,
};

class Vinculo {
 public:
  explicit Vinculo(bool tieneId) : tieneId_(tieneId) {}

  /// true solo con id y sin credencial rechazada: la única condición para validar y latir.
  bool opera() const { return tieneId_ && !rechazada_; }

  /// true si hay que preguntar al servidor por el vínculo (sin id, o con la credencial rechazada).
  bool debeReclamar() const { return !opera(); }

  /// La API rechazó la credencial (HTTP 401). Sin id no hay nada que perder.
  void alRechazarCredencial() {
    if (tieneId_) rechazada_ = true;
  }

  /// `mismoId`: el id de la respuesta es el que la placa ya tiene guardado.
  Efecto alReclamar(const respuesta::Reclamo& reclamo, bool mismoId) {
    switch (reclamo.estado) {
      case respuesta::Reclamo::Estado::Vinculado:
        rechazada_ = false;
        if (tieneId_ && mismoId) return Efecto::Nada;  // retoma: era un 401 pasajero
        tieneId_ = true;
        return Efecto::GuardarId;
      case respuesta::Reclamo::Estado::Pendiente:
        rechazada_ = false;
        if (!tieneId_) return Efecto::Nada;  // sigue esperando que AGROCOM la vincule
        tieneId_ = false;
        return Efecto::OlvidarVinculo;
      case respuesta::Reclamo::Estado::Invalido:
        return Efecto::Nada;  // 401/429/red: nada cambia y se vuelve a preguntar
    }
    return Efecto::Nada;
  }

 private:
  bool tieneId_;
  bool rechazada_ = false;
};

}  // namespace vinculo
