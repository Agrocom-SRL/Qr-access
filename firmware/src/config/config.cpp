#include "config.h"

#include <Preferences.h>
#include <esp_mac.h>
#include <esp_random.h>

// Secretos de desarrollo (URL, id y clave; ya no hay WiFi): solo se incluyen en esp32-dev. El binario de producción
// no los lee aunque el archivo exista en el disco de quien compila.
#if defined(ACCESO_DESARROLLO) && __has_include("secretos.h")
#include "secretos.h"
#define HAY_SECRETOS_DE_DESARROLLO 1
#endif

namespace config {

namespace {

constexpr const char* ESPACIO = "acceso";

const char* llave(aprovisionamiento::Campo campo) {
  using aprovisionamiento::Campo;
  switch (campo) {
    case Campo::ApiUrl: return "api_url";
    case Campo::DispositivoId: return "disp_id";
    case Campo::DispositivoClave: return "disp_clave";
  }
  return "";
}

}  // namespace

Dispositivo cargar() {
  Dispositivo d;
  Preferences nvs;
  if (nvs.begin(ESPACIO, true)) {
    d.apiUrl = nvs.getString("api_url", "");
    d.id = nvs.getString("disp_id", "");
    d.clave = nvs.getString("disp_clave", "");
    nvs.end();
  }
#ifdef HAY_SECRETOS_DE_DESARROLLO
  // Solo desarrollo: la URL de la mesa de trabajo, y una credencial fija únicamente si secretos.h
  // trae una (el flujo normal es anunciarse y vincularse desde el panel, ADR 0026).
  if (d.apiUrl.length() == 0) d.apiUrl = API_URL;
  if (!d.completa() && DISPOSITIVO_ID[0] != '\0') {
    d.id = DISPOSITIVO_ID;
    d.clave = DISPOSITIVO_CLAVE;
  }
#endif
#ifdef URL_API_POR_DEFECTO
  // La URL de producción va en el binario: una placa nueva no necesita que le carguen nada.
  if (d.apiUrl.length() == 0) d.apiUrl = URL_API_POR_DEFECTO;
#endif
  return d;
}

bool guardar(aprovisionamiento::Campo campo, const char* valor) {
  Preferences nvs;
  if (!nvs.begin(ESPACIO, false)) return false;
  const bool ok = nvs.putString(llave(campo), valor) > 0 || valor[0] == '\0';
  nvs.end();
  return ok;
}

bool sortearClave(Dispositivo& dispositivo) {
  constexpr size_t BYTES = 32;
  unsigned char bytes[BYTES];
  esp_fill_random(bytes, sizeof(bytes));
  char clave[BYTES * 2 + 1];
  const bool armada = aprovisionamiento::claveDesdeBytes(bytes, sizeof(bytes), clave, sizeof(clave));
  memset(bytes, 0, sizeof(bytes));
  const bool guardada = armada && guardar(aprovisionamiento::Campo::DispositivoClave, clave);
  if (guardada) dispositivo.clave = clave;
  memset(clave, 0, sizeof(clave));
  return guardada;
}

void olvidarId() {
  Preferences nvs;
  if (nvs.begin(ESPACIO, false)) {
    nvs.remove("disp_id");
    nvs.end();
  }
}

String macDeLaPlaca() {
  uint8_t mac[6] = {0};
  esp_read_mac(mac, ESP_MAC_ETH);
  char texto[18];
  snprintf(texto, sizeof(texto), "%02X:%02X:%02X:%02X:%02X:%02X", mac[0], mac[1], mac[2], mac[3],
           mac[4], mac[5]);
  return String(texto);
}

void borrar() {
  Preferences nvs;
  if (nvs.begin(ESPACIO, false)) {
    nvs.clear();
    nvs.end();
  }
}

}  // namespace config
