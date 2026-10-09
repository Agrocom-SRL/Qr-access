#include "patron.h"

namespace patron {

namespace {

constexpr uint32_t DURACION_MS = 1500;
constexpr uint32_t DURACION_VALIDANDO_MS = 4000;  // por encima del timeout de la máquina

constexpr Salida APAGADO{false, false, false, false, true};

bool dentro(uint32_t t, uint32_t desde, uint32_t hasta) { return t >= desde && t < hasta; }

}  // namespace

Salida en(puerta::Indicacion indicacion, uint32_t t) {
  using puerta::Indicacion;
  switch (indicacion) {
    case Indicacion::Validando:
      if (t >= DURACION_VALIDANDO_MS) return APAGADO;
      return Salida{false, false, true, false, false};
    case Indicacion::Permitido:
      if (t >= DURACION_MS) return APAGADO;
      return Salida{true, false, false, dentro(t, 0, 150), false};
    case Indicacion::Denegado:
      if (t >= DURACION_MS) return APAGADO;
      return Salida{false, true, false, dentro(t, 0, 150) || dentro(t, 300, 450), false};
    case Indicacion::SinRed:
      if (t >= DURACION_MS) return APAGADO;
      return Salida{false, false, (t / 250) % 2 == 0,
                    dentro(t, 0, 100) || dentro(t, 250, 350) || dentro(t, 500, 600), false};
    case Indicacion::Error:
      if (t >= DURACION_MS) return APAGADO;
      return Salida{false, (t / 100) % 2 == 0, false, dentro(t, 0, 600), false};
    case Indicacion::Ninguna:
      break;
  }
  return APAGADO;
}

}  // namespace patron
