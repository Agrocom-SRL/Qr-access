// Salida de la cerradura (pulso) y pulsador de salida. La salida solo la
// mueve la máquina de estados; además, acá se impone un tope de hardware por si
// algo fallara arriba (invariante 2).
#pragma once

#include <Arduino.h>

namespace cerradura {

void iniciar();
// true si el relé quedó accionado; false si no se accionó (duración 0).
bool activar(uint32_t ms, uint32_t ahoraMs);
void desactivar();
void tick(uint32_t ahoraMs);

// Nivel crudo del pin del sensor magnético (true = alto). Quién lo interpreta (polaridad, si hay
// sensor instalado) es lib/confirmacion con lo que dicta el servidor. Informativo: no decide nada.
bool sensorEnNivelAlto();

// true una sola vez por pulsación (con antirrebote).
bool pulsadorPresionado(uint32_t ahoraMs);

// Nivel estable (con antirrebote) del pulsador: true mientras se mantiene presionado. Lo usa la
// pulsación larga que confirma la vinculación (ADR 0026).
bool pulsadorAbajo();

}  // namespace cerradura
