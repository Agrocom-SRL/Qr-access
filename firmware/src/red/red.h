// Red del controlador: solo Ethernet (placa ESP32-ETH01, ADR 0025); reconexión del cable por el
// propio driver y hora por NTP (UTC). Sin hora válida no se valida: TLS necesita reloj y
// `leido_en` también.
#pragma once

#include <Arduino.h>

namespace red {

void iniciar();
void tick(uint32_t ahoraMs);

bool lista();     // enlace con IP y hora sincronizada
int64_t epoch();  // segundos UTC; solo es confiable si lista()

}  // namespace red
