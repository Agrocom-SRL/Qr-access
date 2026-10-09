// Patrones de LED y buzzer por indicación, como función del tiempo
// transcurrido: sin estado ni pines, para probarlos en la PC. PURA.
#pragma once

#include <stdint.h>

#include "puerta.h"

namespace patron {

struct Salida {
  bool verde;
  bool rojo;
  bool azul;
  bool buzzer;
  bool terminado;  // pasó la duración del patrón: todo apagado
};

// Estado de las salidas `transcurridoMs` después de empezar `indicacion`.
//   Validando: azul fijo hasta que llegue la respuesta.
//   Permitido: verde fijo y un beep corto.
//   Denegado:  rojo fijo y dos beeps.
//   SinRed:    azul parpadeando y tres beeps cortos.
//   Error:     rojo parpadeando rápido y un beep largo.
Salida en(puerta::Indicacion indicacion, uint32_t transcurridoMs);

}  // namespace patron
