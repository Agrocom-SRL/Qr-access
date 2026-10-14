// Estado del vínculo de la placa con su cuenta y puerta (ADR 0026). Lógica PURA, probada en la PC:
// decide cuándo la placa opera con su credencial, cuándo se anuncia y qué hace con cada respuesta.
//
//   sin id ............ se anuncia cada 30 s con MAC + clave propia; no valida nada.
//   "confirmar" ....... AGROCOM pidió vincularla: se anuncia cada 5 s y espera que alguien
//                       mantenga pulsado su botón (prueba de presencia física).
//   con id ............ opera con `Dispositivo <id>.<clave>`.
//   con id y un 401 ... deja de operar y se anuncia CON LA MISMA clave: si la cuenta solo estaba
//                       suspendida, el servidor responde `vinculado` y la placa retoma; si la
//                       liberaron, responde `detectada` y la placa olvida el vínculo.
//
// Falla segura (invariante 2): solo `opera()` permite validar QR; ante cualquier duda, no.
#pragma once

#include <respuesta.h>

namespace vinculo {

/// Qué debe hacer quien llama (config, API) tras interpretar un anuncio.
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

  /// true si hay que decirle al servidor quién es (sin id, o con la credencial rechazada).
  bool debeAnunciar() const { return !opera(); }

  /// true si el último anuncio pidió confirmar: la placa espera la pulsación larga.
  bool esperaConfirmacion() const { return espera_ && !opera(); }

  /// La API rechazó la credencial (HTTP 401). Sin id no hay nada que perder.
  void alRechazarCredencial() {
    if (tieneId_) rechazada_ = true;
  }

  /// `mismoId`: el id de la respuesta es el que la placa ya tiene guardado.
  Efecto alAnunciar(const respuesta::Anuncio& anuncio, bool mismoId) {
    espera_ = anuncio.estado == respuesta::Anuncio::Estado::Confirmar;
    switch (anuncio.estado) {
      case respuesta::Anuncio::Estado::Vinculado:
        rechazada_ = false;
        if (tieneId_ && mismoId) return Efecto::Nada;  // retoma: era un 401 pasajero
        tieneId_ = true;
        return Efecto::GuardarId;
      case respuesta::Anuncio::Estado::Detectada:
      case respuesta::Anuncio::Estado::Confirmar:
        rechazada_ = false;
        if (!tieneId_) return Efecto::Nada;  // sigue esperando que AGROCOM la vincule
        tieneId_ = false;
        return Efecto::OlvidarVinculo;
      case respuesta::Anuncio::Estado::Invalido:
        espera_ = false;
        return Efecto::Nada;  // 401/429/red: nada cambia y se vuelve a preguntar
    }
    return Efecto::Nada;
  }

 private:
  bool tieneId_;
  bool rechazada_ = false;
  bool espera_ = false;
};

}  // namespace vinculo
