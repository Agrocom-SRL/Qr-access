#include "lector_qr.h"

#include "pines.h"

namespace lector_qr {

namespace {
// El lector habla RS485 a través del módulo TTL-RS485 (docs/hardware/README.md). Con RE y DE a
// GND el módulo solo recibe, que es lo que hace falta: el lector transmite y la placa escucha.
// La velocidad depende del lector; se cambia con -DLECTOR_BAUDIOS=<n> sin tocar el código.
#ifndef LECTOR_BAUDIOS
#define LECTOR_BAUDIOS 115200  // confirmado con el ZKTeco QR600 en la mesa (2026-10-14)
#endif
constexpr uint32_t BAUDIOS = LECTOR_BAUDIOS;
// El QR600 por RS485 manda el texto sin CR/LF y a veces repetido de corrido. Una lectura termina
// con el fin de línea (otros lectores), con un silencio de la línea o cuando empieza otra `AQ1.`
// (formato del texto del QR, ADR 0008). La repetición idéntica la ignora puerta (antirrebote).
constexpr uint32_t SILENCIO_FIN_MS = 80;
constexpr char PREFIJO[] = "AQ1.";
constexpr size_t LARGO_PREFIJO = sizeof(PREFIJO) - 1;
char buffer[puerta::MAX_QR + 1];
size_t largo = 0;
bool descartando = false;
uint32_t ultimoByteMs = 0;
diagnostico::ActividadLector actividad;

bool empiezaOtraLectura() {
  return largo > LARGO_PREFIJO && memcmp(buffer + largo - LARGO_PREFIJO, PREFIJO, LARGO_PREFIJO) == 0;
}
}  // namespace

void iniciar() {
#ifdef ACCESO_DESARROLLO
  Serial.printf("[lector] escuchando a %u baudios\n", static_cast<unsigned>(BAUDIOS));
#endif
  Serial2.begin(BAUDIOS, SERIAL_8N1, PIN_LECTOR_RX, PIN_LECTOR_TX);
}

bool leer(char (&linea)[puerta::MAX_QR + 1]) {
  while (Serial2.available() > 0) {
    const int c = Serial2.read();
    actividad.alRecibir(millis());
#ifdef ACCESO_DESARROLLO
    // Solo mesa de trabajo: cada byte crudo del lector, para averiguar su baud y su formato.
    Serial.printf("[lector] %02X %c\n", c, (c >= 32 && c < 127) ? c : '.');
#endif
    if (c == '\r' || c == '\n') {
      const bool completa = !descartando && largo > 0;
      if (completa) {
        buffer[largo] = '\0';
        memcpy(linea, buffer, largo + 1);
      }
      largo = 0;
      descartando = false;
      if (completa) return true;
      continue;
    }
    if (descartando) continue;
    if (largo >= puerta::MAX_QR) {
      descartando = true;  // demasiado larga: se descarta hasta el fin de línea
      largo = 0;
      continue;
    }
    ultimoByteMs = millis();
    buffer[largo++] = static_cast<char>(c);
    if (empiezaOtraLectura()) {
      // Se entrega la lectura anterior y el prefijo recién llegado abre la siguiente.
      largo -= LARGO_PREFIJO;
      buffer[largo] = '\0';
      memcpy(linea, buffer, largo + 1);
      memcpy(buffer, PREFIJO, LARGO_PREFIJO);
      largo = LARGO_PREFIJO;
      return true;
    }
  }
  if (largo > 0 && !descartando && millis() - ultimoByteMs >= SILENCIO_FIN_MS) {
    buffer[largo] = '\0';
    memcpy(linea, buffer, largo + 1);
    largo = 0;
    return true;
  }
  return false;
}

diagnostico::EstadoLector estado(uint32_t ahoraMs) { return actividad.estado(ahoraMs); }

bool huboActividadReciente(uint32_t ahoraMs, uint32_t ventanaMs) {
  return actividad.huboActividadReciente(ahoraMs, ventanaMs);
}

}  // namespace lector_qr
