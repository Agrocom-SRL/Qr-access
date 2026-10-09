// Interpretación de la respuesta de la API: ante la duda, no abre.
#include <respuesta.h>
#include <string.h>
#include <unity.h>

void setUp() {}
void tearDown() {}

static puerta::Resultado leer(int http, const char* cuerpo) {
  return respuesta::interpretar(http, cuerpo, cuerpo == nullptr ? 0 : strlen(cuerpo));
}

void test_abrir_true_con_segundos() {
  auto r = leer(200, "{\"abrir\":true,\"segundos_apertura\":4,\"motivo_code\":\"qr.valido\"}");
  TEST_ASSERT_TRUE(r.valida);
  TEST_ASSERT_TRUE(r.abrir);
  TEST_ASSERT_EQUAL_UINT16(4, r.segundos);
}

void test_abrir_false_es_un_rechazo_valido() {
  auto r = leer(200, "{\"abrir\":false,\"motivo_code\":\"qr.usado\"}");
  TEST_ASSERT_TRUE(r.valida);
  TEST_ASSERT_FALSE(r.abrir);
}

void test_estado_http_distinto_de_200_no_abre() {
  TEST_ASSERT_FALSE(leer(500, "{\"abrir\":true,\"segundos_apertura\":4}").abrir);
  TEST_ASSERT_FALSE(leer(401, "{\"abrir\":true,\"segundos_apertura\":4}").valida);
  TEST_ASSERT_FALSE(leer(-1, nullptr).valida);  // sin red / timeout de HTTPClient
}

void test_json_invalido_o_vacio_no_abre() {
  TEST_ASSERT_FALSE(leer(200, "").valida);
  TEST_ASSERT_FALSE(leer(200, "{\"abrir\":tru").valida);
  TEST_ASSERT_FALSE(leer(200, "[true]").valida);
  TEST_ASSERT_FALSE(leer(200, "true").valida);
}

void test_abrir_que_no_es_booleano_no_abre() {
  TEST_ASSERT_FALSE(leer(200, "{\"abrir\":\"true\",\"segundos_apertura\":4}").abrir);
  TEST_ASSERT_FALSE(leer(200, "{\"abrir\":1,\"segundos_apertura\":4}").abrir);
  TEST_ASSERT_FALSE(leer(200, "{\"segundos_apertura\":4}").abrir);
}

void test_segundos_ausentes_o_fuera_de_rango_no_abre() {
  TEST_ASSERT_FALSE(leer(200, "{\"abrir\":true}").abrir);
  TEST_ASSERT_FALSE(leer(200, "{\"abrir\":true,\"segundos_apertura\":0}").abrir);
  TEST_ASSERT_FALSE(leer(200, "{\"abrir\":true,\"segundos_apertura\":-3}").abrir);
  TEST_ASSERT_FALSE(leer(200, "{\"abrir\":true,\"segundos_apertura\":\"4\"}").abrir);
}

void test_cuerpo_demasiado_largo_no_abre() {
  char cuerpo[respuesta::MAX_CUERPO + 64];
  memset(cuerpo, ' ', sizeof(cuerpo) - 1);
  cuerpo[sizeof(cuerpo) - 1] = '\0';
  const char* json = "{\"abrir\":true,\"segundos_apertura\":4}";
  memcpy(cuerpo, json, strlen(json));
  TEST_ASSERT_FALSE(leer(200, cuerpo).valida);
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_abrir_true_con_segundos);
  RUN_TEST(test_abrir_false_es_un_rechazo_valido);
  RUN_TEST(test_estado_http_distinto_de_200_no_abre);
  RUN_TEST(test_json_invalido_o_vacio_no_abre);
  RUN_TEST(test_abrir_que_no_es_booleano_no_abre);
  RUN_TEST(test_segundos_ausentes_o_fuera_de_rango_no_abre);
  RUN_TEST(test_cuerpo_demasiado_largo_no_abre);
  return UNITY_END();
}
