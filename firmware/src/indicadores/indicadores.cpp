#include "indicadores.h"

#include <patron.h>

#include "pines.h"

namespace indicadores {

namespace {

puerta::Indicacion actual = puerta::Indicacion::Ninguna;
uint32_t desdeMs = 0;

void aplicar(const patron::Salida& salida) {
  digitalWrite(PIN_LED_VERDE, salida.verde ? HIGH : LOW);
  digitalWrite(PIN_LED_ROJO, salida.rojo ? HIGH : LOW);
  digitalWrite(PIN_LED_AZUL, salida.azul ? HIGH : LOW);
  digitalWrite(PIN_BUZZER, salida.buzzer ? HIGH : LOW);
}

}  // namespace

void iniciar() {
  for (uint8_t pin : {PIN_LED_VERDE, PIN_LED_ROJO, PIN_LED_AZUL, PIN_BUZZER}) {
    digitalWrite(pin, LOW);
    pinMode(pin, OUTPUT);
  }
}

void mostrar(puerta::Indicacion indicacion, uint32_t ahoraMs) {
  if (indicacion == puerta::Indicacion::Ninguna) return;
  actual = indicacion;
  desdeMs = ahoraMs;
  aplicar(patron::en(actual, 0));
}

void tick(uint32_t ahoraMs) {
  if (actual == puerta::Indicacion::Ninguna) return;
  const patron::Salida salida = patron::en(actual, ahoraMs - desdeMs);
  aplicar(salida);
  if (salida.terminado) actual = puerta::Indicacion::Ninguna;
}

}  // namespace indicadores
