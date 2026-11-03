// Entrega en segundo plano de los informes de apertura, con reintentos. Lógica PURA, probada en
// la PC. Reglas (docs/hardware/README.md, ADR 0031 §18):
//  - un solo informe por apertura (un `evento_id` no se agrega dos veces);
//  - se reintenta SOLO ante falta de red (sin respuesta), 429 o 5xx, con espera creciente, y hasta
//    ~10 min (el servidor responde 409 pasado su plazo, y entonces el informe se descarta);
//  - cualquier otro código (204 y 2xx = entregado; 400, 401, 404, 409... = se descarta);
//  - perder un informe es aceptable: no se persiste y, con la cola llena, se pierde el más viejo.
// Nada de esto toca la cerradura ni retrasa una validación: solo decide CUÁNDO volver a intentar.
#pragma once

#include <stdint.h>

#include "confirmacion.h"

namespace confirmacion {

constexpr uint8_t CAPACIDAD_ENTREGAS = 4;
constexpr uint32_t ESPERA_INICIAL_MS = 5000;
constexpr uint32_t ESPERA_MAXIMA_MS = 120000;
// Un poco menos de los 10 min del servidor. Se cuenta desde que se conoce el desenlace; si el plazo
// de espera es largo y el servidor ya diera 409, el informe simplemente se descarta.
constexpr uint32_t PLAZO_ENTREGA_MS = 570000;
// Si la tarea de red no devuelve respuesta en este tiempo, el intento se da por fallido.
constexpr uint32_t VENCE_ENVIO_MS = 10000;

class Entregas {
 public:
  // Encola un informe cuyo desenlace se conoció en `ordenMs`. false si ya estaba (un solo informe por
  // apertura). Con la cola llena, descarta el más viejo.
  bool agregar(const Informe& informe, uint32_t ordenMs);

  // El informe que toca enviar ahora (null si ninguno, o si ya hay uno en vuelo). Descarta los que
  // pasaron del plazo y da por fallido un envío en vuelo que nunca contestó.
  const Informe* debeEnviar(uint32_t ahoraMs);

  // El informe `eventoId` (el devuelto por `debeEnviar`) quedó encolado en la tarea de red.
  // `manual` distingue el id de una orden de apertura manual del de un evento de lectura (ADR 0035).
  void enviado(const char* eventoId, uint32_t ahoraMs, bool manual = false);

  // Llegó el resultado del envío de `eventoId`: `http` <= 0 es «sin respuesta» (red, TLS, timeout).
  void alResponder(const char* eventoId, int http, uint32_t ahoraMs, bool manual = false);

  uint8_t pendientes() const { return cantidad_; }

  // Espera tras el intento número `intentos` (1 = el primero que falló): 5 s, 10 s, 20 s... tope 2 min.
  static uint32_t esperaTras(uint8_t intentos);

 private:
  struct Entrada {
    Informe informe;
    uint32_t ordenMs = 0;
    uint32_t ultimoIntentoMs = 0;
    uint32_t esperaMs = 0;  // 0 = toca ya
    uint8_t intentos = 0;
    bool enVuelo = false;
  };

  void quitar(uint8_t indice);
  void fallo(uint8_t indice, uint32_t ahoraMs);
  int buscar(const char* eventoId, bool manual) const;

  Entrada entradas_[CAPACIDAD_ENTREGAS];
  uint8_t cantidad_ = 0;
};

// true si el código HTTP justifica reintentar (falta de red, 429 o 5xx).
bool reintentable(int http);
// true si el informe quedó registrado (2xx; el 204 también cubre «ya había un informe»).
bool entregado(int http);

}  // namespace confirmacion
