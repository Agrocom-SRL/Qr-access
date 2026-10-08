// Cliente HTTPS de la API (ADR 0009). La validación corre en su propia tarea
// de FreeRTOS para que loop() no se bloquee (el pulsador de salida sigue
// respondiendo mientras se espera a la red).
#pragma once

#include <puerta.h>

#include "config/config.h"

namespace api {

struct Respuesta {
  uint32_t id;  // id de la validación pedida: una respuesta vieja no se confunde con la actual
  puerta::Resultado resultado;
};

void iniciar(const config::Dispositivo& dispositivo);

// Encola la validación `id` del QR. false si no se pudo encolar.
bool validar(uint32_t id, const char* qr);

// true si terminó alguna validación; deja su respuesta en `respuesta`.
bool respuesta(Respuesta& respuesta);

}  // namespace api
