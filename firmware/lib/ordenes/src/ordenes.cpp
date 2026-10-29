#include "ordenes.h"

namespace ordenes {

bool debePreguntar(bool operando, bool redLista, bool configuracionLeida, bool aperturaManual) {
  return operando && redLista && configuracionLeida && aperturaManual;
}

bool respuestaRapida(uint32_t duracionMs) { return duracionMs < RESPUESTA_RAPIDA_MS; }

uint32_t esperaTras(uint8_t rapidas) {
  if (rapidas == 0) return 0;
  uint32_t espera = ESPERA_MINIMA_MS;
  for (uint8_t i = 1; i < rapidas && espera < ESPERA_MAXIMA_MS; ++i) espera *= 2;
  return espera > ESPERA_MAXIMA_MS ? ESPERA_MAXIMA_MS : espera;
}

bool vigente(uint32_t recibidaMs, uint32_t validaPorMs, uint32_t ahoraMs) {
  // La resta con signo aguanta el desborde de millis(); si `ahoraMs` quedó antes (la hora se leyó
  // un instante antes de que llegara la respuesta) no ha pasado nada.
  const int32_t transcurrido = static_cast<int32_t>(ahoraMs - recibidaMs);
  const uint32_t pasado = transcurrido < 0 ? 0U : static_cast<uint32_t>(transcurrido);
  return pasado < validaPorMs;
}

}  // namespace ordenes
