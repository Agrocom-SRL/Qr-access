// Controlador de puerta de AGROCOM Acceso: lee, pregunta y obedece (ADR 0009).
// setup()/loop() solo arman los componentes y llaman a tick(); la decisión de
// abrir la toma puerta::Maquina, probada en la PC.
#include <Arduino.h>
#include <esp_task_wdt.h>
#include <puerta.h>

#include "api/cliente.h"
#include "cerradura/cerradura.h"
#include "config/config.h"
#include "indicadores/indicadores.h"
#include "lector_qr/lector_qr.h"
#include "red/red.h"

namespace {

constexpr uint32_t WATCHDOG_S = 8;

puerta::Maquina maquina;
bool configurado = false;
uint32_t validacionEnCurso = 0;
uint32_t siguienteValidacion = 1;
char linea[puerta::MAX_QR + 1];

void ejecutar(const puerta::Acciones& acciones, uint32_t ahoraMs);

void pedirValidacion(uint32_t ahoraMs) {
  validacionEnCurso = siguienteValidacion++;
  // Solo los primeros caracteres: el token completo nunca va a un log.
  Serial.printf("[puerta] validando %.8s...\n", maquina.qr());
  if (!configurado || !red::lista() || !api::validar(validacionEnCurso, maquina.qr())) {
    ejecutar(maquina.alResponder(puerta::Resultado{false, false, 0}, ahoraMs), ahoraMs);
  }
}

void ejecutar(const puerta::Acciones& acciones, uint32_t ahoraMs) {
  if (acciones.desactivarCerradura) cerradura::desactivar();
  if (acciones.activarCerradura) cerradura::activar(acciones.msApertura, ahoraMs);
  indicadores::mostrar(acciones.indicacion, ahoraMs);
  if (acciones.enviarValidacion) pedirValidacion(ahoraMs);
}

}  // namespace

void setup() {
  cerradura::iniciar();  // lo primero: la salida de la cerradura arranca inactiva
  indicadores::iniciar();
  Serial.begin(115200);

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
  lector_qr::iniciar();
}

void loop() {
  esp_task_wdt_reset();
  const uint32_t ahora = millis();

  if (configurado) red::tick(ahora);

  if (cerradura::pulsadorPresionado(ahora)) ejecutar(maquina.alPulsarSalida(ahora), ahora);

  if (lector_qr::leer(linea)) {
    ejecutar(maquina.alLeer(linea, ahora), ahora);
    memset(linea, 0, sizeof(linea));
  }

  api::Respuesta r;
  if (api::respuesta(r) && r.id == validacionEnCurso) {
    ejecutar(maquina.alResponder(r.resultado, ahora), ahora);
  }

  ejecutar(maquina.tick(ahora), ahora);
  cerradura::tick(ahora);
  indicadores::tick(ahora);
}
