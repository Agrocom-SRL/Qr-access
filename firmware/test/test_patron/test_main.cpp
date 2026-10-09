// Patrones de LED y buzzer por indicación.
#include <initializer_list>
#include <patron.h>
#include <unity.h>

using puerta::Indicacion;

void setUp() {}
void tearDown() {}

void test_permitido_es_verde_con_beep_corto_y_termina() {
  auto inicio = patron::en(Indicacion::Permitido, 0);
  TEST_ASSERT_TRUE(inicio.verde);
  TEST_ASSERT_FALSE(inicio.rojo);
  TEST_ASSERT_TRUE(inicio.buzzer);
  auto despues = patron::en(Indicacion::Permitido, 500);
  TEST_ASSERT_TRUE(despues.verde);
  TEST_ASSERT_FALSE(despues.buzzer);
  TEST_ASSERT_TRUE(patron::en(Indicacion::Permitido, 1500).terminado);
}

void test_denegado_es_rojo_con_dos_beeps() {
  TEST_ASSERT_TRUE(patron::en(Indicacion::Denegado, 0).buzzer);
  TEST_ASSERT_FALSE(patron::en(Indicacion::Denegado, 200).buzzer);
  TEST_ASSERT_TRUE(patron::en(Indicacion::Denegado, 350).buzzer);
  TEST_ASSERT_FALSE(patron::en(Indicacion::Denegado, 600).buzzer);
  TEST_ASSERT_TRUE(patron::en(Indicacion::Denegado, 600).rojo);
  TEST_ASSERT_FALSE(patron::en(Indicacion::Denegado, 600).verde);
}

void test_sin_red_es_azul_parpadeante() {
  TEST_ASSERT_TRUE(patron::en(Indicacion::SinRed, 0).azul);
  TEST_ASSERT_FALSE(patron::en(Indicacion::SinRed, 300).azul);
  TEST_ASSERT_TRUE(patron::en(Indicacion::SinRed, 500).azul);
  TEST_ASSERT_FALSE(patron::en(Indicacion::SinRed, 0).rojo);
}

void test_error_es_rojo_rapido_con_beep_largo() {
  TEST_ASSERT_TRUE(patron::en(Indicacion::Error, 0).rojo);
  TEST_ASSERT_FALSE(patron::en(Indicacion::Error, 150).rojo);
  TEST_ASSERT_TRUE(patron::en(Indicacion::Error, 500).buzzer);
  TEST_ASSERT_FALSE(patron::en(Indicacion::Error, 700).buzzer);
}

void test_los_cuatro_patrones_son_distintos() {
  // Ningún verde fuera de Permitido: nunca se confunde un rechazo con un acceso.
  for (Indicacion i : {Indicacion::Denegado, Indicacion::SinRed, Indicacion::Error,
                       Indicacion::Validando}) {
    for (uint32_t t = 0; t < 4000; t += 10) TEST_ASSERT_FALSE(patron::en(i, t).verde);
  }
}

void test_validando_es_azul_y_no_dura_para_siempre() {
  TEST_ASSERT_TRUE(patron::en(Indicacion::Validando, 2500).azul);
  TEST_ASSERT_TRUE(patron::en(Indicacion::Validando, 4000).terminado);
}

void test_ninguna_esta_apagada() {
  auto s = patron::en(Indicacion::Ninguna, 0);
  TEST_ASSERT_TRUE(s.terminado);
  TEST_ASSERT_FALSE(s.verde || s.rojo || s.azul || s.buzzer);
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_permitido_es_verde_con_beep_corto_y_termina);
  RUN_TEST(test_denegado_es_rojo_con_dos_beeps);
  RUN_TEST(test_sin_red_es_azul_parpadeante);
  RUN_TEST(test_error_es_rojo_rapido_con_beep_largo);
  RUN_TEST(test_los_cuatro_patrones_son_distintos);
  RUN_TEST(test_validando_es_azul_y_no_dura_para_siempre);
  RUN_TEST(test_ninguna_esta_apagada);
  return UNITY_END();
}
