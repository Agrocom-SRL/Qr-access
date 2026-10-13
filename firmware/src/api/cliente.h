// Cliente HTTPS de la API (ADR 0009). Todo corre en su propia tarea de
// FreeRTOS para que loop() no se bloquee (el pulsador de salida sigue
// respondiendo mientras se espera a la red). La validación tiene prioridad
// sobre el latido y la descarga de configuración.
#pragma once

#include <puerta.h>
#include <respuesta.h>

#include "config/config.h"

namespace api {

enum class Tipo : uint8_t { Validacion, Latido, Configuracion, Reclamo };

// Resultado de una llamada, ya interpretado por lib/respuesta.
struct Respuesta {
  Tipo tipo;
  uint32_t id;  // solo Validacion: id de la lectura; una respuesta vieja no se confunde con la actual
  int http;     // código HTTP, o negativo si no hubo respuesta (timeout, TLS, sin red)
  puerta::Resultado resultado;         // Validacion
  respuesta::Configuracion config;     // Configuracion
  respuesta::Reclamo reclamo;          // Reclamo
};

// Arranca la tarea si hay URL válida. Con id y clave válidos queda lista para operar; sin ellos
// solo puede reclamar su vínculo (ADR 0025).
void iniciar(const config::Dispositivo& dispositivo);

// Cambia la credencial en caliente (la placa acaba de vincularse, o se la rechazaron).
void fijarCredencial(const String& id, const String& clave);
void quitarCredencial();

// Encola la validación `id` del texto leído (`leidoEn`: epoch UTC de la lectura).
// false si no se pudo encolar.
bool validar(uint32_t id, const char* qr, int64_t leidoEn);

// Encola un latido (POST /dispositivos/latidos) o la descarga de la configuración.
bool enviarLatido(bool puertaAbierta);
bool pedirConfiguracion();

// Pregunta al servidor si la placa ya tiene vínculo (POST /dispositivos/reclamar, sin
// credencial de dispositivo): MAC + código de vinculación + la clave que sorteó la placa.
bool reclamar(const char* codigo, const char* clave);

// true si terminó alguna llamada; deja su respuesta en `respuesta`.
bool siguienteRespuesta(Respuesta& respuesta);

}  // namespace api
