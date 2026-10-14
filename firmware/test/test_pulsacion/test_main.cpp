// Pulsación larga: confirma la vinculación solo si se mantiene el pulsador 5 s.
#include <pulsacion.h>
#include <unity.h>

using pulsacion::Larga;

void setUp() {}
void tearDown() {}

void test_no_dispara_antes_de_la_duracion() {
  Larga l;
  TEST_ASSERT_FALSE(l.actualizar(true, true, 1000));
  TEST_ASSERT_FALSE(l.actualizar(true, true, 5999));
}

void test_dispara_una_sola_vez_al_cumplirse() {
  Larga l;
  l.actualizar(true, true, 1000);
  TEST_ASSERT_TRUE(l.actualizar(true, true, 6000));
  TEST_ASSERT_FALSE(l.actualizar(true, true, 7000));  // sigue pulsado: no repite
  TEST_ASSERT_FALSE(l.actualizar(true, true, 20000));
}

void test_soltar_reinicia_la_cuenta() {
  Larga l;
  l.actualizar(true, true, 0);
  l.actualizar(true, false, 4000);  // soltó a los 4 s
  TEST_ASSERT_FALSE(l.actualizar(true, true, 4100));
  TEST_ASSERT_FALSE(l.actualizar(true, true, 8000));  // 3,9 s desde que volvió a pulsar
  TEST_ASSERT_TRUE(l.actualizar(true, true, 9100));
}

void test_tras_soltar_se_puede_confirmar_otra_vez() {
  Larga l;
  l.actualizar(true, true, 0);
  TEST_ASSERT_TRUE(l.actualizar(true, true, 5000));
  l.actualizar(true, false, 5100);
  l.actualizar(true, true, 6000);
  TEST_ASSERT_TRUE(l.actualizar(true, true, 11000));
}

void test_sin_confirmacion_pendiente_nunca_dispara() {
  // Falla segura: un botón mantenido fuera de la ventana no vincula nada.
  Larga l;
  l.actualizar(false, true, 0);
  TEST_ASSERT_FALSE(l.actualizar(false, true, 60000));
}

void test_mantener_pulsado_desde_antes_de_la_ventana_no_cuenta() {
  Larga l;
  l.actualizar(false, true, 0);       // ya estaba pulsado
  TEST_ASSERT_FALSE(l.actualizar(true, true, 10000));  // la ventana abre: cuenta desde ahora
  TEST_ASSERT_TRUE(l.actualizar(true, true, 15000));
}

void test_tolera_el_desborde_del_reloj() {
  Larga l;
  const uint32_t cerca = 0xFFFFFFFFu - 1000u;
  l.actualizar(true, true, cerca);
  TEST_ASSERT_FALSE(l.actualizar(true, true, cerca + 4000u));  // 4 s, desbordado
  TEST_ASSERT_TRUE(l.actualizar(true, true, cerca + 5000u));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_no_dispara_antes_de_la_duracion);
  RUN_TEST(test_dispara_una_sola_vez_al_cumplirse);
  RUN_TEST(test_soltar_reinicia_la_cuenta);
  RUN_TEST(test_tras_soltar_se_puede_confirmar_otra_vez);
  RUN_TEST(test_sin_confirmacion_pendiente_nunca_dispara);
  RUN_TEST(test_mantener_pulsado_desde_antes_de_la_ventana_no_cuenta);
  RUN_TEST(test_tolera_el_desborde_del_reloj);
  return UNITY_END();
}
