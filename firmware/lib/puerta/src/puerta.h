// Máquina de estados del controlador de puerta. Lógica PURA: sin Arduino.h,
// se prueba en la PC con `pio test -e native`.
//
// Invariante 2 (falla segura): la cerradura solo se activa por una respuesta
// positiva de la API a la lectura en curso, o por el pulsador de salida.
// Cualquier otra cosa -rechazo, error, timeout, respuesta tardía- NO abre.
#pragma once

#include <stddef.h>
#include <stdint.h>

namespace puerta {

constexpr uint32_t TIMEOUT_VALIDACION_MS = 3000;
constexpr uint32_t ANTIRREBOTE_MISMO_QR_MS = 2000;
constexpr uint16_t MAX_APERTURA_S = 10;
constexpr uint16_t APERTURA_PULSADOR_S = 3;
constexpr size_t MAX_QR = 256;

enum class Estado : uint8_t { Reposo, Validando, Abierta };

enum class Indicacion : uint8_t { Ninguna, Validando, Permitido, Denegado, Error };

// Resultado de una validación, ya interpretado por lib/respuesta.
struct Resultado {
  bool valida;      // la respuesta llegó y tiene el formato esperado
  bool abrir;       // la API dijo `abrir: true`
  uint16_t segundos;  // duración del pulso pedida por la API
};

// Lo que el hardware tiene que hacer después de cada evento.
struct Acciones {
  bool enviarValidacion = false;  // mandar `qr()` a la API
  bool activarCerradura = false;  // empezar el pulso de `msApertura`
  bool desactivarCerradura = false;
  uint32_t msApertura = 0;
  Indicacion indicacion = Indicacion::Ninguna;
};

class Maquina {
 public:
  Estado estado() const { return estado_; }
  bool cerraduraActiva() const { return estado_ == Estado::Abierta; }
  const char* qr() const { return qr_; }

  // El lector entregó una línea. Se ignora si ya hay una lectura en curso,
  // si la puerta está abierta, si es demasiado larga o si es el mismo QR de
  // hace instantes.
  Acciones alLeer(const char* texto, uint32_t ahoraMs);

  // Llegó la respuesta (o el error) de la validación en curso.
  Acciones alResponder(const Resultado& resultado, uint32_t ahoraMs);

  // Pulsador de salida: apertura física, no depende de la red (RF-08).
  Acciones alPulsarSalida(uint32_t ahoraMs);

  // Avance del tiempo: vence la validación o termina el pulso.
  Acciones tick(uint32_t ahoraMs);

 private:
  Acciones abrir(uint32_t ms, uint32_t ahoraMs, Indicacion indicacion);

  Estado estado_ = Estado::Reposo;
  uint32_t desdeMs_ = 0;
  uint32_t duracionMs_ = 0;
  char qr_[MAX_QR + 1] = {0};
  char ultimoQr_[MAX_QR + 1] = {0};
  uint32_t ultimoQrMs_ = 0;
  bool hayUltimoQr_ = false;
};

}  // namespace puerta
