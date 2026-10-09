#include "cliente.h"

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <aprovisionamiento.h>
#include <tiempo.h>

#include "ca_servidor.h"
#include "version.h"

namespace api {

namespace {

// Timeout total de una validación: 3 s (la máquina de estados la abandona a los
// 3 s aunque esta tarea siga; una respuesta tardía se descarta por su id).
constexpr uint16_t TIMEOUT_CONEXION_MS = 1500;
constexpr uint16_t TIMEOUT_LECTURA_MS = 1500;
// Latido y configuración no urgen: nunca retienen la tarea más de ~2 s.
constexpr uint16_t TIMEOUT_SEGUNDO_PLANO_MS = 2000;
constexpr size_t MAX_AUTORIZACION = 12 + 64 + 1 + 128 + 1;

struct PedidoValidacion {
  uint32_t id;
  int64_t leidoEn;
  char qr[puerta::MAX_QR + 1];
};

struct TrabajoSegundoPlano {
  Tipo tipo;
  int rssi;
  bool puertaAbierta;
};

struct Llamada {
  int http;
  String cuerpo;
};

QueueHandle_t validaciones = nullptr;
QueueHandle_t segundoPlano = nullptr;
QueueHandle_t respuestas = nullptr;
volatile uint32_t idVigente = 0;

String urlBase;
char autorizacion[MAX_AUTORIZACION];

// Una llamada HTTP(S) a la API. TLS siempre verificado con la CA embebida;
// solo la compilación de desarrollo admite http:// (y lo declara al arrancar).
Llamada llamar(bool post, const char* ruta, const String& json, uint16_t timeoutConexionMs,
               uint16_t timeoutLecturaMs) {
  const Llamada fallo{-1, String()};
  const String url = urlBase + ruta;

  WiFiClientSecure tls;
  WiFiClient plano;
  WiFiClient* cliente = &tls;
  if (url.startsWith("https://")) {
    tls.setCACert(CA_SERVIDOR);  // TLS verificado: nunca setInsecure()
    tls.setTimeout(timeoutLecturaMs / 1000 + 1);
  } else {
#ifdef ACCESO_DESARROLLO
    cliente = &plano;
#else
    return fallo;  // producción: solo HTTPS
#endif
  }

  HTTPClient http;
  http.setConnectTimeout(timeoutConexionMs);
  http.setTimeout(timeoutLecturaMs);
  http.setReuse(false);
  if (!http.begin(*cliente, url)) return fallo;

  http.addHeader("Authorization", autorizacion);
  int estado;
  if (post) {
    http.addHeader("Content-Type", "application/json");
    estado = http.POST(json);
  } else {
    estado = http.GET();
  }

  Llamada llamada{estado, String()};
  const int tamano = http.getSize();
  if (estado == 200 && tamano <= static_cast<int>(respuesta::MAX_CUERPO)) {
    llamada.cuerpo = http.getString();
  }
  http.end();
  return llamada;
}

void publicar(const Respuesta& r) {
  // Sin lugar en la cola se pierde: una validación perdida vence y no abre.
  xQueueSend(respuestas, &r, 0);
}

void atenderValidacion(const PedidoValidacion& pedido) {
  // Un pedido que ya no es el vigente (la máquina lo abandonó) ni se envía.
  if (pedido.id != idVigente) return;

  char leidoEn[tiempo::CAPACIDAD_ISO];
  Respuesta r{Tipo::Validacion, pedido.id, -1, puerta::Resultado::invalido(puerta::Motivo::SinRed),
              respuesta::Configuracion{false, 0}};
  if (tiempo::formatearIso(pedido.leidoEn, leidoEn, sizeof(leidoEn))) {
    JsonDocument cuerpo;
    cuerpo["token"] = pedido.qr;
    cuerpo["leido_en"] = leidoEn;
    String json;
    serializeJson(cuerpo, json);

    const Llamada llamada = llamar(true, "/api/v1/dispositivos/validaciones", json,
                                   TIMEOUT_CONEXION_MS, TIMEOUT_LECTURA_MS);
    r.http = llamada.http;
    r.resultado = respuesta::interpretar(llamada.http, llamada.cuerpo.c_str(),
                                         llamada.cuerpo.length());
  }
  publicar(r);
}

void atenderSegundoPlano(const TrabajoSegundoPlano& trabajo) {
  Respuesta r{trabajo.tipo, 0, -1, puerta::Resultado::invalido(puerta::Motivo::RespuestaInvalida),
              respuesta::Configuracion{false, 0}};
  if (trabajo.tipo == Tipo::Latido) {
    JsonDocument cuerpo;
    cuerpo["firmware"] = FIRMWARE_VERSION;
    cuerpo["rssi"] = trabajo.rssi;
    cuerpo["puerta_abierta"] = trabajo.puertaAbierta;
    String json;
    serializeJson(cuerpo, json);
    r.http = llamar(true, "/api/v1/dispositivos/latidos", json, TIMEOUT_SEGUNDO_PLANO_MS,
                    TIMEOUT_SEGUNDO_PLANO_MS)
                 .http;
  } else {
    const Llamada llamada = llamar(false, "/api/v1/dispositivos/configuracion", String(),
                                   TIMEOUT_SEGUNDO_PLANO_MS, TIMEOUT_SEGUNDO_PLANO_MS);
    r.http = llamada.http;
    r.config = respuesta::interpretarConfiguracion(llamada.http, llamada.cuerpo.c_str(),
                                                   llamada.cuerpo.length());
  }
  publicar(r);
}

void tarea(void*) {
  PedidoValidacion validacion;
  TrabajoSegundoPlano trabajo;
  for (;;) {
    if (xQueueReceive(validaciones, &validacion, 0) == pdTRUE) {
      atenderValidacion(validacion);
      memset(validacion.qr, 0, sizeof(validacion.qr));
    } else if (xQueueReceive(segundoPlano, &trabajo, 0) == pdTRUE) {
      atenderSegundoPlano(trabajo);
    } else {
      vTaskDelay(pdMS_TO_TICKS(10));  // en su propia tarea: no bloquea loop()
    }
  }
}

bool encolarSegundoPlano(const TrabajoSegundoPlano& trabajo) {
  return segundoPlano != nullptr && xQueueSend(segundoPlano, &trabajo, 0) == pdTRUE;
}

}  // namespace

void iniciar(const config::Dispositivo& dispositivo) {
  urlBase = dispositivo.apiUrl;
  // `completa()` ya validó id y clave; si el encabezado no se puede armar, la tarea no arranca.
  if (!aprovisionamiento::armarAutorizacion(dispositivo.id.c_str(), dispositivo.clave.c_str(),
                                            autorizacion, sizeof(autorizacion))) {
    Serial.println("[api] credencial invalida: el cliente no arranca");
    return;
  }
  validaciones = xQueueCreate(1, sizeof(PedidoValidacion));
  segundoPlano = xQueueCreate(2, sizeof(TrabajoSegundoPlano));
  respuestas = xQueueCreate(4, sizeof(Respuesta));
  xTaskCreatePinnedToCore(tarea, "api", 10240, nullptr, 1, nullptr, 0);
}

bool validar(uint32_t id, const char* qr, int64_t leidoEn) {
  if (validaciones == nullptr) return false;
  PedidoValidacion pedido{};
  pedido.id = id;
  pedido.leidoEn = leidoEn;
  strncpy(pedido.qr, qr, puerta::MAX_QR);
  idVigente = id;
  // Si no entra, la máquina lo trata como error y no abre.
  const bool ok = xQueueSend(validaciones, &pedido, 0) == pdTRUE;
  memset(pedido.qr, 0, sizeof(pedido.qr));
  return ok;
}

bool enviarLatido(int rssi, bool puertaAbierta) {
  return encolarSegundoPlano(TrabajoSegundoPlano{Tipo::Latido, rssi, puertaAbierta});
}

bool pedirConfiguracion() {
  return encolarSegundoPlano(TrabajoSegundoPlano{Tipo::Configuracion, 0, false});
}

bool siguienteRespuesta(Respuesta& r) {
  return respuestas != nullptr && xQueueReceive(respuestas, &r, 0) == pdTRUE;
}

}  // namespace api
