#include "respuesta.h"

#include <ArduinoJson.h>
#include <string.h>

namespace respuesta {

namespace {

using puerta::Motivo;
using puerta::Resultado;

// Parsea un cuerpo JSON de objeto con los controles comunes de tamaño.
bool leerObjeto(const char* cuerpo, size_t largo, JsonDocument& doc) {
  if (cuerpo == nullptr || largo == 0 || largo > MAX_CUERPO) return false;
  if (deserializeJson(doc, cuerpo, largo) != DeserializationError::Ok) return false;
  return doc.is<JsonObject>();
}

// Entero estricto: ni "4", ni 4.5, ni true. Devuelve el valor acotado.
bool segundosEnRango(JsonVariantConst campo, uint16_t& segundos) {
  if (!campo.is<int>() || campo.is<bool>()) return false;
  const int valor = campo.as<int>();
  if (valor < 1 || valor > SEGUNDOS_MAXIMOS_ACEPTADOS) return false;
  segundos = valor > puerta::MAX_APERTURA_S ? puerta::MAX_APERTURA_S : static_cast<uint16_t>(valor);
  return true;
}

bool textoNoVacio(JsonVariantConst campo, const char*& texto) {
  if (!campo.is<const char*>()) return false;
  texto = campo.as<const char*>();
  return texto != nullptr && texto[0] != '\0';
}

}  // namespace

Resultado interpretar(int estadoHttp, const char* cuerpo, size_t largo) {
  if (estadoHttp == 401) return Resultado::invalido(Motivo::CredencialInvalida);
  if (estadoHttp != 200) return Resultado::invalido(Motivo::RespuestaInvalida);

  JsonDocument doc;
  if (!leerObjeto(cuerpo, largo, doc)) return Resultado::invalido(Motivo::RespuestaInvalida);

  // `abrir` tiene que ser exactamente un booleano: ni "true", ni 1.
  JsonVariantConst abrir = doc["abrir"];
  if (!abrir.is<bool>()) return Resultado::invalido(Motivo::RespuestaInvalida);

  const char* motivoCode = nullptr;
  const char* eventoId = nullptr;
  if (!textoNoVacio(doc["motivo_code"], motivoCode) || !textoNoVacio(doc["evento_id"], eventoId)) {
    return Resultado::invalido(Motivo::RespuestaInvalida);
  }
  const Motivo motivo = puerta::motivoDe(motivoCode);

  if (!abrir.as<bool>()) {
    // Un "no abrir" con motivo de éxito es contradictorio: se trata como denegado genérico.
    return Resultado::denegado(motivo == Motivo::Permitido ? Motivo::DenegadoOtro : motivo);
  }

  if (motivo != Motivo::Permitido) return Resultado::invalido(Motivo::RespuestaInvalida);
  uint16_t segundos = 0;
  if (!segundosEnRango(doc["segundos"], segundos)) {
    return Resultado::invalido(Motivo::RespuestaInvalida);
  }
  return Resultado::permitido(segundos);
}

Configuracion interpretarConfiguracion(int estadoHttp, const char* cuerpo, size_t largo) {
  const Configuracion invalida{false, 0};
  if (estadoHttp != 200) return invalida;

  JsonDocument doc;
  if (!leerObjeto(cuerpo, largo, doc)) return invalida;

  uint16_t segundos = 0;
  if (!segundosEnRango(doc["segundos_apertura"], segundos)) return invalida;
  return Configuracion{true, segundos};
}

Reclamo interpretarReclamo(int estadoHttp, const char* cuerpo, size_t largo) {
  Reclamo reclamo;
  if (estadoHttp == 401 || estadoHttp == 429) {
    reclamo.rechazado = true;
    return reclamo;
  }
  if (estadoHttp != 200) return reclamo;

  JsonDocument doc;
  if (!leerObjeto(cuerpo, largo, doc)) return reclamo;
  const char* estado = nullptr;
  if (!textoNoVacio(doc["estado"], estado)) return reclamo;

  if (strcmp(estado, "pendiente") == 0) {
    reclamo.estado = Reclamo::Estado::Pendiente;
    return reclamo;
  }
  if (strcmp(estado, "vinculado") != 0) return reclamo;

  // El id llega en un encabezado `Dispositivo <id>.<clave>`: solo dígitos, sin separadores.
  const char* id = nullptr;
  if (!textoNoVacio(doc["dispositivo_id"], id)) return reclamo;
  const size_t largoId = strlen(id);
  if (largoId > MAX_ID_DISPOSITIVO) return reclamo;
  for (size_t i = 0; i < largoId; ++i) {
    if (id[i] < '0' || id[i] > '9') return reclamo;
  }
  memcpy(reclamo.dispositivoId, id, largoId + 1);
  reclamo.estado = Reclamo::Estado::Vinculado;
  return reclamo;
}

}  // namespace respuesta
