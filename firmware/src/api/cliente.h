// Cliente HTTPS de la API (ADR 0009). Todo corre en su propia tarea de
// FreeRTOS para que loop() no se bloquee (el pulsador de salida sigue
// respondiendo mientras se espera a la red). La validación tiene prioridad
// sobre el latido y la descarga de configuración.
#pragma once

#include <actividad.h>
#include <confirmacion.h>
#include <puerta.h>
#include <respuesta.h>

#include "config/config.h"

namespace api {

// `Confirmacion` es la del vínculo (ADR 0026); `Informe` es la de la apertura (ADR 0031 §18); `Orden`
// es una orden de apertura manual recibida de la app (ADR 0035).
enum class Tipo : uint8_t { Validacion, Latido, Configuracion, Anuncio, Confirmacion, Informe, Orden };

// Resultado de una llamada, ya interpretado por lib/respuesta.
struct Respuesta {
  Tipo tipo;
  uint32_t id;  // solo Validacion: id de la lectura; una respuesta vieja no se confunde con la actual
  int http;     // código HTTP, o negativo si no hubo respuesta (timeout, TLS, sin red)
  puerta::Resultado resultado;         // Validacion
  respuesta::Configuracion config;     // Configuracion
  respuesta::Anuncio anuncio;          // Anuncio y Confirmacion
  // Validacion con apertura: el evento a informar; Informe: el evento informado. Vacío si no hay.
  char eventoId[confirmacion::MAX_EVENTO_ID + 1] = {0};
  // Informe: true si es el de una orden de apertura manual (`eventoId` es el id de la orden).
  bool manual = false;
  // Orden: la orden recibida y el millis() en que llegó la respuesta, de donde corre su plazo relativo.
  respuesta::Orden orden;
  uint32_t recibidaEnMs = 0;
};

// Lo que el latido reporta además de la versión (ADR 0031 §18). Solo lectura de pines.
struct EstadoLatido {
  bool puertaAbierta;                 // false si el sensor no está instalado
  bool sensorConocido;                // false = aún no se leyó la configuración: `sensor` no se informa
  confirmacion::Lectura sensor;       // abierta, cerrada o sin_sensor
  diagnostico::EstadoLector lector;   // Desconocido = no se informa el campo
};

// Arranca la tarea si hay URL válida. Con id y clave válidos queda lista para operar; sin ellos
// solo puede anunciarse (ADR 0026).
void iniciar(const config::Dispositivo& dispositivo);

// Cambia la credencial en caliente (la placa acaba de vincularse, o se la rechazaron).
void fijarCredencial(const String& id, const String& clave);
void quitarCredencial();

// Encola la validación `id` del texto leído (`leidoEn`: epoch UTC de la lectura).
// false si no se pudo encolar.
bool validar(uint32_t id, const char* qr, int64_t leidoEn);

// Encola un latido (POST /dispositivos/latidos) o la descarga de la configuración.
bool enviarLatido(const EstadoLatido& estado);
bool pedirConfiguracion();

// La placa dice quién es (POST /dispositivos/anunciar, sin credencial de dispositivo): MAC + la
// clave que sorteó. El servidor responde si sigue detectada, si espera su botón o si ya está vinculada.
bool anunciar(const char* clave);

// Alguien mantuvo pulsado el botón (POST /dispositivos/confirmar): la prueba de presencia física.
bool confirmar(const char* clave);

// Encola el informe de una apertura (POST /dispositivos/confirmaciones). Es en segundo plano: la
// tarea de red atiende primero cualquier validación pendiente. false si no se pudo encolar.
bool enviarInforme(const confirmacion::Informe& informe);

// Apertura manual (ADR 0035). La placa pregunta por órdenes con una petición larga en su PROPIA tarea,
// aparte de la de validación: esperar una orden nunca retrasa un QR. `habilitarOrdenes(true)` solo
// cuando se debe preguntar (lib/ordenes: operando, con red, configuración leída y `apertura_manual`).
// Tras entregar una orden la tarea queda en pausa hasta `reanudarOrdenes()`: se decide la orden
// recibida antes de volver a preguntar.
void habilitarOrdenes(bool habilitada);
void reanudarOrdenes();

// true si terminó alguna llamada; deja su respuesta en `respuesta`.
bool siguienteRespuesta(Respuesta& respuesta);

}  // namespace api
