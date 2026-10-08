// Interpreta la respuesta de POST /api/v1/dispositivos/validaciones (ADR 0005:
// siempre 200 con `abrir` explícito). Lógica PURA, probada en la PC.
#pragma once

#include <stddef.h>
#include <stdint.h>

#include "puerta.h"

namespace respuesta {

constexpr size_t MAX_CUERPO = 512;

// `estadoHttp` distinto de 200, cuerpo vacío o demasiado largo, JSON inválido
// o `abrir` que no sea un booleano -> resultado no válido: no abre.
puerta::Resultado interpretar(int estadoHttp, const char* cuerpo, size_t largo);

}  // namespace respuesta
