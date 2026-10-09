// Temporizadores sobre un reloj manual: nada depende de millis().
#include <temporizador.h>
#include <unity.h>

using namespace temporizador;

class RelojManual : public Reloj {
 public:
  uint32_t ahoraMs() const override { return ahora; }
  uint32_t ahora = 0;
};

void setUp() {}
void tearDown() {}

void test_periodico_dispara_una_vez_por_periodo() {
  RelojManual reloj;
  Periodico p(reloj, 60000, false);
  TEST_ASSERT_FALSE(p.vencio());
  reloj.ahora = 59999;
  TEST_ASSERT_FALSE(p.vencio());
  reloj.ahora = 60000;
  TEST_ASSERT_TRUE(p.vencio());
  TEST_ASSERT_FALSE(p.vencio());
  reloj.ahora = 119999;
  TEST_ASSERT_FALSE(p.vencio());
  reloj.ahora = 120000;
  TEST_ASSERT_TRUE(p.vencio());
}

void test_periodico_inmediato_y_adelantar() {
  RelojManual reloj;
  Periodico p(reloj, 60000, true);
  TEST_ASSERT_TRUE(p.vencio());
  TEST_ASSERT_FALSE(p.vencio());
  p.adelantar();
  TEST_ASSERT_TRUE(p.vencio());
  TEST_ASSERT_FALSE(p.vencio());
}

void test_periodico_tras_una_pausa_larga_dispara_una_sola_vez() {
  RelojManual reloj;
  Periodico p(reloj, 1000, false);
  reloj.ahora = 10000;
  TEST_ASSERT_TRUE(p.vencio());
  TEST_ASSERT_FALSE(p.vencio());
}

void test_periodico_tolera_el_desborde() {
  RelojManual reloj;
  reloj.ahora = 0xFFFFFFFFu - 100;
  Periodico p(reloj, 1000, false);
  reloj.ahora = 0xFFFFFFFFu;
  TEST_ASSERT_FALSE(p.vencio());
  reloj.ahora = 898;  // 999 ms despues, ya del otro lado del cero
  TEST_ASSERT_FALSE(p.vencio());
  reloj.ahora = 899;  // 1000 ms despues
  TEST_ASSERT_TRUE(p.vencio());
}

void test_backoff_duplica_hasta_el_maximo_y_se_reinicia() {
  RelojManual reloj;
  Backoff b(reloj, 1000, 5000);
  TEST_ASSERT_TRUE(b.toca());  // sin fallos previos
  b.fallo();
  TEST_ASSERT_EQUAL_UINT32(1000, b.esperaActualMs());
  TEST_ASSERT_FALSE(b.toca());
  reloj.ahora = 1000;
  TEST_ASSERT_TRUE(b.toca());
  b.fallo();
  TEST_ASSERT_EQUAL_UINT32(2000, b.esperaActualMs());
  reloj.ahora = 2999;
  TEST_ASSERT_FALSE(b.toca());
  reloj.ahora = 3000;
  b.fallo();
  TEST_ASSERT_EQUAL_UINT32(4000, b.esperaActualMs());
  reloj.ahora = 7000;
  b.fallo();
  TEST_ASSERT_EQUAL_UINT32(5000, b.esperaActualMs());  // tope
  reloj.ahora = 12000;
  b.fallo();
  TEST_ASSERT_EQUAL_UINT32(5000, b.esperaActualMs());
  b.exito();
  TEST_ASSERT_TRUE(b.toca());
  b.fallo();
  TEST_ASSERT_EQUAL_UINT32(1000, b.esperaActualMs());
}

void test_tarea_nace_vencida_y_se_repite_cada_periodo() {
  RelojManual reloj;
  Tarea t(reloj, 300000, 5000);
  TEST_ASSERT_TRUE(t.toca());
  t.terminada(true);
  TEST_ASSERT_FALSE(t.toca());
  reloj.ahora = 299999;
  TEST_ASSERT_FALSE(t.toca());
  reloj.ahora = 300000;
  TEST_ASSERT_TRUE(t.toca());
}

void test_tarea_reintenta_con_backoff_si_falla() {
  RelojManual reloj;
  Tarea t(reloj, 300000, 5000);
  TEST_ASSERT_TRUE(t.toca());
  t.terminada(false);
  reloj.ahora = 4999;
  TEST_ASSERT_FALSE(t.toca());
  reloj.ahora = 5000;
  TEST_ASSERT_TRUE(t.toca());
  t.terminada(false);
  reloj.ahora = 14999;  // la 2.ª espera es de 10 s
  TEST_ASSERT_FALSE(t.toca());
  reloj.ahora = 15000;
  TEST_ASSERT_TRUE(t.toca());
  t.terminada(true);  // vuelve al periodo normal
  reloj.ahora = 15000 + 299999;
  TEST_ASSERT_FALSE(t.toca());
  reloj.ahora = 15000 + 300000;
  TEST_ASSERT_TRUE(t.toca());
}

void test_tarea_no_se_traba_si_nunca_termina() {
  RelojManual reloj;
  Tarea t(reloj, 300000, 5000);
  TEST_ASSERT_TRUE(t.toca());  // nadie llama a terminada()
  reloj.ahora = 5000;
  TEST_ASSERT_TRUE(t.toca());
}

void test_tarea_el_reintento_no_supera_el_periodo() {
  RelojManual reloj;
  Tarea t(reloj, 20000, 5000);
  TEST_ASSERT_TRUE(t.toca());
  uint32_t espera = 0;
  for (int i = 0; i < 6; ++i) {
    t.terminada(false);
    uint32_t antes = reloj.ahora;
    while (!t.toca()) reloj.ahora += 1000;
    espera = reloj.ahora - antes;
  }
  TEST_ASSERT_EQUAL_UINT32(20000, espera);
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_periodico_dispara_una_vez_por_periodo);
  RUN_TEST(test_periodico_inmediato_y_adelantar);
  RUN_TEST(test_periodico_tras_una_pausa_larga_dispara_una_sola_vez);
  RUN_TEST(test_periodico_tolera_el_desborde);
  RUN_TEST(test_backoff_duplica_hasta_el_maximo_y_se_reinicia);
  RUN_TEST(test_tarea_nace_vencida_y_se_repite_cada_periodo);
  RUN_TEST(test_tarea_reintenta_con_backoff_si_falla);
  RUN_TEST(test_tarea_no_se_traba_si_nunca_termina);
  RUN_TEST(test_tarea_el_reintento_no_supera_el_periodo);
  return UNITY_END();
}
