// Diagnóstico del lector: tres estados honestos, sin inventar un sí o un no.
#include <actividad.h>
#include <unity.h>

using namespace diagnostico;

void setUp() {}
void tearDown() {}

void test_sin_bytes_desde_el_arranque_es_desconocido() {
  ActividadLector a;
  TEST_ASSERT_EQUAL(EstadoLector::Desconocido, a.estado(0));
  TEST_ASSERT_EQUAL(EstadoLector::Desconocido, a.estado(VENTANA_LECTOR_MS * 2));
}

void test_con_bytes_recientes_responde() {
  ActividadLector a;
  a.alRecibir(1000);
  TEST_ASSERT_EQUAL(EstadoLector::Responde, a.estado(1000));
  TEST_ASSERT_EQUAL(EstadoLector::Responde, a.estado(1000 + VENTANA_LECTOR_MS - 1));
}

void test_pasada_la_ventana_es_silencio() {
  ActividadLector a;
  a.alRecibir(1000);
  TEST_ASSERT_EQUAL(EstadoLector::Silencio, a.estado(1000 + VENTANA_LECTOR_MS));
}

void test_un_byte_nuevo_vuelve_a_responder() {
  ActividadLector a;
  a.alRecibir(0);
  a.alRecibir(VENTANA_LECTOR_MS + 10);
  TEST_ASSERT_EQUAL(EstadoLector::Responde, a.estado(VENTANA_LECTOR_MS + 20));
}

void test_aguanta_el_desborde_de_millis() {
  ActividadLector a;
  a.alRecibir(0xFFFFFF00u);
  TEST_ASSERT_EQUAL(EstadoLector::Responde, a.estado(0x100u));
}

void test_actividad_reciente_solo_dentro_de_la_ventana() {
  ActividadLector a;
  TEST_ASSERT_FALSE(a.huboActividadReciente(1000, QUIETUD_SEGUNDO_PLANO_MS));  // nunca hubo bytes
  a.alRecibir(1000);
  TEST_ASSERT_TRUE(a.huboActividadReciente(1000 + QUIETUD_SEGUNDO_PLANO_MS - 1, QUIETUD_SEGUNDO_PLANO_MS));
  TEST_ASSERT_FALSE(a.huboActividadReciente(1000 + QUIETUD_SEGUNDO_PLANO_MS, QUIETUD_SEGUNDO_PLANO_MS));
}

void test_actividad_reciente_aguanta_el_desborde() {
  ActividadLector a;
  a.alRecibir(0xFFFFFFFFu - 100);
  TEST_ASSERT_TRUE(a.huboActividadReciente(500, QUIETUD_SEGUNDO_PLANO_MS));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_sin_bytes_desde_el_arranque_es_desconocido);
  RUN_TEST(test_con_bytes_recientes_responde);
  RUN_TEST(test_pasada_la_ventana_es_silencio);
  RUN_TEST(test_un_byte_nuevo_vuelve_a_responder);
  RUN_TEST(test_aguanta_el_desborde_de_millis);
  RUN_TEST(test_actividad_reciente_solo_dentro_de_la_ventana);
  RUN_TEST(test_actividad_reciente_aguanta_el_desborde);
  return UNITY_END();
}
