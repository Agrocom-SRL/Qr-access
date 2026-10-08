#include "indicadores.h"

#include "pines.h"

namespace indicadores {

namespace {
constexpr uint32_t DURACION_MS = 1500;
bool encendido = false;
uint32_t desdeMs = 0;

void apagar() {
  digitalWrite(PIN_LED_VERDE, LOW);
  digitalWrite(PIN_LED_ROJO, LOW);
  digitalWrite(PIN_LED_AZUL, LOW);
  digitalWrite(PIN_BUZZER, LOW);
  encendido = false;
}
}  // namespace

void iniciar() {
  for (uint8_t pin : {PIN_LED_VERDE, PIN_LED_ROJO, PIN_LED_AZUL, PIN_BUZZER}) {
    digitalWrite(pin, LOW);
    pinMode(pin, OUTPUT);
  }
}

void mostrar(puerta::Indicacion indicacion, uint32_t ahoraMs) {
  using puerta::Indicacion;
  if (indicacion == Indicacion::Ninguna) return;
  apagar();
  switch (indicacion) {
    case Indicacion::Validando:
      digitalWrite(PIN_LED_AZUL, HIGH);
      break;
    case Indicacion::Permitido:
      digitalWrite(PIN_LED_VERDE, HIGH);
      break;
    case Indicacion::Denegado:
      digitalWrite(PIN_LED_ROJO, HIGH);
      digitalWrite(PIN_BUZZER, HIGH);
      break;
    case Indicacion::Error:
      digitalWrite(PIN_LED_ROJO, HIGH);
      digitalWrite(PIN_LED_AZUL, HIGH);
      break;
    case Indicacion::Ninguna:
      break;
  }
  encendido = true;
  desdeMs = ahoraMs;
}

void tick(uint32_t ahoraMs) {
  if (encendido && ahoraMs - desdeMs >= DURACION_MS) apagar();
}

}  // namespace indicadores
