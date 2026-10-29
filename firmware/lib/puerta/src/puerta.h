// Máquina de estados del controlador de puerta. Lógica PURA: sin Arduino.h,
// se prueba en la PC con `pio test -e native`.
//
// Invariante 2 (falla segura): la cerradura solo se activa por una respuesta
// positiva de la API a la lectura en curso, o por el pulsador de salida.
// Cualquier otra cosa -rechazo, error, timeout, respuesta tardía- NO abre.
#pragma once

#include <stddef.h>
#include <stdint.h>

#include "motivo.h"

namespace puerta {

constexpr uint32_t TIMEOUT_VALIDACION_MS = 3000;
// Antirrebote del lector (ADR 0032 §4.1): tras una respuesta de la API (permitido o denegado) se
// ignora el MISMO texto durante este tiempo, contado desde la respuesta, para no mandar la misma
// lectura dos veces. No decide nada: solo evita enviar. La ventana de repetición de la API (15 s)
// es independiente y cubre al lector que insiste tras perder una respuesta.
constexpr uint32_t ANTIRREBOTE_MISMO_QR_MS = 3000;
// Tras una respuesta válida con `abrir: true` se ignora el MISMO texto durante la ventana de repetición
// de la API (15 s, ADR 0032 §3) o hasta leer un texto distinto. Así el firmware no reenvía lo que ya
// abrió y la repetición del servidor solo cubre el caso en que la respuesta se perdió (ahí no hubo
// respuesta válida y rige el antirrebote corto de abajo). No cambia la falla segura: solo evita enviar.
constexpr uint32_t IGNORAR_MISMO_QR_TRAS_ABRIR_MS = 15000;
// Si no hubo respuesta válida (sin red, timeout, respuesta inválida) la persona tiene que poder
// reintentar pronto: la falla segura no cambia (esa lectura no abrió), solo se acorta la espera.
constexpr uint32_t ANTIRREBOTE_TRAS_FALLO_MS = 1000;
// Tope DURO de compilación: ni la API ni la configuración lo superan.
constexpr uint16_t MAX_APERTURA_S = 10;
// Tope vigente hasta que la configuración diga otro (siempre <= MAX_APERTURA_S).
constexpr uint16_t APERTURA_POR_DEFECTO_S = 5;
constexpr uint16_t APERTURA_PULSADOR_S = 3;
constexpr size_t MAX_QR = 256;

// true si un pedido de validación hecho en `pedidoMs` ya está vencido: la máquina lo abandonó a los
// TIMEOUT_VALIDACION_MS, así que enviarlo tarde solo haría que el servidor consuma el QR (un solo
// uso) sin que la puerta pueda abrir. La tarea de red lo descarta en vez de enviarlo (invariante 2).
// Tolera el desborde de uint32_t.
bool pedidoVencido(uint32_t pedidoMs, uint32_t ahoraMs);

enum class Estado : uint8_t { Reposo, Validando, Abierta };

// Qué mostrar: permitido, denegado (la API dijo que no), sin red (no se pudo
// preguntar), error (algo falló al preguntar o la respuesta no sirve) y confirmar (la placa espera
// que mantengan pulsado su botón para vincularse, ADR 0026).
enum class Indicacion : uint8_t { Ninguna, Validando, Permitido, Denegado, SinRed, Error, Confirmar };

// Resultado de una validación, ya interpretado por lib/respuesta.
struct Resultado {
  bool valida;        // la respuesta llegó y tiene el formato esperado
  bool abrir;         // la API dijo `abrir: true`
  uint16_t segundos;  // duración del pulso pedida por la API
  Motivo motivo;

  static Resultado invalido(Motivo motivo) { return Resultado{false, false, 0, motivo}; }
  static Resultado denegado(Motivo motivo) { return Resultado{true, false, 0, motivo}; }
  static Resultado permitido(uint16_t segundos) {
    return Resultado{true, true, segundos, Motivo::Permitido};
  }
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

  // Identifica la validación en curso (crece con cada lectura aceptada): una
  // respuesta con otro id es de una consulta vieja y se descarta.
  uint32_t idValidacion() const { return idValidacion_; }

  // Tope de apertura vigente (de la configuración de la API): nunca supera
  // MAX_APERTURA_S ni baja de 1 s.
  void fijarMaxAperturaS(uint16_t segundos);
  uint16_t maxAperturaS() const { return maxAperturaS_; }

  // El lector entregó una línea. Se ignora si ya hay una lectura en curso,
  // si la puerta está abierta, si es demasiado larga o si es el mismo QR de
  // hace instantes.
  Acciones alLeer(const char* texto, uint32_t ahoraMs);

  // Llegó la respuesta (o el error) de la validación `id`. Si no es la que
  // está en curso (tardía, ya vencida) se descarta sin abrir.
  Acciones alResponder(uint32_t id, const Resultado& resultado, uint32_t ahoraMs);

  // El servidor ordenó abrir desde la app (apertura manual, ADR 0035) y la orden sigue vigente (eso lo
  // comprueba quien la recibió, lib/ordenes). Solo abre con el relé libre: con una validación en curso
  // o la puerta ya abierta se DESCARTA (el servidor la vence y la persona reintenta). El pulso se acota
  // al tope vigente, como el de una validación. `segundos` 0 no abre.
  Acciones alRecibirOrdenManual(uint16_t segundos, uint32_t ahoraMs);

  // Pulsador de salida: apertura física, no depende de la red (RF-08).
  Acciones alPulsarSalida(uint32_t ahoraMs);

  // Avance del tiempo: vence la validación o termina el pulso.
  Acciones tick(uint32_t ahoraMs);

 private:
  Acciones abrir(uint32_t ms, uint32_t ahoraMs, Indicacion indicacion);

  Estado estado_ = Estado::Reposo;
  uint32_t desdeMs_ = 0;
  uint32_t duracionMs_ = 0;
  uint32_t idValidacion_ = 0;
  uint16_t maxAperturaS_ = APERTURA_POR_DEFECTO_S;
  char qr_[MAX_QR + 1] = {0};
  char ultimoQr_[MAX_QR + 1] = {0};
  uint32_t ultimoQrMs_ = 0;      // cuándo terminó el último intento con ese texto
  uint32_t ventanaQrMs_ = 0;     // cuánto dura el antirrebote de ese intento
  bool hayUltimoQr_ = false;
};

}  // namespace puerta
