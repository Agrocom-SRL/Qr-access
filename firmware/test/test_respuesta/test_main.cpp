// Interpretación de las respuestas de la API: ante la duda, no abre.
#include <respuesta.h>
#include <stdio.h>
#include <string.h>
#include <unity.h>

using puerta::Motivo;

void setUp() {}
void tearDown() {}

static puerta::Resultado leer(int http, const char* cuerpo) {
  return respuesta::interpretar(http, cuerpo, cuerpo == nullptr ? 0 : strlen(cuerpo));
}

static const char* PERMITIDO =
    "{\"abrir\":true,\"segundos\":4,\"evento_id\":\"e1\",\"motivo_code\":\"acceso.permitido\"}";

static void assertNoAbre(const puerta::Resultado& r) {
  TEST_ASSERT_FALSE(r.valida && r.abrir);
}

void test_abrir_true_con_segundos() {
  auto r = leer(200, PERMITIDO);
  TEST_ASSERT_TRUE(r.valida);
  TEST_ASSERT_TRUE(r.abrir);
  TEST_ASSERT_EQUAL_UINT16(4, r.segundos);
  TEST_ASSERT_EQUAL(Motivo::Permitido, r.motivo);
}

void test_segundos_se_acotan_al_maximo() {
  auto r = leer(200,
                "{\"abrir\":true,\"segundos\":600,\"evento_id\":\"e1\","
                "\"motivo_code\":\"acceso.permitido\"}");
  TEST_ASSERT_TRUE(r.abrir);
  TEST_ASSERT_EQUAL_UINT16(puerta::MAX_APERTURA_S, r.segundos);
}

void test_rechazo_es_valido_y_trae_su_motivo() {
  struct Caso {
    const char* codigo;
    Motivo motivo;
  };
  const Caso casos[] = {
      {"qr.vencido", Motivo::QrVencido},
      {"qr.usado", Motivo::QrUsado},
      {"qr.formato_invalido", Motivo::QrFormatoInvalido},
      {"qr.desconocido", Motivo::QrDesconocido},
      {"qr.anulado", Motivo::QrAnulado},
      {"qr.otra_puerta", Motivo::QrOtraPuerta},
      {"suscripcion.vencida", Motivo::SuscripcionVencida},
      {"algo.nuevo", Motivo::DenegadoOtro},
  };
  for (const Caso& caso : casos) {
    char cuerpo[160];
    snprintf(cuerpo, sizeof(cuerpo), "{\"abrir\":false,\"evento_id\":\"e1\",\"motivo_code\":\"%s\"}",
             caso.codigo);
    auto r = leer(200, cuerpo);
    TEST_ASSERT_TRUE_MESSAGE(r.valida, caso.codigo);
    TEST_ASSERT_FALSE_MESSAGE(r.abrir, caso.codigo);
    TEST_ASSERT_EQUAL_MESSAGE(caso.motivo, r.motivo, caso.codigo);
  }
}

void test_rechazo_con_motivo_de_exito_es_contradictorio_pero_no_abre() {
  auto r = leer(200,
                "{\"abrir\":false,\"evento_id\":\"e1\",\"motivo_code\":\"acceso.permitido\"}");
  TEST_ASSERT_FALSE(r.abrir);
  TEST_ASSERT_EQUAL(Motivo::DenegadoOtro, r.motivo);
}

void test_abrir_con_otro_motivo_no_abre() {
  assertNoAbre(leer(200,
                    "{\"abrir\":true,\"segundos\":4,\"evento_id\":\"e1\","
                    "\"motivo_code\":\"qr.vencido\"}"));
}

void test_http_distinto_de_200_no_abre() {
  assertNoAbre(leer(500, PERMITIDO));
  assertNoAbre(leer(404, PERMITIDO));
  assertNoAbre(leer(204, PERMITIDO));
  assertNoAbre(leer(-1, nullptr));  // sin red o timeout de HTTPClient
  TEST_ASSERT_FALSE(leer(500, PERMITIDO).valida);
}

void test_401_es_credencial_invalida() {
  auto r = leer(401, PERMITIDO);
  TEST_ASSERT_FALSE(r.valida);
  TEST_ASSERT_FALSE(r.abrir);
  TEST_ASSERT_EQUAL(Motivo::CredencialInvalida, r.motivo);
}

void test_json_invalido_o_vacio_no_abre() {
  TEST_ASSERT_FALSE(leer(200, "").valida);
  TEST_ASSERT_FALSE(leer(200, nullptr).valida);
  TEST_ASSERT_FALSE(leer(200, "{\"abrir\":tru").valida);
  TEST_ASSERT_FALSE(leer(200, "[true]").valida);
  TEST_ASSERT_FALSE(leer(200, "true").valida);
  TEST_ASSERT_FALSE(leer(200, "null").valida);
  TEST_ASSERT_FALSE(leer(200, "<html>502 Bad Gateway</html>").valida);
}

void test_abrir_que_no_es_booleano_no_abre() {
  assertNoAbre(leer(200, "{\"abrir\":\"true\",\"segundos\":4,\"evento_id\":\"e\",\"motivo_code\":\"acceso.permitido\"}"));
  assertNoAbre(leer(200, "{\"abrir\":1,\"segundos\":4,\"evento_id\":\"e\",\"motivo_code\":\"acceso.permitido\"}"));
  assertNoAbre(leer(200, "{\"abrir\":null,\"segundos\":4,\"evento_id\":\"e\",\"motivo_code\":\"acceso.permitido\"}"));
  assertNoAbre(leer(200, "{\"segundos\":4,\"evento_id\":\"e\",\"motivo_code\":\"acceso.permitido\"}"));
}

void test_campos_faltantes_o_de_otro_tipo_no_abren() {
  // sin motivo_code, sin evento_id, o con el nombre viejo `mensaje_code`
  assertNoAbre(leer(200, "{\"abrir\":true,\"segundos\":4,\"evento_id\":\"e\"}"));
  assertNoAbre(leer(200, "{\"abrir\":true,\"segundos\":4,\"motivo_code\":\"acceso.permitido\"}"));
  assertNoAbre(leer(200, "{\"abrir\":true,\"segundos\":4,\"evento_id\":\"e\",\"mensaje_code\":\"acceso.permitido\"}"));
  assertNoAbre(leer(200, "{\"abrir\":true,\"segundos\":4,\"evento_id\":\"e\",\"motivo_code\":7}"));
  assertNoAbre(leer(200, "{\"abrir\":true,\"segundos\":4,\"evento_id\":\"e\",\"motivo_code\":\"\"}"));
  TEST_ASSERT_FALSE(leer(200, "{\"abrir\":false,\"evento_id\":\"e\"}").valida);
  TEST_ASSERT_FALSE(leer(200, "{\"abrir\":false,\"motivo_code\":\"qr.usado\"}").valida);
}

void test_segundos_ausentes_o_fuera_de_rango_no_abre() {
  const char* prefijo = "{\"abrir\":true,\"evento_id\":\"e\",\"motivo_code\":\"acceso.permitido\"";
  const char* sufijos[] = {"}",
                           ",\"segundos\":0}",
                           ",\"segundos\":-3}",
                           ",\"segundos\":\"4\"}",
                           ",\"segundos\":4.5}",
                           ",\"segundos\":true}",
                           ",\"segundos\":null}",
                           ",\"segundos\":3601}",
                           ",\"segundos\":99999999999}"};
  for (const char* sufijo : sufijos) {
    char cuerpo[200];
    snprintf(cuerpo, sizeof(cuerpo), "%s%s", prefijo, sufijo);
    assertNoAbre(leer(200, cuerpo));
    TEST_ASSERT_FALSE_MESSAGE(leer(200, cuerpo).valida, sufijo);
  }
}

void test_cuerpo_demasiado_largo_no_abre() {
  char cuerpo[respuesta::MAX_CUERPO + 64];
  memset(cuerpo, ' ', sizeof(cuerpo) - 1);
  cuerpo[sizeof(cuerpo) - 1] = '\0';
  memcpy(cuerpo, PERMITIDO, strlen(PERMITIDO));
  TEST_ASSERT_FALSE(leer(200, cuerpo).valida);
}

void test_cuerpo_con_campos_extra_se_tolera() {
  auto r = leer(200,
                "{\"abrir\":true,\"segundos\":2,\"evento_id\":\"e\","
                "\"motivo_code\":\"acceso.permitido\",\"futuro\":{\"a\":1}}");
  TEST_ASSERT_TRUE(r.abrir);
  TEST_ASSERT_EQUAL_UINT16(2, r.segundos);
}

// --- configuración ---

static respuesta::Configuracion config(int http, const char* cuerpo) {
  return respuesta::interpretarConfiguracion(http, cuerpo, cuerpo == nullptr ? 0 : strlen(cuerpo));
}

void test_configuracion_valida() {
  auto c = config(200, "{\"segundos_apertura\":5,\"zona_horaria\":\"America/La_Paz\",\"ota\":null}");
  TEST_ASSERT_TRUE(c.valida);
  TEST_ASSERT_EQUAL_UINT16(5, c.segundosApertura);
}

void test_configuracion_se_acota_al_maximo() {
  auto c = config(200, "{\"segundos_apertura\":120}");
  TEST_ASSERT_TRUE(c.valida);
  TEST_ASSERT_EQUAL_UINT16(puerta::MAX_APERTURA_S, c.segundosApertura);
}

void test_configuracion_invalida_se_descarta() {
  TEST_ASSERT_FALSE(config(500, "{\"segundos_apertura\":5}").valida);
  TEST_ASSERT_FALSE(config(401, "{\"segundos_apertura\":5}").valida);
  TEST_ASSERT_FALSE(config(200, "").valida);
  TEST_ASSERT_FALSE(config(200, "{").valida);
  TEST_ASSERT_FALSE(config(200, "[]").valida);
  TEST_ASSERT_FALSE(config(200, "{}").valida);
  TEST_ASSERT_FALSE(config(200, "{\"segundos_apertura\":0}").valida);
  TEST_ASSERT_FALSE(config(200, "{\"segundos_apertura\":-1}").valida);
  TEST_ASSERT_FALSE(config(200, "{\"segundos_apertura\":\"5\"}").valida);
  TEST_ASSERT_FALSE(config(200, "{\"segundos_apertura\":99999}").valida);
}

void test_motivos_conocidos_y_mensajes() {
  TEST_ASSERT_EQUAL(Motivo::QrUsado, puerta::motivoDe("qr.usado"));
  TEST_ASSERT_EQUAL(Motivo::DenegadoOtro, puerta::motivoDe(nullptr));
  TEST_ASSERT_EQUAL(Motivo::DenegadoOtro, puerta::motivoDe("QR.USADO"));
  TEST_ASSERT_NOT_NULL(puerta::mensaje(Motivo::SuscripcionVencida));
  TEST_ASSERT_TRUE(strlen(puerta::mensaje(Motivo::SinRed)) > 0);
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_abrir_true_con_segundos);
  RUN_TEST(test_segundos_se_acotan_al_maximo);
  RUN_TEST(test_rechazo_es_valido_y_trae_su_motivo);
  RUN_TEST(test_rechazo_con_motivo_de_exito_es_contradictorio_pero_no_abre);
  RUN_TEST(test_abrir_con_otro_motivo_no_abre);
  RUN_TEST(test_http_distinto_de_200_no_abre);
  RUN_TEST(test_401_es_credencial_invalida);
  RUN_TEST(test_json_invalido_o_vacio_no_abre);
  RUN_TEST(test_abrir_que_no_es_booleano_no_abre);
  RUN_TEST(test_campos_faltantes_o_de_otro_tipo_no_abren);
  RUN_TEST(test_segundos_ausentes_o_fuera_de_rango_no_abre);
  RUN_TEST(test_cuerpo_demasiado_largo_no_abre);
  RUN_TEST(test_cuerpo_con_campos_extra_se_tolera);
  RUN_TEST(test_configuracion_valida);
  RUN_TEST(test_configuracion_se_acota_al_maximo);
  RUN_TEST(test_configuracion_invalida_se_descarta);
  RUN_TEST(test_motivos_conocidos_y_mensajes);
  return UNITY_END();
}
