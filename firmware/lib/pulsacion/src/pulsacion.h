// Detector de pulsación larga del pulsador (ADR 0026 §4): la prueba de presencia física con la que
// se confirma la vinculación de una placa. Lógica PURA, probada en la PC; en la placa recibe el
// nivel ya con antirrebote. Todas las restas toleran el desborde de uint32_t.
#pragma once

#include <stdint.h>

namespace pulsacion {

/// Mantener pulsado 5 s: lo bastante largo para no confirmar por un toque accidental.
constexpr uint32_t DURACION_MS = 5000;

class Larga {
 public:
  explicit Larga(uint32_t duracionMs = DURACION_MS) : duracionMs_(duracionMs) {}

  /// `activa`: ahora se espera una confirmación. `abajo`: el pulsador está presionado.
  /// true UNA sola vez por pulsación, cuando se cumple la duración; hay que soltar para repetir.
  bool actualizar(bool activa, bool abajo, uint32_t ahoraMs) {
    if (!activa || !abajo) {
      desdeMs_ = 0;
      contando_ = false;
      disparada_ = false;
      return false;
    }
    if (!contando_) {
      contando_ = true;
      desdeMs_ = ahoraMs;
      return false;
    }
    if (disparada_ || ahoraMs - desdeMs_ < duracionMs_) return false;
    disparada_ = true;
    return true;
  }

 private:
  uint32_t duracionMs_;
  uint32_t desdeMs_ = 0;
  bool contando_ = false;
  bool disparada_ = false;
};

}  // namespace pulsacion
