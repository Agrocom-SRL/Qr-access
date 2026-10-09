#include "red.h"

#include <WiFi.h>
#include <time.h>

namespace red {

namespace {
constexpr uint32_t BACKOFF_INICIAL_MS = 1000;
constexpr uint32_t BACKOFF_MAXIMO_MS = 60000;
constexpr time_t HORA_MINIMA_VALIDA = 1700000000;  // 2023-11: el reloj ya se sincronizó

uint32_t ultimoIntentoMs = 0;
uint32_t backoffMs = BACKOFF_INICIAL_MS;
bool ntpPedido = false;
}  // namespace

void iniciar(const String& ssid, const String& clave) {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(false);  // la reconexión la maneja tick() con backoff
  WiFi.begin(ssid.c_str(), clave.c_str());
  ultimoIntentoMs = millis();
}

void tick(uint32_t ahoraMs) {
  if (WiFi.status() == WL_CONNECTED) {
    backoffMs = BACKOFF_INICIAL_MS;
    if (!ntpPedido) {
      configTime(0, 0, "pool.ntp.org", "time.google.com");
      ntpPedido = true;
    }
    return;
  }
  if (ahoraMs - ultimoIntentoMs >= backoffMs) {
    WiFi.reconnect();
    ultimoIntentoMs = ahoraMs;
    backoffMs = backoffMs * 2 > BACKOFF_MAXIMO_MS ? BACKOFF_MAXIMO_MS : backoffMs * 2;
  }
}

bool lista() { return WiFi.status() == WL_CONNECTED && time(nullptr) > HORA_MINIMA_VALIDA; }

}  // namespace red
