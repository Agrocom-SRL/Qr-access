#include "config.h"

#include <Preferences.h>

// Secretos de desarrollo: solo se incluyen en esp32-dev. El binario de producción
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
    case Campo::WifiSsid: return "wifi_ssid";
    case Campo::WifiClave: return "wifi_clave";
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
    d.wifiSsid = nvs.getString("wifi_ssid", "");
    d.wifiClave = nvs.getString("wifi_clave", "");
    d.apiUrl = nvs.getString("api_url", "");
    d.id = nvs.getString("disp_id", "");
    d.clave = nvs.getString("disp_clave", "");
    nvs.end();
  }
#ifdef HAY_SECRETOS_DE_DESARROLLO
  if (!d.completa()) {
    d.wifiSsid = WIFI_SSID;
    d.wifiClave = WIFI_CLAVE;
    d.apiUrl = API_URL;
    d.id = DISPOSITIVO_ID;
    d.clave = DISPOSITIVO_CLAVE;
  }
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

void borrar() {
  Preferences nvs;
  if (nvs.begin(ESPACIO, false)) {
    nvs.clear();
    nvs.end();
  }
}

}  // namespace config
