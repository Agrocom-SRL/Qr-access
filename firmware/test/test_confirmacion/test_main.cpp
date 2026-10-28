// Confirmación de la apertura: polaridad del sensor y observación tras la orden del servidor.
// Nada depende de millis() ni de Arduino: el tiempo es un número que avanza el test.
#include <confirmacion.h>
#include <string.h>
#include <unity.h>

using namespace confirmacion;

void setUp() {}
void tearDown() {}

static Sensor sensorInstalado(Nivel nivelAbierto = Nivel::Alto) { return Sensor{true, nivelAbierto}; }

// --- polaridad ---------------------------------------------------------------------------------

void test_por_omision_el_sensor_no_esta_instalado_y_la_polaridad_es_alto() {
  Sensor s;
  TEST_ASSERT_FALSE(s.instalado);
  TEST_ASSERT_EQUAL(Nivel::Alto, s.nivelAbierto);  // PENDIENTE de confirmar en campo
  TEST_ASSERT_EQUAL(Nivel::Alto, NIVEL_ABIERTO_POR_OMISION);
}

void test_sin_sensor_no_se_interpreta_el_pin() {
  Sensor s;
  TEST_ASSERT_EQUAL(Lectura::SinSensor, interpretar(s, true));
  TEST_ASSERT_EQUAL(Lectura::SinSensor, interpretar(s, false));
}

void test_polaridad_alto_es_abierta() {
  TEST_ASSERT_EQUAL(Lectura::Abierta, interpretar(sensorInstalado(Nivel::Alto), true));
  TEST_ASSERT_EQUAL(Lectura::Cerrada, interpretar(sensorInstalado(Nivel::Alto), false));
}

void test_polaridad_bajo_invierte_la_lectura() {
  TEST_ASSERT_EQUAL(Lectura::Abierta, interpretar(sensorInstalado(Nivel::Bajo), false));
  TEST_ASSERT_EQUAL(Lectura::Cerrada, interpretar(sensorInstalado(Nivel::Bajo), true));
}

void test_textos_del_contrato() {
  TEST_ASSERT_EQUAL_STRING("abierta", texto(Lectura::Abierta));
  TEST_ASSERT_EQUAL_STRING("cerrada", texto(Lectura::Cerrada));
  TEST_ASSERT_EQUAL_STRING("sin_sensor", texto(Lectura::SinSensor));
  TEST_ASSERT_EQUAL_STRING("ejecutada", texto(Resultado::Ejecutada));
  TEST_ASSERT_EQUAL_STRING("fallida", texto(Resultado::Fallida));
  TEST_ASSERT_EQUAL_STRING("sin_sensor", texto(Resultado::SinSensor));
  TEST_ASSERT_EQUAL_STRING("puerta_no_abrio", texto(Causa::PuertaNoAbrio));
  TEST_ASSERT_EQUAL_STRING("puerta_no_cerro", texto(Causa::PuertaNoCerro));
  TEST_ASSERT_EQUAL_STRING("rele_no_accionado", texto(Causa::ReleNoAccionado));
  TEST_ASSERT_EQUAL_STRING("", texto(Causa::Ninguna));
}

void test_evento_id_valido_son_digitos() {
  TEST_ASSERT_TRUE(eventoIdValido("1"));
  TEST_ASSERT_TRUE(eventoIdValido("12345678901234567890"));  // 20
  TEST_ASSERT_FALSE(eventoIdValido("123456789012345678901"));  // 21
  TEST_ASSERT_FALSE(eventoIdValido(""));
  TEST_ASSERT_FALSE(eventoIdValido(nullptr));
  TEST_ASSERT_FALSE(eventoIdValido("12a"));
  TEST_ASSERT_FALSE(eventoIdValido("-1"));
}

// --- observación -------------------------------------------------------------------------------

void test_se_ve_abrir_y_se_informa_ejecutada_enseguida() {
  Observador o;
  o.iniciar("42", 1000, 11000, sensorInstalado(), Lectura::Cerrada);
  TEST_ASSERT_TRUE(o.observando());
  o.tick(1500, Lectura::Cerrada);
  Informe i;
  TEST_ASSERT_FALSE(o.siguiente(i));  // todavía no hay nada que informar
  o.tick(2000, Lectura::Abierta);
  TEST_ASSERT_FALSE(o.observando());  // se informa sin esperar al fin del plazo
  TEST_ASSERT_TRUE(o.siguiente(i));
  TEST_ASSERT_EQUAL_STRING("42", i.eventoId);
  TEST_ASSERT_EQUAL(Resultado::Ejecutada, i.resultado);
  TEST_ASSERT_EQUAL(Causa::Ninguna, i.causa);
  TEST_ASSERT_FALSE(o.siguiente(i));  // un solo informe por apertura
}

void test_vence_el_plazo_sin_ver_abrir_es_fallida_puerta_no_abrio() {
  Observador o;
  o.iniciar("42", 1000, 11000, sensorInstalado(), Lectura::Cerrada);
  o.tick(11999, Lectura::Cerrada);
  TEST_ASSERT_TRUE(o.observando());
  o.tick(12000, Lectura::Cerrada);  // el plazo se cuenta desde el inicio del pulso del relé
  TEST_ASSERT_FALSE(o.observando());
  Informe i;
  TEST_ASSERT_TRUE(o.siguiente(i));
  TEST_ASSERT_EQUAL(Resultado::Fallida, i.resultado);
  TEST_ASSERT_EQUAL(Causa::PuertaNoAbrio, i.causa);
}

void test_el_plazo_aguanta_el_desborde_de_millis() {
  Observador o;
  const uint32_t inicio = 0xFFFFFFF0u;
  o.iniciar("7", inicio, 5000, sensorInstalado(), Lectura::Cerrada);
  o.tick(inicio + 4999u, Lectura::Cerrada);
  TEST_ASSERT_TRUE(o.observando());
  o.tick(inicio + 5000u, Lectura::Cerrada);  // ya envuelto a un número chico
  TEST_ASSERT_FALSE(o.observando());
}

void test_abrir_justo_al_vencer_el_plazo_cuenta_como_ejecutada() {
  // Se evalúa primero lo que se ve: una lectura abierta en el mismo tick del vencimiento gana.
  Observador o;
  o.iniciar("9", 0, 1000, sensorInstalado(), Lectura::Cerrada);
  o.tick(1000, Lectura::Abierta);
  Informe i;
  TEST_ASSERT_TRUE(o.siguiente(i));
  TEST_ASSERT_EQUAL(Resultado::Ejecutada, i.resultado);
}

void test_sin_sensor_se_informa_una_vez_y_no_se_observa() {
  Observador o;
  o.iniciar("42", 0, 11000, Sensor{}, Lectura::SinSensor);
  TEST_ASSERT_FALSE(o.observando());
  Informe i;
  TEST_ASSERT_TRUE(o.siguiente(i));
  TEST_ASSERT_EQUAL_STRING("42", i.eventoId);
  TEST_ASSERT_EQUAL(Resultado::SinSensor, i.resultado);
  TEST_ASSERT_EQUAL(Causa::Ninguna, i.causa);
  TEST_ASSERT_FALSE(o.siguiente(i));
}

void test_puerta_ya_abierta_exige_verla_cerrada_antes() {
  Observador o;
  o.iniciar("42", 0, 10000, sensorInstalado(), Lectura::Abierta);
  o.tick(100, Lectura::Abierta);  // sigue abierta: no se puede afirmar que el relé la abrió
  TEST_ASSERT_TRUE(o.observando());
  o.tick(200, Lectura::Cerrada);
  o.tick(300, Lectura::Abierta);
  Informe i;
  TEST_ASSERT_TRUE(o.siguiente(i));
  TEST_ASSERT_EQUAL(Resultado::Ejecutada, i.resultado);
}

void test_puerta_que_queda_abierta_todo_el_plazo_es_fallida() {
  Observador o;
  o.iniciar("42", 0, 1000, sensorInstalado(), Lectura::Abierta);
  o.tick(1000, Lectura::Abierta);
  Informe i;
  TEST_ASSERT_TRUE(o.siguiente(i));
  TEST_ASSERT_EQUAL(Resultado::Fallida, i.resultado);
  TEST_ASSERT_EQUAL(Causa::PuertaNoAbrio, i.causa);
}

void test_rele_no_accionado_es_fallida_con_su_causa() {
  Observador o;
  o.releNoAccionado("42");
  TEST_ASSERT_FALSE(o.observando());
  Informe i;
  TEST_ASSERT_TRUE(o.siguiente(i));
  TEST_ASSERT_EQUAL_STRING("42", i.eventoId);
  TEST_ASSERT_EQUAL(Resultado::Fallida, i.resultado);
  TEST_ASSERT_EQUAL(Causa::ReleNoAccionado, i.causa);
}

void test_evento_id_invalido_no_se_observa_ni_se_informa() {
  Observador o;
  o.iniciar("", 0, 1000, sensorInstalado(), Lectura::Cerrada);
  o.iniciar("abc", 0, 1000, sensorInstalado(), Lectura::Cerrada);
  o.releNoAccionado("");
  TEST_ASSERT_FALSE(o.observando());
  Informe i;
  TEST_ASSERT_FALSE(o.siguiente(i));
}

void test_otra_apertura_cierra_la_anterior_sin_perderla() {
  Observador o;
  o.iniciar("1", 0, 10000, sensorInstalado(), Lectura::Cerrada);
  o.iniciar("2", 8000, 10000, sensorInstalado(), Lectura::Cerrada);
  Informe i;
  TEST_ASSERT_TRUE(o.siguiente(i));
  TEST_ASSERT_EQUAL_STRING("1", i.eventoId);
  TEST_ASSERT_EQUAL(Resultado::Fallida, i.resultado);
  TEST_ASSERT_EQUAL(Causa::PuertaNoAbrio, i.causa);
  TEST_ASSERT_FALSE(o.siguiente(i));
  TEST_ASSERT_TRUE(o.observando());
  o.tick(8500, Lectura::Abierta);
  TEST_ASSERT_TRUE(o.siguiente(i));
  TEST_ASSERT_EQUAL_STRING("2", i.eventoId);
  TEST_ASSERT_EQUAL(Resultado::Ejecutada, i.resultado);
}

void test_tick_sin_observar_no_hace_nada() {
  Observador o;
  o.tick(1000, Lectura::Abierta);
  Informe i;
  TEST_ASSERT_FALSE(o.siguiente(i));
}

void test_no_bloquea_cada_tick_retorna_y_la_observacion_avanza_con_el_tiempo() {
  // La observación no espera: iniciar() y tick() retornan siempre y todo se resuelve solo por el
  // paso del tiempo que le dan, nunca por una espera interna.
  Observador o;
  o.iniciar("5", 0, 3000, sensorInstalado(), Lectura::Cerrada);
  uint32_t t = 0;
  int ticks = 0;
  while (o.observando() && t < 10000) {
    o.tick(t, Lectura::Cerrada);
    t += 10;
    ++ticks;
  }
  TEST_ASSERT_EQUAL_UINT32(301, ticks);  // de 0 a 3000 ms, cada 10 ms
  Informe i;
  TEST_ASSERT_TRUE(o.siguiente(i));
  TEST_ASSERT_EQUAL(Resultado::Fallida, i.resultado);
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_por_omision_el_sensor_no_esta_instalado_y_la_polaridad_es_alto);
  RUN_TEST(test_sin_sensor_no_se_interpreta_el_pin);
  RUN_TEST(test_polaridad_alto_es_abierta);
  RUN_TEST(test_polaridad_bajo_invierte_la_lectura);
  RUN_TEST(test_textos_del_contrato);
  RUN_TEST(test_evento_id_valido_son_digitos);
  RUN_TEST(test_se_ve_abrir_y_se_informa_ejecutada_enseguida);
  RUN_TEST(test_vence_el_plazo_sin_ver_abrir_es_fallida_puerta_no_abrio);
  RUN_TEST(test_el_plazo_aguanta_el_desborde_de_millis);
  RUN_TEST(test_abrir_justo_al_vencer_el_plazo_cuenta_como_ejecutada);
  RUN_TEST(test_sin_sensor_se_informa_una_vez_y_no_se_observa);
  RUN_TEST(test_puerta_ya_abierta_exige_verla_cerrada_antes);
  RUN_TEST(test_puerta_que_queda_abierta_todo_el_plazo_es_fallida);
  RUN_TEST(test_rele_no_accionado_es_fallida_con_su_causa);
  RUN_TEST(test_evento_id_invalido_no_se_observa_ni_se_informa);
  RUN_TEST(test_otra_apertura_cierra_la_anterior_sin_perderla);
  RUN_TEST(test_tick_sin_observar_no_hace_nada);
  RUN_TEST(test_no_bloquea_cada_tick_retorna_y_la_observacion_avanza_con_el_tiempo);
  return UNITY_END();
}
