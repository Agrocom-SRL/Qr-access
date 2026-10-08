// LED RGB y buzzer: permitido, denegado, validando, error.
#pragma once

#include <Arduino.h>
#include <puerta.h>

namespace indicadores {

void iniciar();
void mostrar(puerta::Indicacion indicacion, uint32_t ahoraMs);
void tick(uint32_t ahoraMs);

}  // namespace indicadores
