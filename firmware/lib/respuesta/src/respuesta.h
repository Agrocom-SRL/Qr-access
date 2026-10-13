// Interpreta las respuestas de la API del dispositivo (ADR 0005 y contrato V1).
// Lógica PURA, probada en la PC. Regla única: ante la duda, no abre.
#pragma once

#include <stddef.h>
#include <stdint.h>

#include "puerta.h"

namespace respuesta {

constexpr size_t MAX_CUERPO = 512;
// `segundos` / `segundos_apertura` fuera de 1..SEGUNDOS_MAXIMOS_ACEPTADOS es una
// respuesta mal formada. Dentro del rango, el valor se acota a MAX_APERTURA_S.
constexpr int SEGUNDOS_MAXIMOS_ACEPTADOS = 3600;

// POST /api/v1/dispositivos/validaciones. Debe ser HTTP 200 con
//   {"abrir":bool,"evento_id":string,"motivo_code":string[,"segundos":int]}
// - 401 -> inválido (credencial rechazada).
// - cualquier otro HTTP, cuerpo vacío/largo, JSON fuera de forma, campos
//   faltantes o de otro tipo -> inválido.
// - abrir:true exige motivo "acceso.permitido" y `segundos` entero en rango; el
//   resultado trae `segundos` ya acotado a puerta::MAX_APERTURA_S.
// - abrir:false -> denegado, con el motivo informado (o DenegadoOtro).
puerta::Resultado interpretar(int estadoHttp, const char* cuerpo, size_t largo);

// GET /api/v1/dispositivos/configuracion:
//   {"segundos_apertura":int,"zona_horaria":string,"ota":null|...}
struct Configuracion {
  bool valida;
  uint16_t segundosApertura;  // acotado a puerta::MAX_APERTURA_S
};
Configuracion interpretarConfiguracion(int estadoHttp, const char* cuerpo, size_t largo);

// POST /api/v1/dispositivos/reclamar (ADR 0025 §5), sin credencial de dispositivo:
//   {"estado":"pendiente"}  |  {"estado":"vinculado","dispositivo_id":"<dígitos>"}
// Cualquier otra cosa (HTTP distinto de 200, JSON fuera de forma, id que no sean
// dígitos) es `Invalido`: la placa no cambia de estado y vuelve a preguntar.
constexpr size_t MAX_ID_DISPOSITIVO = 20;
struct Reclamo {
  enum class Estado : uint8_t { Invalido, Pendiente, Vinculado };
  Estado estado = Estado::Invalido;
  char dispositivoId[MAX_ID_DISPOSITIVO + 1] = {0};  // solo con Vinculado
  // `rechazado`: 401 (código o clave no reconocidos) o 429 (bloqueo por intentos).
  bool rechazado = false;
};
Reclamo interpretarReclamo(int estadoHttp, const char* cuerpo, size_t largo);

}  // namespace respuesta
