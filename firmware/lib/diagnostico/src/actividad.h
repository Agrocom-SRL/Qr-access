// Diagnóstico del lector QR para el latido (ADR 0031 §18). Lógica PURA, probada en la PC.
//
// El lector es pasivo: no manda nada si nadie pasa un QR. Por eso «responde» solo puede afirmarse
// por actividad pasada. Tres estados honestos en vez de inventar un sí o un no:
//  - Desconocido: no ha llegado ningún byte desde el arranque (no se informa el campo);
//  - Responde: llegó algo dentro de la ventana;
//  - Silencio: llegó algo antes, pero hace más que la ventana (puede estar caído o solo sin uso).
// Es diagnóstico: no decide nada ni toca la puerta.
#pragma once

#include <stdint.h>

namespace diagnostico {

// Ventana sin bytes tras la cual se informa «silencio». Un día: una puerta con poco uso no debería
// marcarse como caída por una noche tranquila.
constexpr uint32_t VENTANA_LECTOR_MS = 24UL * 60UL * 60UL * 1000UL;

// Tras un byte del lector no se inicia ningún envío de segundo plano (latido, informe, configuración):
// alguien está usando la puerta y su validación no debe esperar detrás de una llamada de red en vuelo.
constexpr uint32_t QUIETUD_SEGUNDO_PLANO_MS = 10UL * 1000UL;

enum class EstadoLector : uint8_t { Desconocido, Responde, Silencio };

class ActividadLector {
 public:
  // Llegó algún byte por la UART del lector.
  void alRecibir(uint32_t ahoraMs) {
    visto_ = true;
    ultimoMs_ = ahoraMs;
  }

  // true si llegó algún byte hace menos de `ventanaMs` (tolera el desborde de uint32_t).
  bool huboActividadReciente(uint32_t ahoraMs, uint32_t ventanaMs) const {
    return visto_ && ahoraMs - ultimoMs_ < ventanaMs;
  }

  EstadoLector estado(uint32_t ahoraMs) const {
    if (!visto_) return EstadoLector::Desconocido;
    return ahoraMs - ultimoMs_ < VENTANA_LECTOR_MS ? EstadoLector::Responde : EstadoLector::Silencio;
  }

 private:
  bool visto_ = false;
  uint32_t ultimoMs_ = 0;
};

}  // namespace diagnostico
