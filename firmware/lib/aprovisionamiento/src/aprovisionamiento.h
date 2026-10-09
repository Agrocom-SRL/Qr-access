// Aprovisionamiento por serie (ADR 0009): interpreta y valida las líneas de
// comando con las que se cargan WiFi, URL de la API y credencial del
// dispositivo. Lógica PURA: la escritura en NVS la hace src/config.
//
//   ayuda                       lista los comandos
//   estado                      muestra qué hay cargado (nunca las claves)
//   set <campo> <valor>         guarda un campo
//   borrar                      borra lo aprovisionado (solo NVS del dispositivo)
//   reiniciar                   reinicia para aplicar los cambios
//
// Campos: wifi_ssid, wifi_clave, api_url, disp_id, disp_clave.
#pragma once

#include <stddef.h>

namespace aprovisionamiento {

constexpr size_t MAX_LINEA = 256;
constexpr size_t MAX_VALOR = 128;

enum class Campo { WifiSsid, WifiClave, ApiUrl, DispositivoId, DispositivoClave };
enum class Tipo { Vacio, Ayuda, Estado, Fijar, Borrar, Reiniciar, Invalido };
enum class Error { Ninguno, ComandoDesconocido, CampoDesconocido, ValorInvalido };

struct Comando {
  Tipo tipo = Tipo::Vacio;
  Error error = Error::Ninguno;
  Campo campo = Campo::WifiSsid;
  char valor[MAX_VALOR + 1] = {0};  // validado; para ApiUrl, sin "/" final
};

// `permitirHttp`: solo compilaciones de desarrollo aceptan una URL http://.
Comando interpretar(const char* linea, bool permitirHttp);

// Nombre del campo tal como se escribe en el comando (para mensajes).
const char* nombre(Campo campo);

// Lo mismo que se exige al guardar, para validar lo que ya está en NVS.
bool urlValida(const char* url, bool permitirHttp);
bool idValido(const char* id);
bool claveValida(const char* clave);

// "Dispositivo <id>.<clave>" en `salida`. false si id o clave no son válidos
// (no se puede inyectar nada en el encabezado) o no caben.
bool armarAutorizacion(const char* id, const char* clave, char* salida, size_t capacidad);

}  // namespace aprovisionamiento
