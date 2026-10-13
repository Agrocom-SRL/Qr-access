#include "red.h"

#include <WiFi.h>
#include <temporizador.h>
#include <tiempo.h>
#include <time.h>

#ifdef ACCESO_ETH01
#include <ETH.h>
#endif

#include "pines.h"
#include "reloj/reloj.h"

namespace red {

namespace {

constexpr uint32_t BACKOFF_INICIAL_MS = 5000;  // un intento de conexión tarda unos segundos
constexpr uint32_t BACKOFF_MAXIMO_MS = 60000;

RelojMillis reloj;
temporizador::Backoff backoff(reloj, BACKOFF_INICIAL_MS, BACKOFF_MAXIMO_MS);
bool ntpPedido = false;
bool hayWifi = false;  // hay credenciales de WiFi cargadas

#ifdef ACCESO_ETH01
// Ethernet de la placa ESP32-ETH01 (LAN8720 por RMII): el cable es la conexión
// principal de una puerta fija y el WiFi queda de respaldo.
constexpr uint32_t ESPERA_ETHERNET_MS = 15000;  // sin cable, tras esto se prueba el WiFi
volatile bool ethConIp = false;
bool wifiArrancado = false;
uint32_t inicioMs = 0;

void alEventoDeRed(arduino_event_id_t evento) {
  if (evento == ARDUINO_EVENT_ETH_GOT_IP) ethConIp = true;
  if (evento == ARDUINO_EVENT_ETH_DISCONNECTED || evento == ARDUINO_EVENT_ETH_STOP) {
    ethConIp = false;
  }
}

void arrancarWifi(const String& ssid, const String& clave) {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(false);  // la reconexión la maneja tick() con backoff
  WiFi.begin(ssid.c_str(), clave.c_str());
  wifiArrancado = true;
  backoff.fallo();
}

String ssidGuardado;
String claveGuardada;
#endif

bool ethernetLista() {
#ifdef ACCESO_ETH01
  return ethConIp;
#else
  return false;
#endif
}

bool wifiLista() { return WiFi.status() == WL_CONNECTED; }

/// Deja en el serie qué medio hay y con qué IP: es lo primero que se mira al integrar.
void registrarCambioDeMedio() {
  static int anterior = -1;
  const int actual = ethernetLista() ? 1 : wifiLista() ? 2 : 0;
  if (actual == anterior) return;
  anterior = actual;
  if (actual == 1) {
#ifdef ACCESO_ETH01
    Serial.printf("[red] ethernet conectado, ip %s\n", ETH.localIP().toString().c_str());
#endif
  } else if (actual == 2) {
    Serial.printf("[red] wifi conectado, ip %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("[red] sin enlace: esperando cable o wifi");
  }
}

void pedirHoraUnaVez() {
  if (ntpPedido) return;
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  ntpPedido = true;
}

}  // namespace

void iniciar(const String& ssid, const String& clave) {
  hayWifi = ssid.length() > 0;
#ifdef ACCESO_ETH01
  ssidGuardado = ssid;
  claveGuardada = clave;
  inicioMs = millis();
  WiFi.onEvent(alEventoDeRed);
  ETH.begin(ETH_PHY_ADDR_LAN8720, ETH_PIN_ENERGIA, ETH_PIN_MDC, ETH_PIN_MDIO, ETH_PHY_LAN8720,
            ETH_CLOCK_GPIO0_IN);
#else
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(false);
  WiFi.begin(ssid.c_str(), clave.c_str());
  backoff.fallo();  // el primer reintento llega después de BACKOFF_INICIAL_MS
#endif
}

void tick(uint32_t ahoraMs) {
  registrarCambioDeMedio();
#ifdef ACCESO_ETH01
  if (ethernetLista()) {
    // El cable manda: se apaga el WiFi para que no haya dos rutas a la API.
    if (wifiArrancado) {
      WiFi.disconnect(true);
      wifiArrancado = false;
    }
    backoff.exito();
    pedirHoraUnaVez();
    return;
  }
  if (!hayWifi) return;  // sin cable ni credenciales de WiFi, solo se espera el cable
  if (!wifiArrancado) {
    if (ahoraMs - inicioMs >= ESPERA_ETHERNET_MS) arrancarWifi(ssidGuardado, claveGuardada);
    return;
  }
#else
  (void)ahoraMs;
#endif
  if (wifiLista()) {
    backoff.exito();
    pedirHoraUnaVez();
    return;
  }
  if (backoff.toca()) {
    WiFi.reconnect();
    backoff.fallo();
  }
}

int64_t epoch() { return static_cast<int64_t>(time(nullptr)); }

bool lista() { return (ethernetLista() || wifiLista()) && tiempo::valida(epoch()); }

// Por cable no hay señal que medir: el latido manda 0.
int rssi() { return wifiLista() && !ethernetLista() ? WiFi.RSSI() : 0; }

String medio() {
  if (ethernetLista()) return "ethernet";
  return wifiLista() ? "wifi" : "sin red";
}

}  // namespace red
