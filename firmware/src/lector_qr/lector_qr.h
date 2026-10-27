// Lector por UART (hoy, un lector RS485 detrás del módulo TTL-RS485; antes se pensó en un
// GM65 / GM861S): entrega líneas completas. El módulo del lector no cambia esta interfaz.
#pragma once

#include <Arduino.h>
#include <actividad.h>
#include <puerta.h>

namespace lector_qr {

void iniciar();

// Devuelve true cuando hay una línea completa en `linea` (terminada en \0).
// Una línea más larga que puerta::MAX_QR se descarta entera.
bool leer(char (&linea)[puerta::MAX_QR + 1]);

// Si el lector ha dado señales de vida por la UART (diagnóstico del latido; el lector es pasivo).
diagnostico::EstadoLector estado(uint32_t ahoraMs);

// true si el lector mandó algún byte hace menos de `ventanaMs`: alguien está usando la puerta.
bool huboActividadReciente(uint32_t ahoraMs, uint32_t ventanaMs);

}  // namespace lector_qr
