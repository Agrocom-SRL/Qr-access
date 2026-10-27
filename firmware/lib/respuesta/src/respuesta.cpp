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

// Sensor de la puerta: todo o nada. Un objeto incompleto o con un nivel desconocido deja el sensor
// NO instalado, que es lo seguro (la placa no inventa ni un éxito ni una falla).
confirmacion::Sensor leerSensor(JsonVariantConst campo) {
  confirmacion::Sensor sensor;  // no instalado
  if (!campo.is<JsonObjectConst>()) return sensor;
  JsonVariantConst instalado = campo["instalado"];
  const char* nivel = nullptr;
  if (!instalado.is<bool>() || !textoNoVacio(campo["nivel_abierto"], nivel)) return sensor;
  if (strcmp(nivel, "alto") == 0) {
    sensor.nivelAbierto = confirmacion::Nivel::Alto;
  } else if (strcmp(nivel, "bajo") == 0) {
    sensor.nivelAbierto = confirmacion::Nivel::Bajo;
  } else {
    return sensor;
  }
  sensor.instalado = instalado.as<bool>();
  return sensor;
}

uint16_t leerEspera(JsonVariantConst campo) {
  if (!campo.is<int>() || campo.is<bool>()) return 0;
  const int segundos = campo.as<int>();
  if (segundos < 1 || segundos > ESPERA_CONFIRMACION_MAXIMA_S) return 0;
  return static_cast<uint16_t>(segundos);
}

}  // namespace

Resultado interpretar(int estadoHttp, const char* cuerpo, size_t largo, char* eventoIdSalida) {
  if (eventoIdSalida != nullptr) eventoIdSalida[0] = '\0';
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
  // Solo una apertura válida y completa deja su evento para informar; lo demás no lo toca.
  if (eventoIdSalida != nullptr && confirmacion::eventoIdValido(eventoId)) {
    strncpy(eventoIdSalida, eventoId, confirmacion::MAX_EVENTO_ID);
    eventoIdSalida[confirmacion::MAX_EVENTO_ID] = '\0';
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
  Configuracion config{true, segundos};
  config.sensor = leerSensor(doc["sensor_puerta"]);
  config.esperaConfirmacionS = leerEspera(doc["espera_confirmacion_segundos"]);
  return config;
}

Anuncio interpretarAnuncio(int estadoHttp, const char* cuerpo, size_t largo) {
  Anuncio anuncio;
  if (estadoHttp == 401 || estadoHttp == 429) {
    anuncio.rechazado = true;
    return anuncio;
  }
  if (estadoHttp != 200) return anuncio;

  JsonDocument doc;
  if (!leerObjeto(cuerpo, largo, doc)) return anuncio;
  const char* estado = nullptr;
  if (!textoNoVacio(doc["estado"], estado)) return anuncio;

  if (strcmp(estado, "detectada") == 0) {
    anuncio.estado = Anuncio::Estado::Detectada;
    return anuncio;
  }
  if (strcmp(estado, "confirmar") == 0) {
    anuncio.estado = Anuncio::Estado::Confirmar;
    return anuncio;
  }
  if (strcmp(estado, "vinculado") != 0) return anuncio;

  // El id llega en un encabezado `Dispositivo <id>.<clave>`: solo dígitos, sin separadores.
  const char* id = nullptr;
  if (!textoNoVacio(doc["dispositivo_id"], id)) return anuncio;
  const size_t largoId = strlen(id);
  if (largoId > MAX_ID_DISPOSITIVO) return anuncio;
  for (size_t i = 0; i < largoId; ++i) {
    if (id[i] < '0' || id[i] > '9') return anuncio;
  }
  memcpy(anuncio.dispositivoId, id, largoId + 1);
  anuncio.estado = Anuncio::Estado::Vinculado;
  return anuncio;
}

}  // namespace respuesta
