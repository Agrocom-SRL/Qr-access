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

static respuesta::Anuncio anunciar(int http, const char* cuerpo) {
  return respuesta::interpretarAnuncio(http, cuerpo, cuerpo == nullptr ? 0 : strlen(cuerpo));
}

using Estado = respuesta::Anuncio::Estado;

void test_anuncio_detectada() {
  auto r = anunciar(200, "{\"estado\":\"detectada\"}");
  TEST_ASSERT_EQUAL(Estado::Detectada, r.estado);
  TEST_ASSERT_FALSE(r.rechazado);
}

void test_anuncio_confirmar_pide_el_boton() {
  auto r = anunciar(200, "{\"estado\":\"confirmar\"}");
  TEST_ASSERT_EQUAL(Estado::Confirmar, r.estado);
  TEST_ASSERT_FALSE(r.rechazado);
}

void test_anuncio_vinculado_trae_el_id() {
  auto r = anunciar(200, "{\"estado\":\"vinculado\",\"dispositivo_id\":\"1234\"}");
  TEST_ASSERT_EQUAL(Estado::Vinculado, r.estado);
  TEST_ASSERT_EQUAL_STRING("1234", r.dispositivoId);
}

void test_anuncio_401_y_429_son_rechazos() {
  TEST_ASSERT_TRUE(anunciar(401, "{}").rechazado);
  TEST_ASSERT_TRUE(anunciar(429, nullptr).rechazado);
  TEST_ASSERT_EQUAL(Estado::Invalido, anunciar(401, "{}").estado);
}

void test_anuncio_mal_formado_no_cambia_nada() {
  const char* malos[] = {
      "",
      "no es json",
      "[]",
      "{}",
      "{\"estado\":\"otro\"}",
      "{\"estado\":1}",
      "{\"estado\":\"vinculado\"}",                                         // sin id
      "{\"estado\":\"vinculado\",\"dispositivo_id\":\"\"}",                  // id vacío
      "{\"estado\":\"vinculado\",\"dispositivo_id\":12}",                    // id no es texto
      "{\"estado\":\"vinculado\",\"dispositivo_id\":\"12.34\"}",             // el punto separa id y clave
      "{\"estado\":\"vinculado\",\"dispositivo_id\":\"1\\r\\nX-Evil: 1\"}",  // inyección en el encabezado
      "{\"estado\":\"vinculado\",\"dispositivo_id\":\"123456789012345678901\"}",  // 21 > 20
  };
  for (const char* cuerpo : malos) {
    auto r = anunciar(200, cuerpo);
    TEST_ASSERT_EQUAL_MESSAGE(Estado::Invalido, r.estado, cuerpo);
    TEST_ASSERT_EQUAL_STRING("", r.dispositivoId);
  }
  TEST_ASSERT_EQUAL(Estado::Invalido, anunciar(500, "{\"estado\":\"detectada\"}").estado);
  TEST_ASSERT_EQUAL(Estado::Invalido, anunciar(204, nullptr).estado);
}

// --- evento_id y configuración del sensor (ADR 0031 §18) ---------------------------------------

static const char* PERMITIDO_EVENTO_42 =
    "{\"abrir\":true,\"segundos\":4,\"evento_id\":\"42\",\"motivo_code\":\"acceso.permitido\"}";

void test_apertura_deja_su_evento_id_para_informar() {
  char evento[confirmacion::MAX_EVENTO_ID + 1] = "basura";
  auto r = respuesta::interpretar(200, PERMITIDO_EVENTO_42, strlen(PERMITIDO_EVENTO_42), evento);
  TEST_ASSERT_TRUE(r.abrir);
  TEST_ASSERT_EQUAL_STRING("42", evento);
}

void test_evento_id_que_no_son_digitos_no_cambia_la_apertura_pero_no_se_informa() {
  // La falla segura no cambia: la respuesta sigue siendo válida y abre; solo queda sin informe.
  char evento[confirmacion::MAX_EVENTO_ID + 1] = "basura";
  auto r = respuesta::interpretar(200, PERMITIDO, strlen(PERMITIDO), evento);  // evento_id "e1"
  TEST_ASSERT_TRUE(r.valida);
  TEST_ASSERT_TRUE(r.abrir);
  TEST_ASSERT_EQUAL_STRING("", evento);
}

void test_sin_apertura_el_evento_queda_vacio() {
  const char* denegado =
      "{\"abrir\":false,\"evento_id\":\"42\",\"motivo_code\":\"qr.vencido\"}";
  char evento[confirmacion::MAX_EVENTO_ID + 1] = "basura";
  auto r = respuesta::interpretar(200, denegado, strlen(denegado), evento);
  TEST_ASSERT_FALSE(r.abrir);
  TEST_ASSERT_EQUAL_STRING("", evento);
  char otro[confirmacion::MAX_EVENTO_ID + 1] = "basura";
  r = respuesta::interpretar(500, PERMITIDO_EVENTO_42, strlen(PERMITIDO_EVENTO_42), otro);
  TEST_ASSERT_FALSE(r.valida && r.abrir);
  TEST_ASSERT_EQUAL_STRING("", otro);
}

static respuesta::Configuracion config(const char* cuerpo) {
  return respuesta::interpretarConfiguracion(200, cuerpo, strlen(cuerpo));
}

void test_configuracion_con_sensor_y_espera() {
  auto c = config("{\"segundos_apertura\":6,\"zona_horaria\":\"America/La_Paz\",\"ota\":null,"
                  "\"sensor_puerta\":{\"instalado\":true,\"nivel_abierto\":\"bajo\"},"
                  "\"espera_confirmacion_segundos\":11}");
  TEST_ASSERT_TRUE(c.valida);
  TEST_ASSERT_EQUAL_UINT16(6, c.segundosApertura);
  TEST_ASSERT_TRUE(c.sensor.instalado);
  TEST_ASSERT_EQUAL(confirmacion::Nivel::Bajo, c.sensor.nivelAbierto);
  TEST_ASSERT_EQUAL_UINT16(11, c.esperaConfirmacionS);
}

void test_configuracion_sin_sensor_instalado() {
  auto c = config("{\"segundos_apertura\":6,\"sensor_puerta\":{\"instalado\":false,"
                  "\"nivel_abierto\":\"alto\"},\"espera_confirmacion_segundos\":11}");
  TEST_ASSERT_TRUE(c.valida);
  TEST_ASSERT_FALSE(c.sensor.instalado);
  TEST_ASSERT_EQUAL(confirmacion::Nivel::Alto, c.sensor.nivelAbierto);
}

void test_configuracion_vieja_sin_campos_nuevos_deja_sensor_no_instalado() {
  auto c = config("{\"segundos_apertura\":6}");
  TEST_ASSERT_TRUE(c.valida);
  TEST_ASSERT_FALSE(c.sensor.instalado);
  TEST_ASSERT_EQUAL_UINT16(0, c.esperaConfirmacionS);
}

void test_sensor_mal_formado_queda_no_instalado_sin_invalidar_la_configuracion() {
  const char* casos[] = {
      "{\"segundos_apertura\":6,\"sensor_puerta\":{\"instalado\":true,\"nivel_abierto\":\"medio\"}}",
      "{\"segundos_apertura\":6,\"sensor_puerta\":{\"instalado\":true}}",
      "{\"segundos_apertura\":6,\"sensor_puerta\":{\"instalado\":\"si\",\"nivel_abierto\":\"alto\"}}",
      "{\"segundos_apertura\":6,\"sensor_puerta\":true}",
      "{\"segundos_apertura\":6,\"sensor_puerta\":null}",
  };
  for (const char* caso : casos) {
    auto c = config(caso);
    TEST_ASSERT_TRUE(c.valida);
    TEST_ASSERT_EQUAL_UINT16(6, c.segundosApertura);
    TEST_ASSERT_FALSE(c.sensor.instalado);
  }
}

void test_espera_fuera_de_rango_o_de_otro_tipo_no_vale() {
  TEST_ASSERT_EQUAL_UINT16(0, config("{\"segundos_apertura\":6,\"espera_confirmacion_segundos\":0}").esperaConfirmacionS);
  TEST_ASSERT_EQUAL_UINT16(0, config("{\"segundos_apertura\":6,\"espera_confirmacion_segundos\":601}").esperaConfirmacionS);
  TEST_ASSERT_EQUAL_UINT16(0, config("{\"segundos_apertura\":6,\"espera_confirmacion_segundos\":\"11\"}").esperaConfirmacionS);
  TEST_ASSERT_EQUAL_UINT16(0, config("{\"segundos_apertura\":6,\"espera_confirmacion_segundos\":true}").esperaConfirmacionS);
  TEST_ASSERT_EQUAL_UINT16(600, config("{\"segundos_apertura\":6,\"espera_confirmacion_segundos\":600}").esperaConfirmacionS);
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
  RUN_TEST(test_anuncio_detectada);
  RUN_TEST(test_anuncio_confirmar_pide_el_boton);
  RUN_TEST(test_anuncio_vinculado_trae_el_id);
  RUN_TEST(test_anuncio_401_y_429_son_rechazos);
  RUN_TEST(test_anuncio_mal_formado_no_cambia_nada);
  RUN_TEST(test_apertura_deja_su_evento_id_para_informar);
  RUN_TEST(test_evento_id_que_no_son_digitos_no_cambia_la_apertura_pero_no_se_informa);
  RUN_TEST(test_sin_apertura_el_evento_queda_vacio);
  RUN_TEST(test_configuracion_con_sensor_y_espera);
  RUN_TEST(test_configuracion_sin_sensor_instalado);
  RUN_TEST(test_configuracion_vieja_sin_campos_nuevos_deja_sensor_no_instalado);
  RUN_TEST(test_sensor_mal_formado_queda_no_instalado_sin_invalidar_la_configuracion);
  RUN_TEST(test_espera_fuera_de_rango_o_de_otro_tipo_no_vale);
  return UNITY_END();
}
