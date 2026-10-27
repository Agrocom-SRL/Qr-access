// Confirmación de la apertura (ADR 0031 §18). Lógica PURA, probada en la PC.
//
// La placa solo LEE el sensor de la puerta y REPORTA: nada de esto abre, cierra ni retrasa una
// validación (invariante 2). Tras una apertura ordenada por el servidor se observa el sensor
// durante el plazo que dicta la configuración y se arma UN informe: `ejecutada` (se vio abrir),
// `fallida` con su causa o `sin_sensor`. Perder el informe es aceptable: el servidor lo toma
// como «sin respuesta».
#pragma once

#include <stddef.h>
#include <stdint.h>

namespace confirmacion {

// Largo máximo del `evento_id` (string de dígitos que devuelve la validación).
constexpr size_t MAX_EVENTO_ID = 20;

enum class Nivel : uint8_t { Bajo, Alto };

// PENDIENTE DE CONFIRMAR EN CAMPO: la polaridad del contacto magnético (reed NC o NO, cableado
// real) no está verificada. Manda el valor que dicta el servidor (`sensor_puerta.nivel_abierto`);
// este es solo el valor por omisión mientras no se haya leído la configuración. Reed NC a masa
// con INPUT_PULLUP: cerrada = LOW, abierta = HIGH.
constexpr Nivel NIVEL_ABIERTO_POR_OMISION = Nivel::Alto;

// Configuración del sensor, tal como la dicta el servidor. Por omisión NO instalado: una placa
// no puede saber sola si el contacto está cableado, y un pin al aire con pull-up lee «abierta».
struct Sensor {
  bool instalado = false;
  Nivel nivelAbierto = NIVEL_ABIERTO_POR_OMISION;
};

enum class Lectura : uint8_t { Abierta, Cerrada, SinSensor };

// Interpreta el nivel del pin según la configuración. Sin sensor instalado no se interpreta.
Lectura interpretar(const Sensor& sensor, bool pinAlto);

enum class Resultado : uint8_t { Ejecutada, Fallida, SinSensor };
enum class Causa : uint8_t { Ninguna, PuertaNoAbrio, PuertaNoCerro, ReleNoAccionado };

// Un informe de apertura listo para enviar.
struct Informe {
  char eventoId[MAX_EVENTO_ID + 1] = {0};
  Resultado resultado = Resultado::SinSensor;
  Causa causa = Causa::Ninguna;
};

// Textos del contrato de la API (docs/hardware/README.md).
const char* texto(Lectura lectura);
const char* texto(Resultado resultado);
const char* texto(Causa causa);  // "" si no hay causa

// Un `evento_id` válido: de 1 a MAX_EVENTO_ID dígitos.
bool eventoIdValido(const char* id);

// Observa el sensor tras UNA apertura ordenada por el servidor. No bloquea: se avanza con
// `tick()` desde el lazo principal.
class Observador {
 public:
  // Empieza a observar la apertura `eventoId`. `inicioPulsoMs` es el comienzo del pulso del relé:
  // el plazo `esperaMs` se cuenta desde ahí. `lecturaActual` evita dar por buena una puerta que ya
  // estaba abierta: en ese caso se exige verla cerrada antes de contar la apertura.
  // Un `eventoId` inválido no se observa (no hay a quién informar). Si ya se observaba otra
  // apertura, esa se cierra primero con lo que se vio hasta ahora.
  void iniciar(const char* eventoId, uint32_t inicioPulsoMs, uint32_t esperaMs, const Sensor& sensor,
               Lectura lecturaActual);

  // La placa no pudo accionar el relé: informe `fallida` / `rele_no_accionado`.
  void releNoAccionado(const char* eventoId);

  // Avanza el tiempo con la lectura del sensor. Barato: no hace nada si no se observa.
  void tick(uint32_t ahoraMs, Lectura lectura);

  bool observando() const { return observando_; }

  // Saca el siguiente informe listo (en orden). false si no hay.
  bool siguiente(Informe& informe);

 private:
  void cerrar(Resultado resultado, Causa causa);
  void cerrarObservacionVigente();
  void encolar(const Informe& informe);

  static constexpr size_t CAPACIDAD = 2;
  Informe listos_[CAPACIDAD];
  size_t cantidad_ = 0;

  bool observando_ = false;
  bool exigeCierre_ = false;
  char eventoId_[MAX_EVENTO_ID + 1] = {0};
  uint32_t inicioMs_ = 0;
  uint32_t esperaMs_ = 0;
};

}  // namespace confirmacion
