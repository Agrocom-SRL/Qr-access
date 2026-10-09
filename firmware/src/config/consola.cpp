#include "consola.h"

#include "config.h"

namespace consola {

namespace {

using namespace aprovisionamiento;

char linea[MAX_LINEA + 1];
size_t largo = 0;
bool descartando = false;

void mostrarAyuda() {
  Serial.println("Comandos:");
  Serial.println("  estado                  que hay cargado (sin claves)");
  Serial.println("  set wifi_ssid <valor>   red WiFi");
  Serial.println("  set wifi_clave <valor>  clave WiFi (vacia = red abierta)");
  Serial.println("  set api_url <valor>     https://... de la API");
  Serial.println("  set disp_id <valor>     id del dispositivo");
  Serial.println("  set disp_clave <valor>  clave del dispositivo");
  Serial.println("  borrar                  borra lo aprovisionado");
  Serial.println("  reiniciar               aplica los cambios");
}

void mostrarEstado() {
  const config::Dispositivo d = config::cargar();
  Serial.printf("wifi_ssid : %s\n", d.wifiSsid.length() > 0 ? d.wifiSsid.c_str() : "(falta)");
  Serial.printf("wifi_clave: %s\n", d.wifiClave.length() > 0 ? "definida" : "(vacia)");
  Serial.printf("api_url   : %s\n", d.apiUrl.length() > 0 ? d.apiUrl.c_str() : "(falta)");
  Serial.printf("disp_id   : %s\n", d.id.length() > 0 ? d.id.c_str() : "(falta)");
  Serial.printf("disp_clave: %s\n", d.clave.length() > 0 ? "definida" : "(falta)");
  Serial.printf("completa  : %s\n", d.completa() ? "si" : "no");
}

void ejecutar(const char* texto) {
  Comando comando = interpretar(texto, config::MODO_DESARROLLO);
  switch (comando.tipo) {
    case Tipo::Vacio:
      break;
    case Tipo::Ayuda:
      mostrarAyuda();
      break;
    case Tipo::Estado:
      mostrarEstado();
      break;
    case Tipo::Fijar:
      if (config::guardar(comando.campo, comando.valor)) {
        Serial.printf("ok: %s guardado (reinicia para aplicar)\n", nombre(comando.campo));
      } else {
        Serial.println("error: no se pudo escribir en la NVS");
      }
      break;
    case Tipo::Borrar:
      config::borrar();
      Serial.println("ok: aprovisionamiento borrado (reinicia para volver al estado de fabrica)");
      break;
    case Tipo::Reiniciar:
      Serial.println("reiniciando...");
      Serial.flush();
      ESP.restart();
      break;
    case Tipo::Invalido:
      // El mensaje no repite el valor: puede ser una clave.
      Serial.println(comando.error == Error::ValorInvalido ? "error: valor invalido (ver 'ayuda')"
                     : comando.error == Error::CampoDesconocido
                         ? "error: campo desconocido (ver 'ayuda')"
                         : "error: comando desconocido (ver 'ayuda')");
      break;
  }
  memset(&comando, 0, sizeof(comando));  // el valor puede ser una clave
}

}  // namespace

void iniciar() { Serial.println("Aprovisionamiento por serie: escribe 'ayuda'."); }

void tick() {
  while (Serial.available() > 0) {
    const int c = Serial.read();
    if (c == '\r' || c == '\n') {
      if (descartando) {
        Serial.println("error: linea demasiado larga");
      } else if (largo > 0) {
        linea[largo] = '\0';
        ejecutar(linea);
      }
      memset(linea, 0, sizeof(linea));
      largo = 0;
      descartando = false;
      continue;
    }
    if (descartando) continue;
    if (largo >= MAX_LINEA) {
      descartando = true;
      memset(linea, 0, sizeof(linea));
      largo = 0;
      continue;
    }
    linea[largo++] = static_cast<char>(c);
  }
}

}  // namespace consola
