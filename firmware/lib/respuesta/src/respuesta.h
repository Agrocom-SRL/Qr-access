// Interpreta las respuestas de la API del dispositivo (ADR 0005 y contrato V1).
// Lógica PURA, probada en la PC. Regla única: ante la duda, no abre.
#pragma once

#include <stddef.h>
#include <stdint.h>

#include "confirmacion.h"
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
//
// `eventoId` (opcional, con capacidad confirmacion::MAX_EVENTO_ID + 1) recibe el `evento_id` de una
// apertura permitida, para informar su desenlace (ADR 0031 §18). Queda vacío si no hay apertura o
// si el id no son 1-20 dígitos: eso solo deja sin informe, NUNCA cambia si se abre o no.
puerta::Resultado interpretar(int estadoHttp, const char* cuerpo, size_t largo,
                              char* eventoId = nullptr);

// GET /api/v1/dispositivos/configuracion:
//   {"segundos_apertura":int,"zona_horaria":string,"ota":null|...,
//    "sensor_puerta":{"instalado":bool,"nivel_abierto":"alto"|"bajo"},
//    "espera_confirmacion_segundos":int}
// `valida` depende solo de `segundos_apertura` (la falla segura no cambia). Los campos del sensor y
// de la espera son opcionales: si faltan o vienen mal formados, el sensor queda NO instalado y la
// espera en 0 («no vino»), y la placa informa `sin_sensor`.
constexpr int ESPERA_CONFIRMACION_MAXIMA_S = 600;
//
// `apertura_manual` (ADR 0035): el interruptor de la puerta. Solo `true` explícito hace que la placa
// pregunte por órdenes; si falta o viene mal formado queda en `false` (no pregunta).
struct Configuracion {
  bool valida;
  uint16_t segundosApertura;  // acotado a puerta::MAX_APERTURA_S
  confirmacion::Sensor sensor = {};
  uint16_t esperaConfirmacionS = 0;  // 0 = no vino
  bool aperturaManual = false;
};
Configuracion interpretarConfiguracion(int estadoHttp, const char* cuerpo, size_t largo);

// POST /api/v1/dispositivos/anunciar y /confirmar (ADR 0026), sin credencial de dispositivo:
//   {"estado":"detectada"}  |  {"estado":"confirmar"}
//   |  {"estado":"vinculado","dispositivo_id":"<dígitos>"}
// `confirmar` pide que alguien mantenga pulsado el botón de la placa. Cualquier otra cosa (HTTP
// distinto de 200, JSON fuera de forma, id que no sean dígitos) es `Invalido`: la placa no cambia
// de estado y vuelve a preguntar.
constexpr size_t MAX_ID_DISPOSITIVO = 20;
struct Anuncio {
  enum class Estado : uint8_t { Invalido, Detectada, Confirmar, Vinculado };
  Estado estado = Estado::Invalido;
  char dispositivoId[MAX_ID_DISPOSITIVO + 1] = {0};  // solo con Vinculado
  // `rechazado`: 401 (clave no reconocida) o 429 (bloqueo por intentos).
  bool rechazado = false;
};
Anuncio interpretarAnuncio(int estadoHttp, const char* cuerpo, size_t largo);

// GET /api/v1/dispositivos/ordenes (petición larga, ADR 0035 §2):
//   200 {"orden_id":"<dígitos>","valida_por_ms":int,"segundos_apertura":int}  -> hay una orden
//   204                                                                         -> pasó la espera sin orden
// Cualquier otra cosa (otro HTTP, JSON fuera de forma, id que no sean 1-20 dígitos, plazo ausente o
// fuera de 1..MAX_VALIDA_POR_MS, segundos fuera de rango) es `Invalida`: NO abre. `valida_por_ms` es el
// plazo restante RELATIVO; quien lo use debe contarlo desde que recibió la respuesta (lib/ordenes).
// `segundos` sale acotado a puerta::MAX_APERTURA_S.
constexpr uint32_t MAX_VALIDA_POR_MS = 120000;
struct Orden {
  enum class Estado : uint8_t { Invalida, SinOrden, Recibida };
  Estado estado = Estado::Invalida;
  char id[confirmacion::MAX_EVENTO_ID + 1] = {0};  // solo con Recibida
  uint32_t validaPorMs = 0;                         // solo con Recibida
  uint16_t segundos = 0;                            // solo con Recibida
};
Orden interpretarOrden(int estadoHttp, const char* cuerpo, size_t largo);

}  // namespace respuesta
