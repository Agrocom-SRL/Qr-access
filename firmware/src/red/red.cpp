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
volatile bool conEnlace = false;  // el cable está conectado y el PHY negoció el enlace
volatile bool conIp = false;      // además, el DHCP ya entregó una IP

/// Pasado este tiempo con cable pero sin IP, se avisa que el problema ya no es el cable.
constexpr uint32_t MS_SIN_IP_PARA_AVISAR = 15000;

void alEventoDeRed(arduino_event_id_t evento) {
  switch (evento) {
    case ARDUINO_EVENT_ETH_CONNECTED:
      conEnlace = true;
      break;
    case ARDUINO_EVENT_ETH_GOT_IP:
      conEnlace = true;
      conIp = true;
      break;
    case ARDUINO_EVENT_ETH_DISCONNECTED:
    case ARDUINO_EVENT_ETH_STOP:
      conEnlace = false;
      conIp = false;
      break;
    default:
      break;
  }
}

/// Deja en el serie cada cambio entre sin cable, cable sin IP y con IP: es lo primero que se mira
/// al integrar. Si el cable está pero la IP no llega, avisa una vez que el problema es el DHCP.
void registrarCambioDeEnlace(uint32_t ahoraMs) {
  static int anterior = -1;
  static uint32_t desdeMs = 0;
  static bool avisado = false;
  const int actual = conIp ? 2 : (conEnlace ? 1 : 0);
  if (actual != anterior) {
    anterior = actual;
    desdeMs = ahoraMs;
    avisado = false;
    if (actual == 2) {
      Serial.printf("[red] ethernet conectado, ip %s\n", ETH.localIP().toString().c_str());
    } else if (actual == 1) {
      Serial.println("[red] cable conectado: esperando la IP del DHCP");
    } else {
      Serial.println("[red] sin cable: conecta el cable de red");
    }
    return;
  }
  if (actual == 1 && !avisado && ahoraMs - desdeMs >= MS_SIN_IP_PARA_AVISAR) {
    avisado = true;
    Serial.println("[red] hay cable pero no llega IP: revisa el DHCP del router y la alimentación");
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

void tick(uint32_t ahoraMs) {
  registrarCambioDeEnlace(ahoraMs);
  if (conIp) pedirHoraUnaVez();
}

int64_t epoch() { return static_cast<int64_t>(time(nullptr)); }

bool lista() { return conIp && tiempo::valida(epoch()); }

}  // namespace red
