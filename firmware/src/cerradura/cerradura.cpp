#include "cerradura.h"

#include <puerta.h>

#include "pines.h"

namespace cerradura {

namespace {
constexpr uint32_t TOPE_MS = static_cast<uint32_t>(puerta::MAX_APERTURA_S) * 1000U;
constexpr uint32_t ANTIRREBOTE_MS = 50;
constexpr uint8_t NIVEL_INACTIVO = CERRADURA_NIVEL_ACTIVO == HIGH ? LOW : HIGH;

bool activa = false;
uint32_t desdeMs = 0;
uint32_t duracionMs = 0;

int ultimaLectura = HIGH;
int estable = HIGH;
uint32_t cambioMs = 0;
}  // namespace

void iniciar() {
  // Primero el nivel inactivo y después el modo: el pin nunca arranca activo.
  digitalWrite(PIN_CERRADURA, NIVEL_INACTIVO);
  pinMode(PIN_CERRADURA, OUTPUT);
  pinMode(PIN_PULSADOR_SALIDA, INPUT_PULLUP);
  pinMode(PIN_SENSOR_PUERTA, INPUT_PULLUP);
}

bool puertaAbierta() { return digitalRead(PIN_SENSOR_PUERTA) == SENSOR_PUERTA_NIVEL_ABIERTA; }

void activar(uint32_t ms, uint32_t ahoraMs) {
  duracionMs = ms > TOPE_MS ? TOPE_MS : ms;
  if (duracionMs == 0) return;
  desdeMs = ahoraMs;
  activa = true;
  digitalWrite(PIN_CERRADURA, CERRADURA_NIVEL_ACTIVO);
}

void desactivar() {
  digitalWrite(PIN_CERRADURA, NIVEL_INACTIVO);
  activa = false;
}

void tick(uint32_t ahoraMs) {
  if (activa && ahoraMs - desdeMs >= duracionMs) desactivar();
}

bool pulsadorPresionado(uint32_t ahoraMs) {
  const int lectura = digitalRead(PIN_PULSADOR_SALIDA);
  if (lectura != ultimaLectura) {
    ultimaLectura = lectura;
    cambioMs = ahoraMs;
  }
  if (ahoraMs - cambioMs < ANTIRREBOTE_MS || lectura == estable) return false;
  estable = lectura;
  return estable == LOW;  // INPUT_PULLUP: presionado = LOW
}

}  // namespace cerradura
