// Hora UTC: validez del reloj y formato ISO 8601 con `Z` (`leido_en`). PURA.
#pragma once

#include <stddef.h>
#include <stdint.h>

namespace tiempo {

// Antes de esta fecha (2023-11-14) el reloj no se sincronizó por NTP todavía.
constexpr int64_t EPOCH_MINIMO_VALIDO = 1700000000;
// Después de 2100 (en el tiempo de vida de la placa) algo está mal con el reloj.
constexpr int64_t EPOCH_MAXIMO_VALIDO = 4102444800;

// "AAAA-MM-DDThh:mm:ssZ" más el \0.
constexpr size_t CAPACIDAD_ISO = 21;

// true si `epoch` (segundos desde 1970 UTC) es una hora sincronizada y creíble.
bool valida(int64_t epoch);

// Escribe `epoch` como ISO 8601 UTC. false (y salida vacía) si la hora no es
// válida o `capacidad` < CAPACIDAD_ISO.
bool formatearIso(int64_t epoch, char* salida, size_t capacidad);

}  // namespace tiempo
