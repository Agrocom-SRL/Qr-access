#include "respuesta.h"

#include <ArduinoJson.h>

namespace respuesta {

puerta::Resultado interpretar(int estadoHttp, const char* cuerpo, size_t largo) {
  const puerta::Resultado invalido{false, false, 0};
  if (estadoHttp != 200 || cuerpo == nullptr || largo == 0 || largo > MAX_CUERPO) {
    return invalido;
  }

  JsonDocument doc;
  if (deserializeJson(doc, cuerpo, largo) != DeserializationError::Ok) return invalido;
  if (!doc.is<JsonObject>()) return invalido;

  // `abrir` tiene que ser exactamente un booleano: ni "true", ni 1.
  JsonVariantConst abrir = doc["abrir"];
  if (!abrir.is<bool>()) return invalido;
  if (!abrir.as<bool>()) return puerta::Resultado{true, false, 0};

  JsonVariantConst segundos = doc["segundos_apertura"];
  if (!segundos.is<int>()) return invalido;
  const int valor = segundos.as<int>();
  if (valor <= 0 || valor > 0xFFFF) return invalido;
  return puerta::Resultado{true, true, static_cast<uint16_t>(valor)};
}

}  // namespace respuesta
