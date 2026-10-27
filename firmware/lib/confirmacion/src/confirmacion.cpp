#include "confirmacion.h"

#include <string.h>

namespace confirmacion {

Lectura interpretar(const Sensor& sensor, bool pinAlto) {
  if (!sensor.instalado) return Lectura::SinSensor;
  const bool pinEnNivelAbierto = pinAlto == (sensor.nivelAbierto == Nivel::Alto);
  return pinEnNivelAbierto ? Lectura::Abierta : Lectura::Cerrada;
}

const char* texto(Lectura lectura) {
  switch (lectura) {
    case Lectura::Abierta: return "abierta";
    case Lectura::Cerrada: return "cerrada";
    case Lectura::SinSensor: return "sin_sensor";
  }
  return "sin_sensor";
}

const char* texto(Resultado resultado) {
  switch (resultado) {
    case Resultado::Ejecutada: return "ejecutada";
    case Resultado::Fallida: return "fallida";
    case Resultado::SinSensor: return "sin_sensor";
  }
  return "sin_sensor";
}

const char* texto(Causa causa) {
  switch (causa) {
    case Causa::PuertaNoAbrio: return "puerta_no_abrio";
    case Causa::PuertaNoCerro: return "puerta_no_cerro";
    case Causa::ReleNoAccionado: return "rele_no_accionado";
    case Causa::Ninguna: break;
  }
  return "";
}

bool eventoIdValido(const char* id) {
  if (id == nullptr) return false;
  const size_t largo = strnlen(id, MAX_EVENTO_ID + 1);
  if (largo == 0 || largo > MAX_EVENTO_ID) return false;
  for (size_t i = 0; i < largo; ++i) {
    if (id[i] < '0' || id[i] > '9') return false;
  }
  return true;
}

void Observador::encolar(const Informe& informe) {
  // Con la cola llena se pierde el más viejo: el informe es diagnóstico, nunca bloquea nada.
  if (cantidad_ == CAPACIDAD) {
    listos_[0] = listos_[1];
    --cantidad_;
  }
  listos_[cantidad_++] = informe;
}

void Observador::cerrarObservacionVigente() {
  if (observando_) cerrar(Resultado::Fallida, Causa::PuertaNoAbrio);
}

void Observador::cerrar(Resultado resultado, Causa causa) {
  Informe informe;
  memcpy(informe.eventoId, eventoId_, sizeof(informe.eventoId));
  informe.resultado = resultado;
  informe.causa = causa;
  encolar(informe);
  observando_ = false;
  memset(eventoId_, 0, sizeof(eventoId_));
}

void Observador::iniciar(const char* eventoId, uint32_t inicioPulsoMs, uint32_t esperaMs,
                         const Sensor& sensor, Lectura lecturaActual) {
  if (!eventoIdValido(eventoId)) return;
  // Una apertura nueva con la anterior aún en observación: la anterior no vio abrir la puerta
  // (si no, ya estaría informada) y se cierra como `puerta_no_abrio` en vez de perderse.
  cerrarObservacionVigente();
  strncpy(eventoId_, eventoId, MAX_EVENTO_ID);
  eventoId_[MAX_EVENTO_ID] = '\0';
  if (!sensor.instalado) {
    cerrar(Resultado::SinSensor, Causa::Ninguna);
    return;
  }
  observando_ = true;
  exigeCierre_ = lecturaActual == Lectura::Abierta;
  inicioMs_ = inicioPulsoMs;
  esperaMs_ = esperaMs;
}

void Observador::releNoAccionado(const char* eventoId) {
  if (!eventoIdValido(eventoId)) return;
  cerrarObservacionVigente();
  strncpy(eventoId_, eventoId, MAX_EVENTO_ID);
  eventoId_[MAX_EVENTO_ID] = '\0';
  cerrar(Resultado::Fallida, Causa::ReleNoAccionado);
}

void Observador::tick(uint32_t ahoraMs, Lectura lectura) {
  if (!observando_) return;
  if (lectura == Lectura::Cerrada) exigeCierre_ = false;
  if (lectura == Lectura::Abierta && !exigeCierre_) {
    // Se informa en cuanto se ve abrir, sin esperar al fin del plazo.
    cerrar(Resultado::Ejecutada, Causa::Ninguna);
    return;
  }
  if (ahoraMs - inicioMs_ >= esperaMs_) cerrar(Resultado::Fallida, Causa::PuertaNoAbrio);
}

bool Observador::siguiente(Informe& informe) {
  if (cantidad_ == 0) return false;
  informe = listos_[0];
  listos_[0] = listos_[1];
  --cantidad_;
  return true;
}

}  // namespace confirmacion
