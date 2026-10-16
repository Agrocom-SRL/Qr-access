#include "motivo.h"

#include <string.h>

namespace puerta {

namespace {

struct Entrada {
  const char* codigo;
  Motivo motivo;
};

constexpr Entrada TABLA[] = {
    {"acceso.permitido", Motivo::Permitido},
    {"qr.formato_invalido", Motivo::QrFormatoInvalido},
    {"qr.desconocido", Motivo::QrDesconocido},
    {"qr.anulado", Motivo::QrAnulado},
    {"qr.otra_puerta", Motivo::QrOtraPuerta},
    {"qr.usado", Motivo::QrUsado},
    {"qr.vencido", Motivo::QrVencido},
    {"suscripcion.vencida", Motivo::SuscripcionVencida},
};

}  // namespace

Motivo motivoDe(const char* codigo) {
  if (codigo == nullptr) return Motivo::DenegadoOtro;
  for (const Entrada& entrada : TABLA) {
    if (strcmp(codigo, entrada.codigo) == 0) return entrada.motivo;
  }
  return Motivo::DenegadoOtro;
}

const char* mensaje(Motivo motivo) {
  switch (motivo) {
    case Motivo::Permitido: return "acceso permitido";
    case Motivo::QrFormatoInvalido: return "denegado: QR con formato invalido";
    case Motivo::QrDesconocido: return "denegado: QR desconocido";
    case Motivo::QrAnulado: return "denegado: QR anulado";
    case Motivo::QrOtraPuerta: return "denegado: QR de otra puerta";
    case Motivo::QrUsado: return "denegado: QR ya usado";
    case Motivo::QrVencido: return "denegado: QR vencido";
    case Motivo::SuscripcionVencida: return "denegado: suscripcion vencida";
    case Motivo::DenegadoOtro: return "denegado: motivo no reconocido";
    case Motivo::SinRed: return "sin red u hora valida: no se valida";
    case Motivo::CredencialInvalida: return "error: la API rechazo la credencial del dispositivo";
    case Motivo::RespuestaInvalida: return "error: respuesta invalida o sin respuesta";
  }
  return "error";
}

}  // namespace puerta
