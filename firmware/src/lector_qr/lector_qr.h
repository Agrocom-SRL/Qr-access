// Módulo lector QR por UART (GM65 / GM861S): entrega líneas completas.
#pragma once

#include <Arduino.h>
#include <puerta.h>

namespace lector_qr {

void iniciar();

// Devuelve true cuando hay una línea completa en `linea` (terminada en \0).
// Una línea más larga que puerta::MAX_QR se descarta entera.
bool leer(char (&linea)[puerta::MAX_QR + 1]);

}  // namespace lector_qr
