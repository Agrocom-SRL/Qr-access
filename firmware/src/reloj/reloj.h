// Reloj de la placa para los temporizadores de lib/temporizador.
#pragma once

#include <Arduino.h>
#include <temporizador.h>

class RelojMillis : public temporizador::Reloj {
 public:
  uint32_t ahoraMs() const override { return millis(); }
};
