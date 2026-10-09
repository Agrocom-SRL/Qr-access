// Consola serie de aprovisionamiento: lee líneas sin bloquear y aplica los
// comandos de lib/aprovisionamiento (set, estado, borrar, reiniciar, ayuda).
// Nunca imprime ni repite el valor de una clave.
#pragma once

#include <Arduino.h>

namespace consola {

void iniciar();
void tick();

}  // namespace consola
