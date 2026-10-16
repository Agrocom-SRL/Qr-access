#include "red.h"

#include <ETH.h>
#include <WiFi.h>  // solo para los eventos de red de Arduino-ESP32; la radio WiFi no se enciende
#include <tiempo.h>
#include <time.h>

#include "pines.h"

#ifndef ACCESO_ETH01
#error "El firmware es solo Ethernet (ADR 0025): compila con ACCESO_ETH01 (env esp32)"
#endif

namespace red {

namespace {

bool ntpPedido = false;
volatile bool conIp = false;

void alEventoDeRed(arduino_event_id_t evento) {
  if (evento == ARDUINO_EVENT_ETH_GOT_IP) conIp = true;
  if (evento == ARDUINO_EVENT_ETH_DISCONNECTED || evento == ARDUINO_EVENT_ETH_STOP) conIp = false;
}

/// Deja en el serie si hay enlace y con qué IP: es lo primero que se mira al integrar.
void registrarCambioDeEnlace() {
  static int anterior = -1;
  const int actual = conIp ? 1 : 0;
  if (actual == anterior) return;
  anterior = actual;
  if (actual == 1) {
    Serial.printf("[red] ethernet conectado, ip %s\n", ETH.localIP().toString().c_str());
  } else {
    Serial.println("[red] sin enlace: esperando el cable");
  }
}

void pedirHoraUnaVez() {
  if (ntpPedido) return;
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  ntpPedido = true;
}

}  // namespace

void iniciar() {
  WiFi.onEvent(alEventoDeRed);
  ETH.begin(ETH_PHY_ADDR_LAN8720, ETH_PIN_ENERGIA, ETH_PIN_MDC, ETH_PIN_MDIO, ETH_PHY_LAN8720,
            ETH_CLOCK_GPIO0_IN);
}

void tick(uint32_t) {
  registrarCambioDeEnlace();
  if (conIp) pedirHoraUnaVez();
}

int64_t epoch() { return static_cast<int64_t>(time(nullptr)); }

bool lista() { return conIp && tiempo::valida(epoch()); }

}  // namespace red
