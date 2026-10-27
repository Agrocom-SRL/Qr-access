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

// Presupuesto de una validación: 3 s (puerta::TIMEOUT_VALIDACION_MS). La máquina de estados la
// abandona a los 3 s; un pedido vencido ni se envía (atenderValidacion) y una respuesta tardía se
// descarta por su id.
constexpr uint16_t TIMEOUT_CONEXION_MS = 1500;
constexpr uint16_t TIMEOUT_LECTURA_MS = 1500;
// Vínculo (anuncio y confirmación): solo corre sin operar, nunca compite con una validación; el
// servidor verifica la clave con argon2id, así que se deja holgura.
constexpr uint16_t TIMEOUT_VINCULO_MS = 2000;
// Latido, informe y configuración (segundo plano) ocupan la única tarea de red mientras una
// validación podría llegar. Cada fase (conexión, handshake TLS, lectura) se acota a 1 s, bastante
// menos que el presupuesto de 3 s de la validación; perder uno es barato (el latido es periódico,
// el informe se reintenta y la configuración reintenta con backoff). Además, loop() no inicia
// ninguno con actividad reciente del lector.
constexpr uint16_t TIMEOUT_SEGUNDO_PLANO_MS = 1000;
constexpr size_t MAX_AUTORIZACION = 12 + 64 + 1 + 128 + 1;

struct PedidoValidacion {
  uint32_t id;
  int64_t leidoEn;
  uint32_t pedidoEnMs;  // millis() de validar(): desde ahí corre el presupuesto de la validación
  char qr[puerta::MAX_QR + 1];
};

struct TrabajoSegundoPlano {
  Tipo tipo;
  EstadoLatido latido;                // solo Latido
  confirmacion::Informe informe;      // solo Informe
  char clave[aprovisionamiento::MAX_VALOR + 1];  // solo Anuncio y Confirmacion
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
char autorizacion[MAX_AUTORIZACION];  // vacío = sin credencial
portMUX_TYPE candado = portMUX_INITIALIZER_UNLOCKED;  // loop() la cambia, la tarea la lee

// Una llamada HTTP(S) a la API. TLS siempre verificado con la CA embebida;
// solo la compilación de desarrollo admite http:// (y lo declara al arrancar).
Llamada llamar(bool post, const char* ruta, const String& json, uint16_t timeoutConexionMs,
               uint16_t timeoutLecturaMs, bool conCredencial = true, uint8_t handshakeS = 0) {
  const Llamada fallo{-1, String()};
  char credencial[MAX_AUTORIZACION];
  portENTER_CRITICAL(&candado);
  memcpy(credencial, autorizacion, sizeof(credencial));
  portEXIT_CRITICAL(&candado);
  // Sin credencial no se llama: una ruta de dispositivo sin encabezado solo daría 401.
  if (conCredencial && credencial[0] == '\0') return fallo;
  const String url = urlBase + ruta;

  WiFiClientSecure tls;
  WiFiClient plano;
  WiFiClient* cliente = &tls;
  if (url.startsWith("https://")) {
    tls.setCACert(CA_SERVIDOR);  // TLS verificado: nunca setInsecure()
    tls.setTimeout((timeoutLecturaMs + 999) / 1000);
    // 0 = el de la librería: la validación la acota la máquina de estados, no este tiempo.
    if (handshakeS > 0) tls.setHandshakeTimeout(handshakeS);
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

  if (conCredencial) http.addHeader("Authorization", credencial);
  memset(credencial, 0, sizeof(credencial));
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
  // Un pedido que ya no es el vigente, o que ya cumplió el presupuesto de la validación, la máquina
  // lo abandonó: no se envía. Enviarlo tarde haría que el servidor consuma el QR (un solo uso) y
  // la puerta no abriría. Es el caso de un pedido que esperó detrás de una llamada de segundo plano.
  if (pedido.id != idVigente || puerta::pedidoVencido(pedido.pedidoEnMs, millis())) return;

  char leidoEn[tiempo::CAPACIDAD_ISO];
  Respuesta r{Tipo::Validacion, pedido.id, -1, puerta::Resultado::invalido(puerta::Motivo::SinRed),
              respuesta::Configuracion{false, 0}, respuesta::Anuncio{}};
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
                                         llamada.cuerpo.length(), r.eventoId);
  }
  publicar(r);
}

void atenderSegundoPlano(const TrabajoSegundoPlano& trabajo) {
  Respuesta r{trabajo.tipo, 0, -1, puerta::Resultado::invalido(puerta::Motivo::RespuestaInvalida),
              respuesta::Configuracion{false, 0}, respuesta::Anuncio{}};
  if (trabajo.tipo == Tipo::Anuncio || trabajo.tipo == Tipo::Confirmacion) {
    const bool anuncio = trabajo.tipo == Tipo::Anuncio;
    JsonDocument cuerpo;
    cuerpo["mac"] = config::macDeLaPlaca();
    cuerpo["clave"] = trabajo.clave;
    if (anuncio) cuerpo["firmware"] = FIRMWARE_VERSION;
    String json;
    serializeJson(cuerpo, json);
    const Llamada llamada = llamar(true, anuncio ? "/api/v1/dispositivos/anunciar"
                                                 : "/api/v1/dispositivos/confirmar",
                                   json, TIMEOUT_VINCULO_MS, TIMEOUT_VINCULO_MS, false);
    r.http = llamada.http;
    r.anuncio = respuesta::interpretarAnuncio(llamada.http, llamada.cuerpo.c_str(),
                                              llamada.cuerpo.length());
    json = String();  // llevaba la clave
  } else if (trabajo.tipo == Tipo::Latido) {
    JsonDocument cuerpo;
    cuerpo["firmware"] = FIRMWARE_VERSION;
    cuerpo["rssi"] = 0;  // por cable no hay señal que medir; la API todavía exige el campo
    cuerpo["puerta_abierta"] = trabajo.latido.puertaAbierta;
    // Antes de leer la configuración no se sabe si hay sensor: el campo se omite (no se afirma
    // `sin_sensor` por no haber leído nada).
    if (trabajo.latido.sensorConocido) {
      cuerpo["sensor_puerta"] = confirmacion::texto(trabajo.latido.sensor);
    }
    // El lector es pasivo: sin señales desde el arranque no se afirma nada (el campo se omite).
    if (trabajo.latido.lector != diagnostico::EstadoLector::Desconocido) {
      cuerpo["lector_responde"] = trabajo.latido.lector == diagnostico::EstadoLector::Responde;
    }
    String json;
    serializeJson(cuerpo, json);
    r.http = llamar(true, "/api/v1/dispositivos/latidos", json, TIMEOUT_SEGUNDO_PLANO_MS,
                    TIMEOUT_SEGUNDO_PLANO_MS, true, 1)
                 .http;
  } else if (trabajo.tipo == Tipo::Informe) {
    // Cuerpo estricto del contrato: evento_id, resultado y, si falló, la causa.
    JsonDocument cuerpo;
    cuerpo["evento_id"] = trabajo.informe.eventoId;
    cuerpo["resultado"] = confirmacion::texto(trabajo.informe.resultado);
    if (trabajo.informe.resultado == confirmacion::Resultado::Fallida &&
        trabajo.informe.causa != confirmacion::Causa::Ninguna) {
      cuerpo["causa"] = confirmacion::texto(trabajo.informe.causa);
    }
    String json;
    serializeJson(cuerpo, json);
    r.http = llamar(true, "/api/v1/dispositivos/confirmaciones", json, TIMEOUT_SEGUNDO_PLANO_MS,
                    TIMEOUT_SEGUNDO_PLANO_MS, true, 1)
                 .http;
    memcpy(r.eventoId, trabajo.informe.eventoId, sizeof(r.eventoId));
  } else {
    const Llamada llamada = llamar(false, "/api/v1/dispositivos/configuracion", String(),
                                   TIMEOUT_SEGUNDO_PLANO_MS, TIMEOUT_SEGUNDO_PLANO_MS, true, 1);
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

void fijarCredencial(const String& id, const String& clave) {
  char nueva[MAX_AUTORIZACION];
  // Si el id o la clave no sirven para un encabezado, queda sin credencial (no abre ni late).
  if (!aprovisionamiento::armarAutorizacion(id.c_str(), clave.c_str(), nueva, sizeof(nueva))) {
    nueva[0] = '\0';
  }
  portENTER_CRITICAL(&candado);
  memcpy(autorizacion, nueva, sizeof(autorizacion));
  portEXIT_CRITICAL(&candado);
  memset(nueva, 0, sizeof(nueva));
}

void quitarCredencial() {
  portENTER_CRITICAL(&candado);
  memset(autorizacion, 0, sizeof(autorizacion));
  portEXIT_CRITICAL(&candado);
}

void iniciar(const config::Dispositivo& dispositivo) {
  urlBase = dispositivo.apiUrl;
  quitarCredencial();
  if (dispositivo.completa()) fijarCredencial(dispositivo.id, dispositivo.clave);
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
  pedido.pedidoEnMs = millis();
  strncpy(pedido.qr, qr, puerta::MAX_QR);
  idVigente = id;
  // Si no entra, la máquina lo trata como error y no abre.
  const bool ok = xQueueSend(validaciones, &pedido, 0) == pdTRUE;
  memset(pedido.qr, 0, sizeof(pedido.qr));
  return ok;
}

bool enviarLatido(const EstadoLatido& estado) {
  TrabajoSegundoPlano trabajo{};
  trabajo.tipo = Tipo::Latido;
  trabajo.latido = estado;
  return encolarSegundoPlano(trabajo);
}

bool enviarInforme(const confirmacion::Informe& informe) {
  TrabajoSegundoPlano trabajo{};
  trabajo.tipo = Tipo::Informe;
  trabajo.informe = informe;
  return encolarSegundoPlano(trabajo);
}

bool pedirConfiguracion() {
  TrabajoSegundoPlano trabajo{};
  trabajo.tipo = Tipo::Configuracion;
  return encolarSegundoPlano(trabajo);
}

bool encolarClave(Tipo tipo, const char* clave) {
  TrabajoSegundoPlano trabajo{};
  trabajo.tipo = tipo;
  strncpy(trabajo.clave, clave, sizeof(trabajo.clave) - 1);
  const bool ok = encolarSegundoPlano(trabajo);
  memset(trabajo.clave, 0, sizeof(trabajo.clave));
  return ok;
}

bool anunciar(const char* clave) { return encolarClave(Tipo::Anuncio, clave); }

bool confirmar(const char* clave) { return encolarClave(Tipo::Confirmacion, clave); }

bool siguienteRespuesta(Respuesta& r) {
  return respuestas != nullptr && xQueueReceive(respuestas, &r, 0) == pdTRUE;
}

}  // namespace api
