// Controlador de puerta de AGROCOM Acceso: lee, pregunta y obedece (ADR 0009).
// setup()/loop() solo arman los componentes y llaman a tick(); la decisión de
// abrir la toma puerta::Maquina, probada en la PC. Nada de delay() en loop().
#include <Arduino.h>
#include <esp_task_wdt.h>
#include <puerta.h>
#include <temporizador.h>

#include "api/cliente.h"
#include "cerradura/cerradura.h"
#include "config/config.h"
#include "config/consola.h"
#include "indicadores/indicadores.h"
#include "lector_qr/lector_qr.h"
#include "red/red.h"
#include "reloj/reloj.h"
#include "version.h"

namespace {

constexpr uint32_t WATCHDOG_S = 8;
constexpr uint32_t PERIODO_LATIDO_MS = 60000;
constexpr uint32_t PERIODO_CONFIGURACION_MS = 300000;
constexpr uint32_t REINTENTO_CONFIGURACION_MS = 5000;

puerta::Maquina maquina;
RelojMillis reloj;
temporizador::Periodico latido(reloj, PERIODO_LATIDO_MS, true);
temporizador::Tarea configuracion(reloj, PERIODO_CONFIGURACION_MS, REINTENTO_CONFIGURACION_MS);
bool configurado = false;
char linea[puerta::MAX_QR + 1];

void ejecutar(const puerta::Acciones& acciones, uint32_t ahoraMs);

// Una consulta que ni siquiera puede salir (sin red, sin hora, sin cola) es un
// resultado inválido: no abre.
void pedirValidacion(uint32_t ahoraMs) {
  const uint32_t id = maquina.idValidacion();
  // Solo los primeros caracteres: el token completo nunca va a un log.
  Serial.printf("[puerta] validando %.8s...\n", maquina.qr());
  const bool salio = configurado && red::lista() && api::validar(id, maquina.qr(), red::epoch());
  if (!salio) {
    Serial.println("[puerta] sin red u hora valida: no se valida");
    ejecutar(maquina.alResponder(id, puerta::Resultado::invalido(puerta::Motivo::SinRed), ahoraMs),
             ahoraMs);
  }
}

void ejecutar(const puerta::Acciones& acciones, uint32_t ahoraMs) {
  if (acciones.desactivarCerradura) cerradura::desactivar();
  if (acciones.activarCerradura) cerradura::activar(acciones.msApertura, ahoraMs);
  indicadores::mostrar(acciones.indicacion, ahoraMs);
  if (acciones.enviarValidacion) pedirValidacion(ahoraMs);
}

void atenderRespuesta(const api::Respuesta& r, uint32_t ahoraMs) {
  switch (r.tipo) {
    case api::Tipo::Validacion:
      Serial.printf("[puerta] %s\n", puerta::mensaje(r.resultado.motivo));
      ejecutar(maquina.alResponder(r.id, r.resultado, ahoraMs), ahoraMs);
      break;
    case api::Tipo::Configuracion:
      if (r.config.valida) {
        maquina.fijarMaxAperturaS(r.config.segundosApertura);
        Serial.printf("[config] apertura maxima: %u s\n", maquina.maxAperturaS());
      } else {
        Serial.printf("[config] descarga fallida (http %d)\n", r.http);
      }
      configuracion.terminada(r.config.valida);
      break;
    case api::Tipo::Latido:
      if (r.http == 401) Serial.println("[latido] la API rechazo la credencial del dispositivo");
      else if (r.http != 204 && r.http != 200) Serial.printf("[latido] fallo (http %d)\n", r.http);
      break;
  }
}

// Latido y configuración solo con la puerta en reposo y red lista: no le quitan
// la tarea de red a una validación.
void segundoPlano() {
  if (!configurado || !red::lista() || maquina.estado() != puerta::Estado::Reposo) return;
  if (latido.vencio()) api::enviarLatido(red::rssi(), cerradura::puertaAbierta());
  if (configuracion.toca()) api::pedirConfiguracion();
}

}  // namespace

void setup() {
  cerradura::iniciar();  // lo primero: la salida de la cerradura arranca inactiva
  indicadores::iniciar();
  Serial.begin(115200);
  Serial.printf("AGROCOM Acceso, firmware %s\n", FIRMWARE_VERSION);
#ifdef ACCESO_DESARROLLO
  Serial.println("*** COMPILACION DE DESARROLLO (HTTP plano y secretos.h): NO PUBLICAR ***");
#endif

#if ESP_IDF_VERSION_MAJOR >= 5
  // Arduino 3 ya inicia el watchdog de tareas: se reconfigura con nuestro tiempo.
  const esp_task_wdt_config_t watchdog{WATCHDOG_S * 1000, 0, true};
  esp_task_wdt_reconfigure(&watchdog);
#else
  esp_task_wdt_init(WATCHDOG_S, true);
#endif
  esp_task_wdt_add(nullptr);

  const config::Dispositivo dispositivo = config::cargar();
  configurado = dispositivo.completa();
  if (configurado) {
    red::iniciar(dispositivo.wifiSsid, dispositivo.wifiClave);
    api::iniciar(dispositivo);
  } else {
    // Sin configuración no se valida nada (solo funciona el pulsador de salida).
    Serial.println("[config] sin configuracion: falta aprovisionar el dispositivo");
  }
  consola::iniciar();
  lector_qr::iniciar();
}

void loop() {
  esp_task_wdt_reset();
  const uint32_t ahora = millis();

  consola::tick();
  if (configurado) red::tick(ahora);

  if (cerradura::pulsadorPresionado(ahora)) ejecutar(maquina.alPulsarSalida(ahora), ahora);

  if (lector_qr::leer(linea)) {
    ejecutar(maquina.alLeer(linea, ahora), ahora);
    memset(linea, 0, sizeof(linea));
  }

  api::Respuesta respuesta;
  while (api::siguienteRespuesta(respuesta)) atenderRespuesta(respuesta, ahora);

  ejecutar(maquina.tick(ahora), ahora);
  segundoPlano();
  cerradura::tick(ahora);
  indicadores::tick(ahora);
}
