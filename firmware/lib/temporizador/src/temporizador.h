// Temporizadores no bloqueantes sobre un reloj inyectable. Lógica PURA: en la
// placa el reloj es millis(); en los tests, uno manual. Todas las restas toleran
// el desborde de uint32_t (millis() vuelve a 0 cada ~49 días).
#pragma once

#include <stdint.h>

namespace temporizador {

class Reloj {
 public:
  virtual ~Reloj() = default;
  virtual uint32_t ahoraMs() const = 0;
};

// Dispara una vez por periodo (p. ej. el latido cada 60 s).
class Periodico {
 public:
  // `inmediato`: el primer `vencio()` es true sin esperar un periodo.
  Periodico(const Reloj& reloj, uint32_t periodoMs, bool inmediato);

  // true una sola vez cada vez que se cumple el periodo.
  bool vencio();

  // Vence ya, en la próxima consulta.
  void adelantar() { pendiente_ = true; }

 private:
  const Reloj& reloj_;
  uint32_t periodoMs_;
  uint32_t ultimoMs_;
  bool pendiente_;
};

// Espera creciente entre reintentos (reconexión WiFi): 1.ª espera `inicialMs`,
// luego el doble hasta `maximoMs`. `exito()` la reinicia.
class Backoff {
 public:
  Backoff(const Reloj& reloj, uint32_t inicialMs, uint32_t maximoMs);

  // true si ya pasó la espera del último fallo (o no hubo ninguno).
  bool toca() const;
  void fallo();
  void exito();

  uint32_t esperaActualMs() const { return esperaMs_; }

 private:
  const Reloj& reloj_;
  uint32_t inicialMs_;
  uint32_t maximoMs_;
  uint32_t esperaMs_ = 0;      // espera que rige ahora
  uint32_t siguienteMs_;       // espera del próximo fallo
  uint32_t desdeMs_ = 0;
};

// Tarea periódica que puede fallar (descarga de la configuración): cada
// `periodoMs` si sale bien; si falla, reintenta con backoff hasta `periodoMs`.
// Nace vencida (se hace al arrancar).
class Tarea {
 public:
  Tarea(const Reloj& reloj, uint32_t periodoMs, uint32_t reintentoInicialMs);

  // true cuando hay que ejecutarla. Queda agendado el reintento por si
  // `terminada()` nunca llega (no se queda trabada).
  bool toca();

  // Resultado de la ejecución en curso.
  void terminada(bool ok);

 private:
  const Reloj& reloj_;
  uint32_t periodoMs_;
  uint32_t reintentoInicialMs_;
  uint32_t siguienteReintentoMs_;
  uint32_t esperaMs_ = 0;
  uint32_t desdeMs_ = 0;
};

}  // namespace temporizador
