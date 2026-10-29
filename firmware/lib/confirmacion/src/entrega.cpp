#include "entrega.h"

#include <string.h>

namespace confirmacion {

bool reintentable(int http) { return http <= 0 || http == 429 || http >= 500; }

bool entregado(int http) { return http >= 200 && http < 300; }

uint32_t Entregas::esperaTras(uint8_t intentos) {
  uint32_t espera = ESPERA_INICIAL_MS;
  for (uint8_t i = 1; i < intentos && espera < ESPERA_MAXIMA_MS; ++i) espera *= 2;
  return espera > ESPERA_MAXIMA_MS ? ESPERA_MAXIMA_MS : espera;
}

int Entregas::buscar(const char* eventoId, bool manual) const {
  for (uint8_t i = 0; i < cantidad_; ++i) {
    if (entradas_[i].informe.manual == manual &&
        strncmp(entradas_[i].informe.eventoId, eventoId, MAX_EVENTO_ID) == 0) {
      return i;
    }
  }
  return -1;
}

void Entregas::quitar(uint8_t indice) {
  for (uint8_t i = indice; i + 1 < cantidad_; ++i) entradas_[i] = entradas_[i + 1];
  --cantidad_;
}

bool Entregas::agregar(const Informe& informe, uint32_t ordenMs) {
  if (!eventoIdValido(informe.eventoId) || buscar(informe.eventoId, informe.manual) >= 0) return false;
  if (cantidad_ == CAPACIDAD_ENTREGAS) quitar(0);
  Entrada& entrada = entradas_[cantidad_++];
  entrada = Entrada{};
  entrada.informe = informe;
  entrada.ordenMs = ordenMs;
  return true;
}

void Entregas::fallo(uint8_t indice, uint32_t ahoraMs) {
  Entrada& entrada = entradas_[indice];
  entrada.enVuelo = false;
  if (entrada.intentos < 255) ++entrada.intentos;
  entrada.ultimoIntentoMs = ahoraMs;
  entrada.esperaMs = esperaTras(entrada.intentos);
}

const Informe* Entregas::debeEnviar(uint32_t ahoraMs) {
  bool hayEnVuelo = false;
  for (uint8_t i = 0; i < cantidad_; ++i) {
    // Un envío en vuelo que nunca contestó (cola de la tarea llena, tarea trabada) se da por fallido.
    if (entradas_[i].enVuelo && ahoraMs - entradas_[i].ultimoIntentoMs >= VENCE_ENVIO_MS) fallo(i, ahoraMs);
    hayEnVuelo = hayEnVuelo || entradas_[i].enVuelo;
  }
  for (uint8_t i = 0; i < cantidad_;) {
    if (!entradas_[i].enVuelo && ahoraMs - entradas_[i].ordenMs >= PLAZO_ENTREGA_MS) {
      quitar(i);  // pasado el plazo el servidor diría 409: se pierde
      continue;
    }
    ++i;
  }
  if (hayEnVuelo) return nullptr;  // de a uno: no se acumulan llamadas en la tarea de red
  for (uint8_t i = 0; i < cantidad_; ++i) {
    const Entrada& entrada = entradas_[i];
    if (ahoraMs - entrada.ultimoIntentoMs >= entrada.esperaMs) return &entrada.informe;
  }
  return nullptr;
}

void Entregas::enviado(const char* eventoId, uint32_t ahoraMs, bool manual) {
  const int indice = buscar(eventoId, manual);
  if (indice < 0) return;
  entradas_[indice].enVuelo = true;
  entradas_[indice].ultimoIntentoMs = ahoraMs;
}

void Entregas::alResponder(const char* eventoId, int http, uint32_t ahoraMs, bool manual) {
  const int indice = buscar(eventoId, manual);
  if (indice < 0) return;  // llegó tarde: ya se descartó
  if (reintentable(http)) {
    fallo(static_cast<uint8_t>(indice), ahoraMs);
  } else {
    quitar(static_cast<uint8_t>(indice));  // entregado o rechazado para siempre
  }
}

}  // namespace confirmacion
