// Vínculo de la placa: cuándo opera, cuándo reclama y qué hace con cada respuesta.
#include <string.h>
#include <unity.h>
#include <vinculo.h>

using respuesta::Reclamo;
using vinculo::Efecto;
using vinculo::Vinculo;

void setUp() {}
void tearDown() {}

static Reclamo pendiente() {
  Reclamo r;
  r.estado = Reclamo::Estado::Pendiente;
  return r;
}

static Reclamo vinculada(const char* id) {
  Reclamo r;
  r.estado = Reclamo::Estado::Vinculado;
  strncpy(r.dispositivoId, id, respuesta::MAX_ID_DISPOSITIVO);
  return r;
}

void test_sin_id_no_opera_y_reclama() {
  Vinculo v(false);
  TEST_ASSERT_FALSE(v.opera());
  TEST_ASSERT_TRUE(v.debeReclamar());
}

void test_con_id_opera_y_no_reclama() {
  Vinculo v(true);
  TEST_ASSERT_TRUE(v.opera());
  TEST_ASSERT_FALSE(v.debeReclamar());
}

void test_pendiente_sin_id_sigue_esperando() {
  Vinculo v(false);
  TEST_ASSERT_EQUAL(Efecto::Nada, v.alReclamar(pendiente(), false));
  TEST_ASSERT_FALSE(v.opera());
  TEST_ASSERT_TRUE(v.debeReclamar());
}

void test_vinculada_guarda_el_id_y_pasa_a_operar() {
  Vinculo v(false);
  TEST_ASSERT_EQUAL(Efecto::GuardarId, v.alReclamar(vinculada("12"), false));
  TEST_ASSERT_TRUE(v.opera());
  TEST_ASSERT_FALSE(v.debeReclamar());
}

void test_un_401_detiene_la_operacion_y_pide_reclamar() {
  Vinculo v(true);
  v.alRechazarCredencial();
  TEST_ASSERT_FALSE(v.opera());  // falla segura: sin credencial válida no se valida
  TEST_ASSERT_TRUE(v.debeReclamar());
}

void test_401_sin_id_no_cambia_nada() {
  Vinculo v(false);
  v.alRechazarCredencial();
  TEST_ASSERT_FALSE(v.opera());
  TEST_ASSERT_EQUAL(Efecto::GuardarId, v.alReclamar(vinculada("7"), false));
  TEST_ASSERT_TRUE(v.opera());
}

void test_tras_un_401_pasajero_retoma_con_el_mismo_id() {
  // Cuenta suspendida y reactivada: el dispositivo sigue en servicio y la clave coincide.
  Vinculo v(true);
  v.alRechazarCredencial();
  TEST_ASSERT_EQUAL(Efecto::Nada, v.alReclamar(vinculada("12"), true));
  TEST_ASSERT_TRUE(v.opera());
}

void test_tras_un_401_liberada_olvida_el_vinculo() {
  Vinculo v(true);
  v.alRechazarCredencial();
  TEST_ASSERT_EQUAL(Efecto::OlvidarVinculo, v.alReclamar(pendiente(), false));
  TEST_ASSERT_FALSE(v.opera());
  TEST_ASSERT_TRUE(v.debeReclamar());
  // Y cuando AGROCOM la vincula a otra puerta, recibe un id nuevo.
  TEST_ASSERT_EQUAL(Efecto::GuardarId, v.alReclamar(vinculada("99"), false));
  TEST_ASSERT_TRUE(v.opera());
}

void test_tras_un_401_reasignada_guarda_el_id_nuevo() {
  Vinculo v(true);
  v.alRechazarCredencial();
  TEST_ASSERT_EQUAL(Efecto::GuardarId, v.alReclamar(vinculada("99"), false));
  TEST_ASSERT_TRUE(v.opera());
}

void test_una_respuesta_invalida_no_cambia_el_estado() {
  Vinculo v(true);
  v.alRechazarCredencial();
  Reclamo mala;  // Invalido (401, 429, red caída, JSON roto)
  TEST_ASSERT_EQUAL(Efecto::Nada, v.alReclamar(mala, false));
  TEST_ASSERT_FALSE(v.opera());
  TEST_ASSERT_TRUE(v.debeReclamar());

  Vinculo sin(false);
  TEST_ASSERT_EQUAL(Efecto::Nada, sin.alReclamar(mala, false));
  TEST_ASSERT_FALSE(sin.opera());
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_sin_id_no_opera_y_reclama);
  RUN_TEST(test_con_id_opera_y_no_reclama);
  RUN_TEST(test_pendiente_sin_id_sigue_esperando);
  RUN_TEST(test_vinculada_guarda_el_id_y_pasa_a_operar);
  RUN_TEST(test_un_401_detiene_la_operacion_y_pide_reclamar);
  RUN_TEST(test_401_sin_id_no_cambia_nada);
  RUN_TEST(test_tras_un_401_pasajero_retoma_con_el_mismo_id);
  RUN_TEST(test_tras_un_401_liberada_olvida_el_vinculo);
  RUN_TEST(test_tras_un_401_reasignada_guarda_el_id_nuevo);
  RUN_TEST(test_una_respuesta_invalida_no_cambia_el_estado);
  return UNITY_END();
}
