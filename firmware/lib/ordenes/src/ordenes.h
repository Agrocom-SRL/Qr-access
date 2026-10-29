// Apertura manual desde la app (ADR 0035). Lógica PURA, probada en la PC.
//
// La placa pregunta por órdenes con una petición larga, en su propia tarea y aparte del lector QR.
// Aquí solo se decide CUÁNDO preguntar, CUÁNTO esperar tras un fallo y si una orden recibida sigue
// vigente. Nada de esto abre: abrir lo decide puerta::Maquina, y solo con una orden positiva y vigente
// del servidor (invariante 2). Ante la duda, no abre.
#pragma once

#include <stdint.h>

namespace ordenes {

// Tiempo de lectura de la petición larga: la API retiene hasta ~20 s y vence a los 25 s, así que
// siempre contesta antes. Es solo para esta ruta; las demás siguen con sus topes cortos.
constexpr uint32_t ESPERA_LECTURA_MS = 30000;
// Una respuesta que tarda menos que esto no fue una espera larga (204 inmediato por el interruptor
// apagado, un 429 o un error): se espera antes de volver a preguntar para no hacerlo en bucle.
constexpr uint32_t RESPUESTA_RAPIDA_MS = 2000;
constexpr uint32_t ESPERA_MINIMA_MS = 1000;
constexpr uint32_t ESPERA_MAXIMA_MS = 5000;

// La placa solo pregunta por órdenes si está vinculada y operando, con red lista, ya leyó la
// configuración y esa configuración dice `apertura_manual: true`.
bool debePreguntar(bool operando, bool redLista, bool configuracionLeida, bool aperturaManual);

// true si la respuesta llegó tan rápido que no fue una espera larga (ver RESPUESTA_RAPIDA_MS) o falló.
bool respuestaRapida(uint32_t duracionMs);

// Espera antes de volver a preguntar tras `rapidas` respuestas rápidas o fallidas seguidas (1 = la
// primera): 1 s, 2 s, 4 s, 5 s... con tope de ESPERA_MAXIMA_MS. 0 = no esperar.
uint32_t esperaTras(uint8_t rapidas);

// true si la orden recibida en `recibidaMs` con plazo RELATIVO `validaPorMs` sigue vigente en
// `ahoraMs`. El plazo se cuenta desde que llegó la respuesta (la placa no depende de su reloj). Tolera
// el desborde de millis() y un `ahoraMs` anterior a `recibidaMs` (cuenta 0 transcurrido). Con
// `validaPorMs` 0 nunca está vigente.
bool vigente(uint32_t recibidaMs, uint32_t validaPorMs, uint32_t ahoraMs);

}  // namespace ordenes
