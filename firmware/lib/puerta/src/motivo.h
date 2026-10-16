// Motivo de una validación, tal como lo informa la API en `motivo_code`
// (ADR 0008). El firmware no decide nada con él: solo elige qué mostrar.
// Lógica PURA, probada en la PC.
#pragma once

#include <stdint.h>

namespace puerta {

enum class Motivo : uint8_t {
  Permitido,           // acceso.permitido
  QrFormatoInvalido,   // qr.formato_invalido
  QrDesconocido,       // qr.desconocido
  QrAnulado,           // qr.anulado
  QrOtraPuerta,        // qr.otra_puerta
  QrUsado,             // qr.usado
  QrVencido,           // qr.vencido
  SuscripcionVencida,  // suscripcion.vencida
  DenegadoOtro,        // la API denegó con un código que este firmware no conoce
  SinRed,              // local: sin WiFi, sin hora o sin poder enviar la consulta
  CredencialInvalida,  // local: la API contestó 401
  RespuestaInvalida,   // local: timeout, TLS, JSON fuera de forma, HTTP != 200
};

// Traduce el `motivo_code` de la API. Un código desconocido es DenegadoOtro.
Motivo motivoDe(const char* codigo);

// Texto corto para el log serie (sin datos sensibles).
const char* mensaje(Motivo motivo);

}  // namespace puerta
