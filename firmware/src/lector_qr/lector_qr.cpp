#include "lector_qr.h"

#include "pines.h"

namespace lector_qr {

namespace {
// El lector habla RS485 a través del módulo TTL-RS485 (docs/hardware/README.md). Con RE y DE a
// GND el módulo solo recibe, que es lo que hace falta: el lector transmite y la placa escucha.
// La velocidad depende del lector; se cambia con -DLECTOR_BAUDIOS=<n> sin tocar el código.
#ifndef LECTOR_BAUDIOS
#define LECTOR_BAUDIOS 9600
#endif
constexpr uint32_t BAUDIOS = LECTOR_BAUDIOS;
char buffer[puerta::MAX_QR + 1];
size_t largo = 0;
bool descartando = false;
}  // namespace

void iniciar() { Serial2.begin(BAUDIOS, SERIAL_8N1, PIN_LECTOR_RX, PIN_LECTOR_TX); }

bool leer(char (&linea)[puerta::MAX_QR + 1]) {
  while (Serial2.available() > 0) {
    const int c = Serial2.read();
    if (c == '\r' || c == '\n') {
      const bool completa = !descartando && largo > 0;
      if (completa) {
        buffer[largo] = '\0';
        memcpy(linea, buffer, largo + 1);
      }
      largo = 0;
      descartando = false;
      if (completa) return true;
      continue;
    }
    if (descartando) continue;
    if (largo >= puerta::MAX_QR) {
      descartando = true;  // demasiado larga: se descarta hasta el fin de línea
      largo = 0;
      continue;
    }
    buffer[largo++] = static_cast<char>(c);
  }
  return false;
}

}  // namespace lector_qr
