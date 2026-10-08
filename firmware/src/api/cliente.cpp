#include "cliente.h"

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <respuesta.h>

#include "ca_servidor.h"

namespace api {

namespace {

constexpr uint16_t TIMEOUT_CONEXION_MS = 2000;
constexpr uint16_t TIMEOUT_LECTURA_MS = 2500;  // por debajo del timeout de la máquina (3 s)

struct Pedido {
  uint32_t id;
  char qr[puerta::MAX_QR + 1];
};

QueueHandle_t pedidos = nullptr;
QueueHandle_t respuestas = nullptr;
String urlValidacion;
String autorizacion;

puerta::Resultado consultar(const char* qr) {
  WiFiClientSecure tls;
  tls.setCACert(CA_SERVIDOR);  // TLS verificado: nunca setInsecure()
  tls.setTimeout(TIMEOUT_LECTURA_MS / 1000 + 1);

  HTTPClient http;
  http.setConnectTimeout(TIMEOUT_CONEXION_MS);
  http.setTimeout(TIMEOUT_LECTURA_MS);
  http.setReuse(false);
  if (!http.begin(tls, urlValidacion)) return puerta::Resultado{false, false, 0};

  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", autorizacion);

  JsonDocument cuerpo;
  cuerpo["qr"] = qr;
  String json;
  serializeJson(cuerpo, json);

  const int estado = http.POST(json);
  String recibido;
  if (estado == 200 && http.getSize() <= static_cast<int>(respuesta::MAX_CUERPO)) {
    recibido = http.getString();
  }
  http.end();
  return respuesta::interpretar(estado, recibido.c_str(), recibido.length());
}

void tarea(void*) {
  Pedido pedido;
  for (;;) {
    if (xQueueReceive(pedidos, &pedido, portMAX_DELAY) != pdTRUE) continue;
    const Respuesta r{pedido.id, consultar(pedido.qr)};
    memset(pedido.qr, 0, sizeof(pedido.qr));
    xQueueOverwrite(respuestas, &r);
  }
}

}  // namespace

void iniciar(const config::Dispositivo& dispositivo) {
  urlValidacion = dispositivo.apiUrl + "/api/v1/dispositivos/validaciones";
  autorizacion = "Dispositivo " + dispositivo.id + "." + dispositivo.clave;
  pedidos = xQueueCreate(1, sizeof(Pedido));
  respuestas = xQueueCreate(1, sizeof(Respuesta));
  xTaskCreatePinnedToCore(tarea, "api", 8192, nullptr, 1, nullptr, 0);
}

bool validar(uint32_t id, const char* qr) {
  if (pedidos == nullptr) return false;
  Pedido pedido{};
  pedido.id = id;
  strncpy(pedido.qr, qr, puerta::MAX_QR);
  // Si la tarea sigue ocupada con un pedido anterior, este no entra: la
  // máquina lo trata como error y no abre.
  return xQueueSend(pedidos, &pedido, 0) == pdTRUE;
}

bool respuesta(Respuesta& r) {
  return respuestas != nullptr && xQueueReceive(respuestas, &r, 0) == pdTRUE;
}

}  // namespace api
