#include "red.h"

#include <WiFi.h>
#include <temporizador.h>
#include <tiempo.h>
#include <time.h>

#include "reloj/reloj.h"

namespace red {

namespace {

constexpr uint32_t BACKOFF_INICIAL_MS = 5000;  // un intento de conexión tarda unos segundos
constexpr uint32_t BACKOFF_MAXIMO_MS = 60000;

RelojMillis reloj;
temporizador::Backoff backoff(reloj, BACKOFF_INICIAL_MS, BACKOFF_MAXIMO_MS);
bool ntpPedido = false;

}  // namespace

void iniciar(const String& ssid, const String& clave) {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(false);  // la reconexión la maneja tick() con backoff
  WiFi.begin(ssid.c_str(), clave.c_str());
  backoff.fallo();  // el primer reintento llega después de BACKOFF_INICIAL_MS
}

void tick(uint32_t /*ahoraMs*/) {
  if (WiFi.status() == WL_CONNECTED) {
    backoff.exito();
    if (!ntpPedido) {
      configTime(0, 0, "pool.ntp.org", "time.google.com");
      ntpPedido = true;
    }
    return;
  }
  if (backoff.toca()) {
    WiFi.reconnect();
    backoff.fallo();
  }
}

int64_t epoch() { return static_cast<int64_t>(time(nullptr)); }

bool lista() { return WiFi.status() == WL_CONNECTED && tiempo::valida(epoch()); }

int rssi() { return WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0; }

}  // namespace red
