// Lector por UART (hoy, un lector RS485 detrás del módulo TTL-RS485; antes se pensó en un
// GM65 / GM861S): entrega líneas completas. El módulo del lector no cambia esta interfaz.
#pragma once

#include <Arduino.h>
#include <puerta.h>

namespace lector_qr {

void iniciar();

// Devuelve true cuando hay una línea completa en `linea` (terminada en \0).
// Una línea más larga que puerta::MAX_QR se descarta entera.
bool leer(char (&linea)[puerta::MAX_QR + 1]);

}  // namespace lector_qr
