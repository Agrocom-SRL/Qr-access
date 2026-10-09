// Aprovisionamiento por serie: comandos válidos e inválidos y encabezado de autenticación.
#include <aprovisionamiento.h>
#include <string.h>
#include <unity.h>

using namespace aprovisionamiento;

void setUp() {}
void tearDown() {}

void test_comandos_simples() {
  TEST_ASSERT_EQUAL(Tipo::Ayuda, interpretar("ayuda", false).tipo);
  TEST_ASSERT_EQUAL(Tipo::Estado, interpretar("estado\r\n", false).tipo);
  TEST_ASSERT_EQUAL(Tipo::Borrar, interpretar("  borrar  ", false).tipo);
  TEST_ASSERT_EQUAL(Tipo::Reiniciar, interpretar("reiniciar", false).tipo);
  TEST_ASSERT_EQUAL(Tipo::Vacio, interpretar("", false).tipo);
  TEST_ASSERT_EQUAL(Tipo::Vacio, interpretar("\r\n", false).tipo);
  TEST_ASSERT_EQUAL(Tipo::Vacio, interpretar(nullptr, false).tipo);
}

void test_comando_desconocido() {
  auto c = interpretar("formatear", false);
  TEST_ASSERT_EQUAL(Tipo::Invalido, c.tipo);
  TEST_ASSERT_EQUAL(Error::ComandoDesconocido, c.error);
  TEST_ASSERT_EQUAL(Tipo::Invalido, interpretar("borrartodo", false).tipo);
  TEST_ASSERT_EQUAL(Tipo::Invalido, interpretar("setx wifi_ssid a", false).tipo);
}

void test_fijar_cada_campo() {
  auto ssid = interpretar("set wifi_ssid Mi Red 2.4", false);
  TEST_ASSERT_EQUAL(Tipo::Fijar, ssid.tipo);
  TEST_ASSERT_EQUAL(Campo::WifiSsid, ssid.campo);
  TEST_ASSERT_EQUAL_STRING("Mi Red 2.4", ssid.valor);

  auto clave = interpretar("set wifi_clave claveSegura1", false);
  TEST_ASSERT_EQUAL(Campo::WifiClave, clave.campo);
  TEST_ASSERT_EQUAL_STRING("claveSegura1", clave.valor);

  auto url = interpretar("set api_url https://acceso.agrocom.com.bo/", false);
  TEST_ASSERT_EQUAL(Campo::ApiUrl, url.campo);
  TEST_ASSERT_EQUAL_STRING("https://acceso.agrocom.com.bo", url.valor);  // sin "/" final

  auto id = interpretar("set disp_id disp-01_A\r\n", false);
  TEST_ASSERT_EQUAL(Campo::DispositivoId, id.campo);
  TEST_ASSERT_EQUAL_STRING("disp-01_A", id.valor);

  auto secreto = interpretar("set disp_clave Zx9.abc-DEF_12345", false);
  TEST_ASSERT_EQUAL(Campo::DispositivoClave, secreto.campo);
  TEST_ASSERT_EQUAL_STRING("Zx9.abc-DEF_12345", secreto.valor);
}

void test_wifi_abierta_con_clave_vacia() {
  auto c = interpretar("set wifi_clave", false);
  TEST_ASSERT_EQUAL(Tipo::Fijar, c.tipo);
  TEST_ASSERT_EQUAL_STRING("", c.valor);
}

void test_campo_desconocido_o_faltante() {
  TEST_ASSERT_EQUAL(Error::CampoDesconocido, interpretar("set nada x", false).error);
  TEST_ASSERT_EQUAL(Error::CampoDesconocido, interpretar("set", false).error);
  TEST_ASSERT_EQUAL(Error::CampoDesconocido, interpretar("set wifi_ssidd x", false).error);
}

void test_valores_invalidos_se_rechazan_y_no_quedan_en_el_comando() {
  const char* malos[] = {
      "set wifi_ssid",                                       // vacío
      "set wifi_ssid 123456789012345678901234567890123",     // 33 > 32
      "set wifi_clave corta",                                // < 8
      "set api_url http://192.168.1.5:3000",                 // http sin modo desarrollo
      "set api_url ftp://x.com",
      "set api_url https://",
      "set api_url https://a b.com",
      "set api_url acceso.agrocom.com.bo",
      "set disp_id con.punto",
      "set disp_id con espacio",
      "set disp_id",
      "set disp_clave corta",
      "set disp_clave con espacio larga",
      "set disp_clave tab\tdentro1234",
  };
  for (const char* linea : malos) {
    auto c = interpretar(linea, false);
    TEST_ASSERT_EQUAL_MESSAGE(Tipo::Invalido, c.tipo, linea);
    TEST_ASSERT_EQUAL_MESSAGE(Error::ValorInvalido, c.error, linea);
    TEST_ASSERT_EQUAL_STRING("", c.valor);
  }
}

void test_valor_demasiado_largo() {
  char linea[aprovisionamiento::MAX_LINEA];
  memcpy(linea, "set disp_clave ", 15);
  memset(linea + 15, 'a', 200);
  linea[215] = '\0';
  TEST_ASSERT_EQUAL(Tipo::Invalido, interpretar(linea, false).tipo);

  char enorme[aprovisionamiento::MAX_LINEA + 50];
  memset(enorme, 'a', sizeof(enorme) - 1);
  enorme[sizeof(enorme) - 1] = '\0';
  TEST_ASSERT_EQUAL(Tipo::Invalido, interpretar(enorme, false).tipo);
}

void test_http_solo_en_modo_desarrollo() {
  auto dev = interpretar("set api_url http://192.168.1.5:3000", true);
  TEST_ASSERT_EQUAL(Tipo::Fijar, dev.tipo);
  TEST_ASSERT_EQUAL_STRING("http://192.168.1.5:3000", dev.valor);
  TEST_ASSERT_TRUE(urlValida("https://x.com", false));
  TEST_ASSERT_FALSE(urlValida("http://x.com", false));
  TEST_ASSERT_TRUE(urlValida("http://x.com", true));
  TEST_ASSERT_FALSE(urlValida(nullptr, true));
}

void test_autorizacion_tiene_el_formato_del_contrato() {
  char salida[200];
  TEST_ASSERT_TRUE(armarAutorizacion("disp-01", "Clave.Muy-Segura_1", salida, sizeof(salida)));
  TEST_ASSERT_EQUAL_STRING("Dispositivo disp-01.Clave.Muy-Segura_1", salida);
}

void test_autorizacion_rechaza_inyeccion_y_desborde() {
  char salida[200];
  TEST_ASSERT_FALSE(armarAutorizacion("disp\r\nX-Evil: 1", "Clave-Segura-1", salida, sizeof(salida)));
  TEST_ASSERT_FALSE(armarAutorizacion("disp-01", "Clave\r\nX-Evil: 1", salida, sizeof(salida)));
  TEST_ASSERT_FALSE(armarAutorizacion("", "Clave-Segura-1", salida, sizeof(salida)));
  TEST_ASSERT_FALSE(armarAutorizacion("disp-01", "", salida, sizeof(salida)));
  TEST_ASSERT_FALSE(armarAutorizacion(nullptr, nullptr, salida, sizeof(salida)));
  TEST_ASSERT_EQUAL_STRING("", salida);
  char justo[10];
  TEST_ASSERT_FALSE(armarAutorizacion("disp-01", "Clave-Segura-1", justo, sizeof(justo)));
  // Cabe exacto: "Dispositivo " (12) + "a" + "." + 8 + NUL = 23
  char exacto[23];
  TEST_ASSERT_TRUE(armarAutorizacion("a", "12345678", exacto, sizeof(exacto)));
  char falta[22];
  TEST_ASSERT_FALSE(armarAutorizacion("a", "12345678", falta, sizeof(falta)));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_comandos_simples);
  RUN_TEST(test_comando_desconocido);
  RUN_TEST(test_fijar_cada_campo);
  RUN_TEST(test_wifi_abierta_con_clave_vacia);
  RUN_TEST(test_campo_desconocido_o_faltante);
  RUN_TEST(test_valores_invalidos_se_rechazan_y_no_quedan_en_el_comando);
  RUN_TEST(test_valor_demasiado_largo);
  RUN_TEST(test_http_solo_en_modo_desarrollo);
  RUN_TEST(test_autorizacion_tiene_el_formato_del_contrato);
  RUN_TEST(test_autorizacion_rechaza_inyeccion_y_desborde);
  return UNITY_END();
}
