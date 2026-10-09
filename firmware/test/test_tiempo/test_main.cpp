// Hora UTC: validez y formato ISO 8601 de `leido_en`.
#include <string.h>
#include <tiempo.h>
#include <unity.h>

void setUp() {}
void tearDown() {}

static void assertIso(int64_t epoch, const char* esperado) {
  char salida[tiempo::CAPACIDAD_ISO];
  TEST_ASSERT_TRUE(tiempo::formatearIso(epoch, salida, sizeof(salida)));
  TEST_ASSERT_EQUAL_STRING(esperado, salida);
}

void test_formato_de_fechas_conocidas() {
  assertIso(1700000000, "2023-11-14T22:13:20Z");
  assertIso(1760000000, "2025-10-09T08:53:20Z");
  assertIso(1709164799, "2024-02-28T23:59:59Z");
  assertIso(1709164800, "2024-02-29T00:00:00Z");  // bisiesto
  assertIso(1709251200, "2024-03-01T00:00:00Z");
  assertIso(1735689599, "2024-12-31T23:59:59Z");
  assertIso(1735689600, "2025-01-01T00:00:00Z");
  assertIso(4102444799, "2099-12-31T23:59:59Z");
}

void test_hora_sin_sincronizar_no_es_valida() {
  TEST_ASSERT_FALSE(tiempo::valida(0));
  TEST_ASSERT_FALSE(tiempo::valida(-1));
  TEST_ASSERT_FALSE(tiempo::valida(1699999999));
  TEST_ASSERT_TRUE(tiempo::valida(1700000000));
  TEST_ASSERT_FALSE(tiempo::valida(4102444800));
}

void test_hora_invalida_no_se_formatea() {
  char salida[tiempo::CAPACIDAD_ISO] = "x";
  TEST_ASSERT_FALSE(tiempo::formatearIso(0, salida, sizeof(salida)));
  TEST_ASSERT_EQUAL_STRING("", salida);
}

void test_buffer_chico_o_nulo() {
  char chico[10] = "x";
  TEST_ASSERT_FALSE(tiempo::formatearIso(1760000000, chico, sizeof(chico)));
  TEST_ASSERT_EQUAL_STRING("", chico);
  TEST_ASSERT_FALSE(tiempo::formatearIso(1760000000, nullptr, 30));
  char salida[tiempo::CAPACIDAD_ISO];
  TEST_ASSERT_FALSE(tiempo::formatearIso(1760000000, salida, 0));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_formato_de_fechas_conocidas);
  RUN_TEST(test_hora_sin_sincronizar_no_es_valida);
  RUN_TEST(test_hora_invalida_no_se_formatea);
  RUN_TEST(test_buffer_chico_o_nulo);
  return UNITY_END();
}
