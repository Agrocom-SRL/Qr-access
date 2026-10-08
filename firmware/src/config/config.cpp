#include "config.h"

#include <Preferences.h>

#if __has_include("secretos.h")
#include "secretos.h"
#define HAY_SECRETOS_DE_DESARROLLO 1
#endif

namespace config {

Dispositivo cargar() {
  Dispositivo d;
  Preferences nvs;
  if (nvs.begin("acceso", true)) {
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

}  // namespace config
