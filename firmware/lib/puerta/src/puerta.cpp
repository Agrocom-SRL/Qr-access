#include "puerta.h"

#include <string.h>

namespace puerta {

namespace {

// Resta con desborde: millis() vuelve a 0 cada ~49 días.
uint32_t transcurrido(uint32_t desde, uint32_t ahora) { return ahora - desde; }

}  // namespace

void Maquina::fijarMaxAperturaS(uint16_t segundos) {
  if (segundos < 1) segundos = 1;
  maxAperturaS_ = segundos > MAX_APERTURA_S ? MAX_APERTURA_S : segundos;
}

Acciones Maquina::alLeer(const char* texto, uint32_t ahoraMs) {
  Acciones acciones;
  if (estado_ != Estado::Reposo || texto == nullptr) return acciones;

  const size_t largo = strnlen(texto, MAX_QR + 1);
  if (largo == 0 || largo > MAX_QR) return acciones;

  if (hayUltimoQr_ && strcmp(texto, ultimoQr_) == 0 &&
      transcurrido(ultimoQrMs_, ahoraMs) < ANTIRREBOTE_MISMO_QR_MS) {
    return acciones;
  }

  memcpy(qr_, texto, largo + 1);
  memcpy(ultimoQr_, texto, largo + 1);
  ultimoQrMs_ = ahoraMs;
  hayUltimoQr_ = true;

  estado_ = Estado::Validando;
  idValidacion_++;
  desdeMs_ = ahoraMs;
  acciones.enviarValidacion = true;
  acciones.indicacion = Indicacion::Validando;
  return acciones;
}

Acciones Maquina::alResponder(uint32_t id, const Resultado& resultado, uint32_t ahoraMs) {
  Acciones acciones;
  // Una respuesta fuera de la validación en curso (tardía, de otra lectura) se descarta.
  if (estado_ != Estado::Validando || id != idValidacion_) return acciones;

  memset(qr_, 0, sizeof(qr_));
  if (resultado.valida && resultado.abrir && resultado.segundos > 0) {
    const uint16_t segundos =
        resultado.segundos > maxAperturaS_ ? maxAperturaS_ : resultado.segundos;
    return abrir(static_cast<uint32_t>(segundos) * 1000U, ahoraMs, Indicacion::Permitido);
  }

  estado_ = Estado::Reposo;
  if (resultado.valida) {
    acciones.indicacion = Indicacion::Denegado;
  } else {
    acciones.indicacion =
        resultado.motivo == Motivo::SinRed ? Indicacion::SinRed : Indicacion::Error;
  }
  return acciones;
}

Acciones Maquina::alPulsarSalida(uint32_t ahoraMs) {
  if (estado_ == Estado::Abierta) return Acciones{};
  // Una validación en curso se abandona: su respuesta ya no abrirá nada.
  memset(qr_, 0, sizeof(qr_));
  const uint16_t segundos =
      APERTURA_PULSADOR_S > maxAperturaS_ ? maxAperturaS_ : APERTURA_PULSADOR_S;
  return abrir(static_cast<uint32_t>(segundos) * 1000U, ahoraMs, Indicacion::Ninguna);
}

Acciones Maquina::tick(uint32_t ahoraMs) {
  Acciones acciones;
  const uint32_t pasado = transcurrido(desdeMs_, ahoraMs);
  if (estado_ == Estado::Validando && pasado >= TIMEOUT_VALIDACION_MS) {
    estado_ = Estado::Reposo;
    memset(qr_, 0, sizeof(qr_));
    acciones.indicacion = Indicacion::Error;
  } else if (estado_ == Estado::Abierta && pasado >= duracionMs_) {
    estado_ = Estado::Reposo;
    acciones.desactivarCerradura = true;
  }
  return acciones;
}

Acciones Maquina::abrir(uint32_t ms, uint32_t ahoraMs, Indicacion indicacion) {
  Acciones acciones;
  estado_ = Estado::Abierta;
  desdeMs_ = ahoraMs;
  duracionMs_ = ms;
  acciones.activarCerradura = true;
  acciones.msApertura = ms;
  acciones.indicacion = indicacion;
  return acciones;
}

}  // namespace puerta
