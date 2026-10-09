#include "temporizador.h"

namespace temporizador {

namespace {

uint32_t duplicarHasta(uint32_t valor, uint32_t tope) {
  return valor > tope / 2 ? tope : valor * 2;
}

}  // namespace

Periodico::Periodico(const Reloj& reloj, uint32_t periodoMs, bool inmediato)
    : reloj_(reloj), periodoMs_(periodoMs), ultimoMs_(reloj.ahoraMs()), pendiente_(inmediato) {}

bool Periodico::vencio() {
  const uint32_t ahora = reloj_.ahoraMs();
  if (pendiente_ || ahora - ultimoMs_ >= periodoMs_) {
    pendiente_ = false;
    ultimoMs_ = ahora;
    return true;
  }
  return false;
}

Backoff::Backoff(const Reloj& reloj, uint32_t inicialMs, uint32_t maximoMs)
    : reloj_(reloj), inicialMs_(inicialMs), maximoMs_(maximoMs), siguienteMs_(inicialMs) {}

bool Backoff::toca() const { return reloj_.ahoraMs() - desdeMs_ >= esperaMs_; }

void Backoff::fallo() {
  desdeMs_ = reloj_.ahoraMs();
  esperaMs_ = siguienteMs_;
  siguienteMs_ = duplicarHasta(siguienteMs_, maximoMs_);
}

void Backoff::exito() {
  esperaMs_ = 0;
  siguienteMs_ = inicialMs_;
}

Tarea::Tarea(const Reloj& reloj, uint32_t periodoMs, uint32_t reintentoInicialMs)
    : reloj_(reloj),
      periodoMs_(periodoMs),
      reintentoInicialMs_(reintentoInicialMs),
      siguienteReintentoMs_(reintentoInicialMs) {}

bool Tarea::toca() {
  const uint32_t ahora = reloj_.ahoraMs();
  if (ahora - desdeMs_ < esperaMs_) return false;
  desdeMs_ = ahora;
  esperaMs_ = siguienteReintentoMs_;
  siguienteReintentoMs_ = duplicarHasta(siguienteReintentoMs_, periodoMs_);
  return true;
}

void Tarea::terminada(bool ok) {
  if (!ok) return;  // el reintento ya quedó agendado en toca()
  desdeMs_ = reloj_.ahoraMs();
  esperaMs_ = periodoMs_;
  siguienteReintentoMs_ = reintentoInicialMs_;
}

}  // namespace temporizador
