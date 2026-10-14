// Vínculo de la placa: cuándo opera, cuándo anuncia y qué hace con cada respuesta.
#include <string.h>
#include <unity.h>
#include <vinculo.h>

using respuesta::Anuncio;
using vinculo::Efecto;
using vinculo::Vinculo;

void setUp() {}
void tearDown() {}

static Anuncio detectada() {
  Anuncio r;
  r.estado = Anuncio::Estado::Detectada;
  return r;
}

static Anuncio confirmar() {
  Anuncio r;
  r.estado = Anuncio::Estado::Confirmar;
  return r;
}

static Anuncio vinculada(const char* id) {
  Anuncio r;
  r.estado = Anuncio::Estado::Vinculado;
  strncpy(r.dispositivoId, id, respuesta::MAX_ID_DISPOSITIVO);
  return r;
}

void test_sin_id_no_opera_y_anuncia() {
  Vinculo v(false);
  TEST_ASSERT_FALSE(v.opera());
  TEST_ASSERT_TRUE(v.debeAnunciar());
}

void test_con_id_opera_y_no_anuncia() {
  Vinculo v(true);
  TEST_ASSERT_TRUE(v.opera());
  TEST_ASSERT_FALSE(v.debeAnunciar());
}

void test_detectada_sin_id_sigue_esperando() {
  Vinculo v(false);
  TEST_ASSERT_EQUAL(Efecto::Nada, v.alAnunciar(detectada(), false));
  TEST_ASSERT_FALSE(v.opera());
  TEST_ASSERT_TRUE(v.debeAnunciar());
}

void test_vinculada_guarda_el_id_y_pasa_a_operar() {
  Vinculo v(false);
  TEST_ASSERT_EQUAL(Efecto::GuardarId, v.alAnunciar(vinculada("12"), false));
  TEST_ASSERT_TRUE(v.opera());
  TEST_ASSERT_FALSE(v.debeAnunciar());
}

void test_un_401_detiene_la_operacion_y_pide_anunciar() {
  Vinculo v(true);
  v.alRechazarCredencial();
  TEST_ASSERT_FALSE(v.opera());  // falla segura: sin credencial válida no se valida
  TEST_ASSERT_TRUE(v.debeAnunciar());
}

void test_401_sin_id_no_cambia_nada() {
  Vinculo v(false);
  v.alRechazarCredencial();
  TEST_ASSERT_FALSE(v.opera());
  TEST_ASSERT_EQUAL(Efecto::GuardarId, v.alAnunciar(vinculada("7"), false));
  TEST_ASSERT_TRUE(v.opera());
}

void test_tras_un_401_pasajero_retoma_con_el_mismo_id() {
  // Cuenta suspendida y reactivada: el dispositivo sigue en servicio y la clave coincide.
  Vinculo v(true);
  v.alRechazarCredencial();
  TEST_ASSERT_EQUAL(Efecto::Nada, v.alAnunciar(vinculada("12"), true));
  TEST_ASSERT_TRUE(v.opera());
}

void test_tras_un_401_liberada_olvida_el_vinculo() {
  Vinculo v(true);
  v.alRechazarCredencial();
  TEST_ASSERT_EQUAL(Efecto::OlvidarVinculo, v.alAnunciar(detectada(), false));
  TEST_ASSERT_FALSE(v.opera());
  TEST_ASSERT_TRUE(v.debeAnunciar());
  // Y cuando AGROCOM la vincula a otra puerta, recibe un id nuevo.
  TEST_ASSERT_EQUAL(Efecto::GuardarId, v.alAnunciar(vinculada("99"), false));
  TEST_ASSERT_TRUE(v.opera());
}

void test_tras_un_401_reasignada_guarda_el_id_nuevo() {
  Vinculo v(true);
  v.alRechazarCredencial();
  TEST_ASSERT_EQUAL(Efecto::GuardarId, v.alAnunciar(vinculada("99"), false));
  TEST_ASSERT_TRUE(v.opera());
}

void test_una_respuesta_invalida_no_cambia_el_estado() {
  Vinculo v(true);
  v.alRechazarCredencial();
  Anuncio mala;  // Invalido (401, 429, red caída, JSON roto)
  TEST_ASSERT_EQUAL(Efecto::Nada, v.alAnunciar(mala, false));
  TEST_ASSERT_FALSE(v.opera());
  TEST_ASSERT_TRUE(v.debeAnunciar());

  Vinculo sin(false);
  TEST_ASSERT_EQUAL(Efecto::Nada, sin.alAnunciar(mala, false));
  TEST_ASSERT_FALSE(sin.opera());
}

void test_confirmar_sin_id_espera_la_pulsacion() {
  Vinculo v(false);
  TEST_ASSERT_FALSE(v.esperaConfirmacion());
  TEST_ASSERT_EQUAL(Efecto::Nada, v.alAnunciar(confirmar(), false));
  TEST_ASSERT_TRUE(v.esperaConfirmacion());
  TEST_ASSERT_FALSE(v.opera());  // falla segura: esperar el botón no abre nada
}

void test_la_espera_termina_si_el_servidor_ya_no_la_pide() {
  Vinculo v(false);
  v.alAnunciar(confirmar(), false);
  v.alAnunciar(detectada(), false);  // se venció la ventana o la cancelaron
  TEST_ASSERT_FALSE(v.esperaConfirmacion());
  v.alAnunciar(confirmar(), false);
  Anuncio mala;
  v.alAnunciar(mala, false);  // sin red no se confirma a ciegas
  TEST_ASSERT_FALSE(v.esperaConfirmacion());
}

void test_al_vincularse_deja_de_esperar() {
  Vinculo v(false);
  v.alAnunciar(confirmar(), false);
  TEST_ASSERT_EQUAL(Efecto::GuardarId, v.alAnunciar(vinculada("5"), false));
  TEST_ASSERT_FALSE(v.esperaConfirmacion());
  TEST_ASSERT_TRUE(v.opera());
}

void test_liberada_y_con_confirmar_olvida_el_vinculo() {
  Vinculo v(true);
  v.alRechazarCredencial();
  TEST_ASSERT_EQUAL(Efecto::OlvidarVinculo, v.alAnunciar(confirmar(), false));
  TEST_ASSERT_TRUE(v.esperaConfirmacion());
  TEST_ASSERT_FALSE(v.opera());
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_sin_id_no_opera_y_anuncia);
  RUN_TEST(test_con_id_opera_y_no_anuncia);
  RUN_TEST(test_detectada_sin_id_sigue_esperando);
  RUN_TEST(test_vinculada_guarda_el_id_y_pasa_a_operar);
  RUN_TEST(test_un_401_detiene_la_operacion_y_pide_anunciar);
  RUN_TEST(test_401_sin_id_no_cambia_nada);
  RUN_TEST(test_tras_un_401_pasajero_retoma_con_el_mismo_id);
  RUN_TEST(test_tras_un_401_liberada_olvida_el_vinculo);
  RUN_TEST(test_tras_un_401_reasignada_guarda_el_id_nuevo);
  RUN_TEST(test_una_respuesta_invalida_no_cambia_el_estado);
  RUN_TEST(test_confirmar_sin_id_espera_la_pulsacion);
  RUN_TEST(test_la_espera_termina_si_el_servidor_ya_no_la_pide);
  RUN_TEST(test_al_vincularse_deja_de_esperar);
  RUN_TEST(test_liberada_y_con_confirmar_olvida_el_vinculo);
  return UNITY_END();
}
