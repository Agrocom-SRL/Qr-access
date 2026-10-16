// Falla segura de la puerta (invariante 2, prioridad 2 de cobertura).
#include <puerta.h>
#include <string.h>
#include <unity.h>

using puerta::Estado;
using puerta::Indicacion;
using puerta::Maquina;
using puerta::Motivo;
using puerta::Resultado;

static const char* QR = "AQ1.abcdefghijklmnopqrstuv";

void setUp() {}
void tearDown() {}

static Maquina validando(uint32_t ahora = 1000) {
  Maquina m;
  m.alLeer(QR, ahora);
  return m;
}

void test_lectura_pide_validacion_y_no_abre() {
  Maquina m;
  auto a = m.alLeer(QR, 1000);
  TEST_ASSERT_TRUE(a.enviarValidacion);
  TEST_ASSERT_FALSE(a.activarCerradura);
  TEST_ASSERT_FALSE(m.cerraduraActiva());
  TEST_ASSERT_EQUAL_STRING(QR, m.qr());
}

void test_respuesta_positiva_abre_el_tiempo_pedido() {
  auto m = validando();
  auto a = m.alResponder(m.idValidacion(), Resultado::permitido(3), 1200);
  TEST_ASSERT_TRUE(a.activarCerradura);
  TEST_ASSERT_EQUAL_UINT32(3000, a.msApertura);
  TEST_ASSERT_TRUE(m.cerraduraActiva());
  TEST_ASSERT_EQUAL(Indicacion::Permitido, a.indicacion);
}

void test_rechazo_no_abre() {
  auto m = validando();
  auto a = m.alResponder(m.idValidacion(), Resultado::denegado(Motivo::QrVencido), 1200);
  TEST_ASSERT_FALSE(a.activarCerradura);
  TEST_ASSERT_FALSE(m.cerraduraActiva());
  TEST_ASSERT_EQUAL(Indicacion::Denegado, a.indicacion);
}

void test_respuesta_invalida_no_abre_aunque_diga_abrir() {
  auto m = validando();
  auto a = m.alResponder(m.idValidacion(), Resultado{false, true, 3, Motivo::RespuestaInvalida}, 1200);
  TEST_ASSERT_FALSE(a.activarCerradura);
  TEST_ASSERT_EQUAL(Indicacion::Error, a.indicacion);
}

void test_abrir_con_cero_segundos_no_abre() {
  auto m = validando();
  auto a = m.alResponder(m.idValidacion(), Resultado::permitido(0), 1200);
  TEST_ASSERT_FALSE(a.activarCerradura);
  TEST_ASSERT_FALSE(m.cerraduraActiva());
}

void test_respuesta_sin_validacion_en_curso_no_abre() {
  Maquina m;
  auto a = m.alResponder(m.idValidacion(), Resultado::permitido(3), 1000);
  TEST_ASSERT_FALSE(a.activarCerradura);
  TEST_ASSERT_FALSE(m.cerraduraActiva());
}

void test_timeout_vuelve_a_reposo_y_la_respuesta_tardia_no_abre() {
  auto m = validando(1000);
  auto a = m.tick(1000 + puerta::TIMEOUT_VALIDACION_MS);
  TEST_ASSERT_EQUAL(Estado::Reposo, m.estado());
  TEST_ASSERT_EQUAL(Indicacion::Error, a.indicacion);
  auto tardia = m.alResponder(m.idValidacion(), Resultado::permitido(3), 5000);
  TEST_ASSERT_FALSE(tardia.activarCerradura);
  TEST_ASSERT_FALSE(m.cerraduraActiva());
}

void test_apertura_se_limita_al_maximo() {
  auto m = validando();
  auto a = m.alResponder(m.idValidacion(), Resultado::permitido(600), 1200);
  TEST_ASSERT_EQUAL_UINT32(puerta::APERTURA_POR_DEFECTO_S * 1000U, a.msApertura);
}

void test_el_tope_configurado_nunca_supera_el_duro() {
  Maquina m;
  m.fijarMaxAperturaS(600);
  TEST_ASSERT_EQUAL_UINT16(puerta::MAX_APERTURA_S, m.maxAperturaS());
  m.fijarMaxAperturaS(0);
  TEST_ASSERT_EQUAL_UINT16(1, m.maxAperturaS());
  m.fijarMaxAperturaS(7);
  m.alLeer(QR, 1000);
  auto a = m.alResponder(m.idValidacion(), Resultado::permitido(9), 1100);
  TEST_ASSERT_EQUAL_UINT32(7000, a.msApertura);
}

void test_el_pulsador_respeta_el_tope_configurado() {
  Maquina m;
  m.fijarMaxAperturaS(2);
  TEST_ASSERT_EQUAL_UINT32(2000, m.alPulsarSalida(1000).msApertura);
}

void test_respuesta_de_una_lectura_anterior_no_abre() {
  Maquina m;
  m.alLeer(QR, 1000);
  const uint32_t idViejo = m.idValidacion();
  m.tick(1000 + puerta::TIMEOUT_VALIDACION_MS);  // vence sin respuesta
  m.alLeer("AQ1.otroqrotroqrotroqrot", 5000);    // segunda lectura en curso
  TEST_ASSERT_TRUE(m.idValidacion() != idViejo);
  auto a = m.alResponder(idViejo, Resultado::permitido(3), 5100);
  TEST_ASSERT_FALSE(a.activarCerradura);
  TEST_ASSERT_FALSE(m.cerraduraActiva());
  TEST_ASSERT_EQUAL(puerta::Estado::Validando, m.estado());
  // La respuesta de la lectura vigente si abre.
  TEST_ASSERT_TRUE(m.alResponder(m.idValidacion(), Resultado::permitido(3), 5200).activarCerradura);
}

void test_una_respuesta_se_usa_una_sola_vez() {
  auto m = validando();
  const uint32_t id = m.idValidacion();
  TEST_ASSERT_TRUE(m.alResponder(id, Resultado::permitido(3), 1100).activarCerradura);
  m.tick(1100 + 3000);
  TEST_ASSERT_FALSE(m.alResponder(id, Resultado::permitido(3), 4200).activarCerradura);
  TEST_ASSERT_FALSE(m.cerraduraActiva());
}

void test_doble_lectura_con_la_puerta_abierta_no_reabre() {
  auto m = validando(1000);
  m.alResponder(m.idValidacion(), Resultado::permitido(3), 1100);
  TEST_ASSERT_FALSE(m.alLeer(QR, 1200).enviarValidacion);
  TEST_ASSERT_FALSE(m.alLeer("AQ1.otroqrotroqrotroqrot", 1300).enviarValidacion);
}

void test_indicacion_segun_el_tipo_de_fallo() {
  auto m = validando();
  auto sinRed = m.alResponder(m.idValidacion(), Resultado::invalido(Motivo::SinRed), 1100);
  TEST_ASSERT_EQUAL(Indicacion::SinRed, sinRed.indicacion);
  TEST_ASSERT_FALSE(sinRed.activarCerradura);

  auto m2 = validando();
  auto credencial =
      m2.alResponder(m2.idValidacion(), Resultado::invalido(Motivo::CredencialInvalida), 1100);
  TEST_ASSERT_EQUAL(Indicacion::Error, credencial.indicacion);
  TEST_ASSERT_FALSE(credencial.activarCerradura);
}

void test_un_resultado_contradictorio_no_abre() {
  // valida=false con abrir=true: nunca abre, aunque el motivo diga otra cosa.
  auto m = validando();
  auto a = m.alResponder(m.idValidacion(), Resultado{false, true, 5, Motivo::Permitido}, 1100);
  TEST_ASSERT_FALSE(a.activarCerradura);
}

void test_el_pulso_termina_solo() {
  auto m = validando();
  m.alResponder(m.idValidacion(), Resultado::permitido(3), 1000);
  TEST_ASSERT_FALSE(m.tick(3999).desactivarCerradura);
  TEST_ASSERT_TRUE(m.tick(4000).desactivarCerradura);
  TEST_ASSERT_FALSE(m.cerraduraActiva());
}

void test_lecturas_durante_validacion_o_apertura_se_ignoran() {
  auto m = validando();
  TEST_ASSERT_FALSE(m.alLeer("AQ1.otroqrotroqrotroqrot", 1100).enviarValidacion);
  m.alResponder(m.idValidacion(), Resultado::permitido(3), 1200);
  TEST_ASSERT_FALSE(m.alLeer("AQ1.otroqrotroqrotroqrot", 1300).enviarValidacion);
}

void test_mismo_qr_inmediato_se_ignora_y_luego_se_acepta() {
  auto m = validando(1000);
  m.alResponder(m.idValidacion(), Resultado::denegado(Motivo::QrVencido), 1100);
  TEST_ASSERT_FALSE(m.alLeer(QR, 1500).enviarValidacion);
  TEST_ASSERT_TRUE(m.alLeer(QR, 1000 + puerta::ANTIRREBOTE_MISMO_QR_MS).enviarValidacion);
}

void test_linea_vacia_o_demasiado_larga_se_descarta() {
  Maquina m;
  TEST_ASSERT_FALSE(m.alLeer("", 1000).enviarValidacion);
  TEST_ASSERT_FALSE(m.alLeer(nullptr, 1000).enviarValidacion);
  char larga[puerta::MAX_QR + 2];
  memset(larga, 'a', sizeof(larga) - 1);
  larga[sizeof(larga) - 1] = '\0';
  TEST_ASSERT_FALSE(m.alLeer(larga, 1000).enviarValidacion);
  TEST_ASSERT_EQUAL(Estado::Reposo, m.estado());
}

void test_pulsador_abre_sin_red() {
  Maquina m;
  auto a = m.alPulsarSalida(1000);
  TEST_ASSERT_TRUE(a.activarCerradura);
  TEST_ASSERT_EQUAL_UINT32(puerta::APERTURA_PULSADOR_S * 1000U, a.msApertura);
}

void test_pulsador_durante_validacion_descarta_la_respuesta() {
  auto m = validando();
  m.alPulsarSalida(1100);
  m.tick(1100 + puerta::APERTURA_PULSADOR_S * 1000U);
  auto a = m.alResponder(m.idValidacion(), Resultado::permitido(5), 4200);
  TEST_ASSERT_FALSE(a.activarCerradura);
  TEST_ASSERT_FALSE(m.cerraduraActiva());
}

void test_desborde_de_millis() {
  const uint32_t casiDesborde = 0xFFFFFFFFu - 500;
  auto m = validando(casiDesborde);
  m.alResponder(m.idValidacion(), Resultado::permitido(1), casiDesborde);
  TEST_ASSERT_FALSE(m.tick(casiDesborde + 999).desactivarCerradura);
  TEST_ASSERT_TRUE(m.tick(casiDesborde + 1000).desactivarCerradura);
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_lectura_pide_validacion_y_no_abre);
  RUN_TEST(test_respuesta_positiva_abre_el_tiempo_pedido);
  RUN_TEST(test_rechazo_no_abre);
  RUN_TEST(test_respuesta_invalida_no_abre_aunque_diga_abrir);
  RUN_TEST(test_abrir_con_cero_segundos_no_abre);
  RUN_TEST(test_respuesta_sin_validacion_en_curso_no_abre);
  RUN_TEST(test_timeout_vuelve_a_reposo_y_la_respuesta_tardia_no_abre);
  RUN_TEST(test_apertura_se_limita_al_maximo);
  RUN_TEST(test_el_tope_configurado_nunca_supera_el_duro);
  RUN_TEST(test_el_pulsador_respeta_el_tope_configurado);
  RUN_TEST(test_respuesta_de_una_lectura_anterior_no_abre);
  RUN_TEST(test_una_respuesta_se_usa_una_sola_vez);
  RUN_TEST(test_doble_lectura_con_la_puerta_abierta_no_reabre);
  RUN_TEST(test_indicacion_segun_el_tipo_de_fallo);
  RUN_TEST(test_un_resultado_contradictorio_no_abre);
  RUN_TEST(test_el_pulso_termina_solo);
  RUN_TEST(test_lecturas_durante_validacion_o_apertura_se_ignoran);
  RUN_TEST(test_mismo_qr_inmediato_se_ignora_y_luego_se_acepta);
  RUN_TEST(test_linea_vacia_o_demasiado_larga_se_descarta);
  RUN_TEST(test_pulsador_abre_sin_red);
  RUN_TEST(test_pulsador_durante_validacion_descarta_la_respuesta);
  RUN_TEST(test_desborde_de_millis);
  return UNITY_END();
}
