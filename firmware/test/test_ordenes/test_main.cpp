// Apertura manual (ADR 0035): cuándo preguntar, cuánto esperar y si una orden sigue vigente.
#include <ordenes.h>
#include <unity.h>

using namespace ordenes;

void setUp() {}
void tearDown() {}

void test_solo_pregunta_con_todo_en_orden() {
  TEST_ASSERT_TRUE(debePreguntar(true, true, true, true));
  TEST_ASSERT_FALSE(debePreguntar(false, true, true, true));  // sin vínculo operando
  TEST_ASSERT_FALSE(debePreguntar(true, false, true, true));  // sin red
  TEST_ASSERT_FALSE(debePreguntar(true, true, false, true));  // sin configuración leída
  TEST_ASSERT_FALSE(debePreguntar(true, true, true, false));  // interruptor apagado
}

void test_la_espera_tras_fallos_crece_y_se_topa() {
  TEST_ASSERT_EQUAL_UINT32(0, esperaTras(0));
  TEST_ASSERT_EQUAL_UINT32(1000, esperaTras(1));
  TEST_ASSERT_EQUAL_UINT32(2000, esperaTras(2));
  TEST_ASSERT_EQUAL_UINT32(4000, esperaTras(3));
  TEST_ASSERT_EQUAL_UINT32(5000, esperaTras(4));
  TEST_ASSERT_EQUAL_UINT32(5000, esperaTras(255));
}

void test_una_respuesta_inmediata_no_es_una_espera_larga() {
  TEST_ASSERT_TRUE(respuestaRapida(0));
  TEST_ASSERT_TRUE(respuestaRapida(RESPUESTA_RAPIDA_MS - 1));
  TEST_ASSERT_FALSE(respuestaRapida(RESPUESTA_RAPIDA_MS));
  TEST_ASSERT_FALSE(respuestaRapida(20000));
}

void test_la_orden_vale_hasta_que_corre_su_plazo() {
  TEST_ASSERT_TRUE(vigente(1000, 5000, 1000));
  TEST_ASSERT_TRUE(vigente(1000, 5000, 5999));
  TEST_ASSERT_FALSE(vigente(1000, 5000, 6000));
  TEST_ASSERT_FALSE(vigente(1000, 5000, 60000));
}

void test_una_orden_sin_plazo_nunca_vale() {
  TEST_ASSERT_FALSE(vigente(1000, 0, 1000));
}

void test_la_vigencia_aguanta_el_desborde_de_millis() {
  const uint32_t cerca = 0xFFFFFF00u;
  TEST_ASSERT_TRUE(vigente(cerca, 1000, 100));    // pasaron 356 ms
  TEST_ASSERT_FALSE(vigente(cerca, 300, 100));    // pasaron 356 ms > 300
}

void test_una_hora_anterior_a_la_recepcion_no_vence_la_orden_ni_la_alarga() {
  // `ahora` se leyó un instante antes de que llegara la respuesta: no ha pasado nada.
  TEST_ASSERT_TRUE(vigente(2000, 5000, 1990));
  TEST_ASSERT_FALSE(vigente(2000, 0, 1990));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_solo_pregunta_con_todo_en_orden);
  RUN_TEST(test_la_espera_tras_fallos_crece_y_se_topa);
  RUN_TEST(test_una_respuesta_inmediata_no_es_una_espera_larga);
  RUN_TEST(test_la_orden_vale_hasta_que_corre_su_plazo);
  RUN_TEST(test_una_orden_sin_plazo_nunca_vale);
  RUN_TEST(test_la_vigencia_aguanta_el_desborde_de_millis);
  RUN_TEST(test_una_hora_anterior_a_la_recepcion_no_vence_la_orden_ni_la_alarga);
  return UNITY_END();
}
