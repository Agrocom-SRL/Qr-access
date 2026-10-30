// Controlador de puerta de AGROCOM Acceso: lee, pregunta y obedece (ADR 0009).
// setup()/loop() solo arman los componentes y llaman a tick(); la decisión de
// abrir la toma puerta::Maquina, probada en la PC. Nada de delay() en loop().
#include <Arduino.h>
#include <confirmacion.h>
#include <entrega.h>
#include <esp_task_wdt.h>
#include <ordenes.h>
#include <puerta.h>
#include <pulsacion.h>
#include <temporizador.h>
#include <vinculo.h>

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
// Cada minuto: el interruptor de la apertura manual (`apertura_manual`) le llega a la placa en ese tiempo
// (ADR 0035 §5). La API además rechaza las órdenes con el modo apagado, así que no depende de esto.
constexpr uint32_t PERIODO_CONFIGURACION_MS = 60000;
constexpr uint32_t REINTENTO_CONFIGURACION_MS = 5000;
// Sin vínculo la placa se anuncia cada 30 s (ADR 0026); el servidor limita los intentos fallidos.
// Mientras espera que pulsen su botón lo hace cada 5 s, para enterarse pronto de que se canceló
// o venció la ventana.
constexpr uint32_t PERIODO_ANUNCIO_MS = 30000;
constexpr uint32_t PERIODO_ANUNCIO_CONFIRMANDO_MS = 5000;

puerta::Maquina maquina;
RelojMillis reloj;
temporizador::Periodico latido(reloj, PERIODO_LATIDO_MS, true);
temporizador::Tarea configuracion(reloj, PERIODO_CONFIGURACION_MS, REINTENTO_CONFIGURACION_MS);
temporizador::Periodico anuncio(reloj, PERIODO_ANUNCIO_MS, true);
temporizador::Periodico anuncioConfirmando(reloj, PERIODO_ANUNCIO_CONFIRMANDO_MS, true);
pulsacion::Larga pulsacionLarga;
config::Dispositivo dispositivo;
vinculo::Vinculo estadoVinculo(false);  // se rearma en setup() con lo que haya en la NVS
char linea[puerta::MAX_QR + 1];

// Confirmación de la apertura (ADR 0031 §18): solo lee el sensor y reporta, nunca decide.
// Hasta leer la primera configuración válida el sensor figura NO instalado, pero eso es solo un
// valor por omisión, no un dato: mientras `configuracionLeida` sea false no se observa ninguna
// apertura ni se informa el estado del sensor (no se afirma `sin_sensor` sin saberlo).
confirmacion::Sensor sensor;
bool configuracionLeida = false;
// Interruptor de la apertura manual de la puerta (ADR 0035), tal como lo dictó la última configuración.
// Apagado hasta saberlo: sin configuración la placa no pregunta por órdenes.
bool aperturaManual = false;
// Plazo por omisión: segundos REALES de apertura (el tope vigente) + 5 s, igual que el servidor.
// Lo reemplaza la configuración.
constexpr uint16_t MARGEN_CONFIRMACION_S = 5;
uint16_t esperaConfirmacionS = puerta::APERTURA_POR_DEFECTO_S + MARGEN_CONFIRMACION_S;
confirmacion::Observador observador;
confirmacion::Entregas entregas;

bool ejecutar(const puerta::Acciones& acciones, uint32_t ahoraMs);

confirmacion::Lectura leerSensor() {
  return confirmacion::interpretar(sensor, cerradura::sensorEnNivelAlto());
}

// Pasa los informes ya resueltos a la cola de entrega en segundo plano. No envía nada acá.
void recogerInformes(uint32_t ahoraMs) {
  confirmacion::Informe informe;
  while (observador.siguiente(informe)) {
    // El plazo de reintentos se cuenta desde que se conoce el desenlace (ver entrega.h).
    entregas.agregar(informe, ahoraMs);
#ifdef ACCESO_DESARROLLO
    Serial.printf("[confirmacion] evento %s: %s\n", informe.eventoId, confirmacion::texto(informe.resultado));
#else
    // El id completo identifica un acceso: en producción solo su cola.
    Serial.printf("[confirmacion] evento ...%s: %s\n",
                  informe.eventoId + (strlen(informe.eventoId) > 4 ? strlen(informe.eventoId) - 4 : 0),
                  confirmacion::texto(informe.resultado));
#endif
  }
}

// El servidor ordenó abrir y se actuó sobre el relé: empieza a observar si la puerta se abre.
// Corre DESPUÉS de accionar el relé y no espera nada.
void iniciarObservacion(const char* eventoId, bool releAccionado, uint32_t ahoraMs, bool manual = false) {
  if (releAccionado) {
    // Sin configuración no se sabe si hay sensor: no se observa (el servidor lo toma como
    // «sin respuesta»), en vez de informar `sin_sensor` por un valor por omisión.
    if (!configuracionLeida) return;
    observador.iniciar(eventoId, ahoraMs, static_cast<uint32_t>(esperaConfirmacionS) * 1000U, sensor,
                       leerSensor(), manual);
  } else {
    observador.releNoAccionado(eventoId, manual);
  }
  recogerInformes(ahoraMs);
}

// Una consulta que ni siquiera puede salir (sin red, sin hora, sin cola) es un
// resultado inválido: no abre.
void pedirValidacion(uint32_t ahoraMs) {
  const uint32_t id = maquina.idValidacion();
  // Solo los primeros caracteres: el token completo nunca va a un log.
  Serial.printf("[puerta] validando %.8s...\n", maquina.qr());
  const bool salio = estadoVinculo.opera() && red::lista() && api::validar(id, maquina.qr(), red::epoch());
  if (!salio) {
    Serial.println("[puerta] sin red u hora valida: no se valida");
    ejecutar(maquina.alResponder(id, puerta::Resultado::invalido(puerta::Motivo::SinRed), ahoraMs),
             ahoraMs);
  }
}

// true si el relé quedó accionado en esta llamada.
bool ejecutar(const puerta::Acciones& acciones, uint32_t ahoraMs) {
  if (acciones.desactivarCerradura) cerradura::desactivar();
  const bool accionado = acciones.activarCerradura && cerradura::activar(acciones.msApertura, ahoraMs);
  indicadores::mostrar(acciones.indicacion, ahoraMs);
  if (acciones.enviarValidacion) pedirValidacion(ahoraMs);
  return accionado;
}

// El servidor contestó el anuncio o la confirmación: la placa aprende si ya tiene vínculo
// (ADR 0026) y, si espera su botón, se lo indica a quien está en la puerta.
void atenderAnuncio(const respuesta::Anuncio& r, uint32_t ahoraMs) {
  const bool mismoId = r.estado == respuesta::Anuncio::Estado::Vinculado &&
                       dispositivo.id.equals(r.dispositivoId);
  switch (estadoVinculo.alAnunciar(r, mismoId)) {
    case vinculo::Efecto::GuardarId:
      if (!config::guardar(aprovisionamiento::Campo::DispositivoId, r.dispositivoId)) {
        Serial.println("[vinculo] no se pudo guardar el id: se repite al reiniciar");
      }
      dispositivo.id = r.dispositivoId;
      api::fijarCredencial(dispositivo.id, dispositivo.clave);
      Serial.printf("[vinculo] vinculada al dispositivo %s\n", r.dispositivoId);
      indicadores::mostrar(puerta::Indicacion::Permitido, ahoraMs);  // verde: quedó vinculada
      break;
    case vinculo::Efecto::OlvidarVinculo:
      // La liberaron: se borra el id y se sortea una clave nueva para la próxima cuenta.
      api::quitarCredencial();
      config::olvidarId();
      dispositivo.id = "";
      config::sortearClave(dispositivo);
      Serial.println("[vinculo] liberada: vuelve a anunciarse");
      break;
    case vinculo::Efecto::Nada:
      if (estadoVinculo.opera()) Serial.println("[vinculo] credencial retomada");
      break;
  }
  if (estadoVinculo.esperaConfirmacion()) {
    // Azul parpadeando y un beep cada 2 s; cada anuncio lo renueva mientras siga pidiéndolo.
    indicadores::mostrar(puerta::Indicacion::Confirmar, ahoraMs);
    Serial.println("[vinculo] AGROCOM pidio vincularla: mantén pulsado el boton 5 s para confirmar");
  }
}

// Una orden de apertura manual de la app (ADR 0035). Abre solo si sigue vigente (su plazo es relativo y
// corre desde que llegó la respuesta) y con el relé libre; si no, se descarta SIN abrir y sin informar:
// el servidor la da por vencida. Esto es lo único que abre por esta vía: ni un error, ni un 204, ni una
// respuesta mal formada llegan hasta aquí (invariante 2).
void atenderOrden(const api::Respuesta& r, uint32_t ahoraMs) {
  // También con el 401 de la credencial: la tarea ya publicó y aquí solo se reanuda.
  if (r.orden.estado == respuesta::Orden::Estado::Recibida) {
    if (!ordenes::puedeEjecutar(estadoVinculo.opera(), aperturaManual)) {
      Serial.println("[orden] la placa ya no opera o la apertura manual se apago: no se abre");
    } else if (!ordenes::vigente(r.recibidaEnMs, r.orden.validaPorMs, ahoraMs)) {
      Serial.println("[orden] vencida antes de ejecutarse: no se abre");
    } else {
      const puerta::Acciones acciones = maquina.alRecibirOrdenManual(r.orden.segundos, ahoraMs);
      const bool accionado = ejecutar(acciones, ahoraMs);
      if (acciones.activarCerradura) {
        Serial.printf("[orden] apertura manual: %u s\n", r.orden.segundos);
        iniciarObservacion(r.orden.id, accionado, ahoraMs, true);
      } else {
        Serial.println("[orden] la puerta esta ocupada: no se abre");
      }
    }
  }
  api::reanudarOrdenes();
}

void atenderRespuesta(const api::Respuesta& r, uint32_t ahoraMs) {
  // La API rechazó la credencial (cuenta suspendida, dispositivo liberado): no se valida más
  // hasta que el servidor confirme el vínculo (falla segura).
  if (r.tipo != api::Tipo::Anuncio && r.tipo != api::Tipo::Confirmacion && r.http == 401 &&
      estadoVinculo.opera()) {
    estadoVinculo.alRechazarCredencial();
    Serial.println("[vinculo] la API rechazo la credencial: se pregunta al servidor");
  }
  switch (r.tipo) {
    case api::Tipo::Validacion:
      Serial.printf("[puerta] %s\n", puerta::mensaje(r.resultado.motivo));
      {
        const puerta::Acciones acciones = maquina.alResponder(r.id, r.resultado, ahoraMs);
        const bool accionado = ejecutar(acciones, ahoraMs);
        // Solo una apertura ordenada por el servidor se informa; el pulsador de salida, no.
        if (acciones.activarCerradura) iniciarObservacion(r.eventoId, accionado, ahoraMs);
      }
      break;
    case api::Tipo::Configuracion:
      if (r.config.valida) {
        maquina.fijarMaxAperturaS(r.config.segundosApertura);
        // Sensor y plazo: lo que dicta el servidor (la polaridad real está pendiente de confirmar).
        sensor = r.config.sensor;
        configuracionLeida = true;
        aperturaManual = r.config.aperturaManual;
        esperaConfirmacionS = r.config.esperaConfirmacionS != 0
                                  ? r.config.esperaConfirmacionS
                                  : maquina.maxAperturaS() + MARGEN_CONFIRMACION_S;
        Serial.printf("[config] apertura maxima: %u s, sensor %s, espera %u s, apertura manual %s\n",
                      maquina.maxAperturaS(), sensor.instalado ? "instalado" : "no instalado",
                      esperaConfirmacionS, aperturaManual ? "si" : "no");
      } else {
        Serial.printf("[config] descarga fallida (http %d)\n", r.http);
      }
      configuracion.terminada(r.config.valida);
      break;
    case api::Tipo::Latido:
      if (r.http != 204 && r.http != 200 && r.http != 401) {
        Serial.printf("[latido] fallo (http %d)\n", r.http);
      }
      break;
    case api::Tipo::Informe:
      // 204 = registrado; reintentar solo ante falta de red, 429 o 5xx (lo decide `entregas`).
      entregas.alResponder(r.eventoId, r.http, ahoraMs, r.manual);
      if (!confirmacion::reintentable(r.http) && !confirmacion::entregado(r.http)) {
        Serial.printf("[confirmacion] informe descartado (http %d)\n", r.http);
      }
      break;
    case api::Tipo::Orden:
      atenderOrden(r, ahoraMs);
      break;
    case api::Tipo::Anuncio:
      atenderAnuncio(r.anuncio, ahoraMs);
      break;
    case api::Tipo::Confirmacion:
      // La confirmación que no termina en `vinculado` (ventana vencida, plan sin cupo...) se avisa.
      if (r.anuncio.estado != respuesta::Anuncio::Estado::Vinculado) {
        Serial.printf("[vinculo] no se pudo confirmar (http %d): AGROCOM debe volver a vincularla\n",
                      r.http);
        indicadores::mostrar(puerta::Indicacion::Error, ahoraMs);
      }
      atenderAnuncio(r.anuncio, ahoraMs);
      break;
  }
}

// Latido, configuración y anuncio solo con la puerta en reposo y red lista: no le quitan
// la tarea de red a una validación.
void segundoPlano(uint32_t ahoraMs) {
  if (!red::lista() || maquina.estado() != puerta::Estado::Reposo) return;
  if (estadoVinculo.debeAnunciar()) {
    temporizador::Periodico& temporizadorDeAnuncio =
        estadoVinculo.esperaConfirmacion() ? anuncioConfirmando : anuncio;
    if (dispositivo.anunciable() && temporizadorDeAnuncio.vencio()) api::anunciar(dispositivo.clave.c_str());
    return;
  }
  // El informe de la apertura va aquí: con la puerta en reposo (el lector ya se atendió) y detrás de
  // cualquier validación en la tarea de red; nunca retrasa ni mantiene el relé.
  // Con el lector activo hace instantes alguien está en la puerta: ningún envío de segundo plano
  // empieza ahora, para que su validación no espere detrás de una llamada de red en vuelo (los
  // temporizadores siguen vencidos y el envío sale cuando haya quietud).
  if (lector_qr::huboActividadReciente(ahoraMs, diagnostico::QUIETUD_SEGUNDO_PLANO_MS)) return;
  if (const confirmacion::Informe* informe = entregas.debeEnviar(ahoraMs)) {
    // Se marca el intento aunque no entre en la cola: sin esto se repetiría en cada vuelta de loop().
    api::enviarInforme(*informe);
    entregas.enviado(informe->eventoId, ahoraMs, informe->manual);
  }
  if (latido.vencio()) {
    const confirmacion::Lectura lectura = leerSensor();
    // Sin sensor habilitado el pin está al aire: no se afirma nada sobre la puerta.
    api::enviarLatido({lectura == confirmacion::Lectura::Abierta, configuracionLeida, lectura,
                       lector_qr::estado(ahoraMs)});
  }
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

  dispositivo = config::cargar();
  // Sin clave (primer arranque, o recién liberada), la placa sortea la suya: la clave nunca viaja
  // del servidor a la placa (ADR 0026 §2).
  if (!aprovisionamiento::claveValida(dispositivo.clave.c_str())) {
    config::sortearClave(dispositivo);
  }
  estadoVinculo = vinculo::Vinculo(dispositivo.completa());
  Serial.printf("[placa] mac %s\n", config::macDeLaPlaca().c_str());
  if (aprovisionamiento::urlValida(dispositivo.apiUrl.c_str(), config::MODO_DESARROLLO)) {
    red::iniciar();
    api::iniciar(dispositivo);
    if (!estadoVinculo.opera()) {
      Serial.println(dispositivo.anunciable()
                         ? "[vinculo] sin vincular: se anuncia sola y espera a que AGROCOM la asigne"
                         : "[config] falta la clave propia: reinicia para sortearla");
    }
  } else {
    // Sin configuración no se valida nada (solo funciona el pulsador de salida).
    Serial.println("[config] sin configuracion: falta aprovisionar la placa (set api_url ...)");
  }
  consola::iniciar();
  lector_qr::iniciar();
}

void loop() {
  esp_task_wdt_reset();
  const uint32_t ahora = millis();

  consola::tick();
  if (estadoVinculo.opera() || dispositivo.anunciable()) red::tick(ahora);

  if (cerradura::pulsadorPresionado(ahora)) ejecutar(maquina.alPulsarSalida(ahora), ahora);
  // Con la ventana de confirmación abierta, mantener el botón 5 s es la prueba de presencia física
  // (ADR 0026 §4). Fuera de esa ventana el botón solo abre, como siempre (invariante 2).
  if (pulsacionLarga.actualizar(estadoVinculo.esperaConfirmacion(), cerradura::pulsadorAbajo(),
                                ahora)) {
    Serial.println("[vinculo] boton mantenido: se confirma la vinculacion");
    api::confirmar(dispositivo.clave.c_str());
  }

  if (lector_qr::leer(linea)) {
    ejecutar(maquina.alLeer(linea, ahora), ahora);
    memset(linea, 0, sizeof(linea));
  }

  api::Respuesta respuesta;
  while (api::siguienteRespuesta(respuesta)) atenderRespuesta(respuesta, ahora);
  // Apertura manual: solo se pregunta por órdenes con el vínculo operando, red lista, configuración
  // leída y el interruptor de la puerta encendido (ADR 0035 §5).
  api::habilitarOrdenes(
      ordenes::debePreguntar(estadoVinculo.opera(), red::lista(), configuracionLeida, aperturaManual));

  ejecutar(maquina.tick(ahora), ahora);
  // Observar el sensor es leer un pin: no bloquea. Los informes salen en segundoPlano().
  if (observador.observando()) {
    observador.tick(ahora, leerSensor());
    recogerInformes(ahora);
  }
  segundoPlano(ahora);
  cerradura::tick(ahora);
  indicadores::tick(ahora);
}
