// Entrega de informes con reintentos: espera creciente, solo ante red/429/5xx, un informe por apertura.
#include <entrega.h>
#include <string.h>
#include <unity.h>

using namespace confirmacion;

void setUp() {}
void tearDown() {}

static Informe informe(const char* id, Resultado r = Resultado::Ejecutada) {
  Informe i;
  strncpy(i.eventoId, id, MAX_EVENTO_ID);
  i.resultado = r;
  return i;
}

// Envía el informe que toque en `ahora` y devuelve su id (o "" si no tocaba ninguno).
static const char* enviarSiToca(Entregas& e, uint32_t ahora) {
  const Informe* i = e.debeEnviar(ahora);
  if (i == nullptr) return "";
  e.enviado(i->eventoId, ahora);
  return i->eventoId;
}

void test_clasificacion_de_codigos() {
  TEST_ASSERT_TRUE(reintentable(-1));
  TEST_ASSERT_TRUE(reintentable(0));
  TEST_ASSERT_TRUE(reintentable(429));
  TEST_ASSERT_TRUE(reintentable(500));
  TEST_ASSERT_TRUE(reintentable(503));
  TEST_ASSERT_FALSE(reintentable(204));
  TEST_ASSERT_FALSE(reintentable(400));
  TEST_ASSERT_FALSE(reintentable(401));
  TEST_ASSERT_FALSE(reintentable(404));
  TEST_ASSERT_FALSE(reintentable(409));
  TEST_ASSERT_TRUE(entregado(204));
  TEST_ASSERT_TRUE(entregado(200));
  TEST_ASSERT_FALSE(entregado(404));
  TEST_ASSERT_FALSE(entregado(-1));
}

void test_204_lo_da_por_entregado_y_no_se_vuelve_a_enviar() {
  Entregas e;
  TEST_ASSERT_TRUE(e.agregar(informe("42"), 0));
  TEST_ASSERT_EQUAL_STRING("42", enviarSiToca(e, 100));
  e.alResponder("42", 204, 200);
  TEST_ASSERT_EQUAL(0, e.pendientes());
  TEST_ASSERT_EQUAL_STRING("", enviarSiToca(e, 1000000));
}

void test_un_solo_informe_por_apertura() {
  Entregas e;
  TEST_ASSERT_TRUE(e.agregar(informe("42"), 0));
  TEST_ASSERT_FALSE(e.agregar(informe("42", Resultado::Fallida), 10));
  TEST_ASSERT_EQUAL(1, e.pendientes());
  TEST_ASSERT_FALSE(e.agregar(informe("no-es-id"), 10));
  TEST_ASSERT_EQUAL(1, e.pendientes());
}

void test_sin_red_reintenta_con_espera_creciente() {
  Entregas e;
  e.agregar(informe("42"), 0);
  uint32_t t = 0;
  const uint32_t esperas[] = {5000, 10000, 20000, 40000, 80000, 120000, 120000};
  for (uint32_t espera : esperas) {
    TEST_ASSERT_EQUAL_STRING("42", enviarSiToca(e, t));
    e.alResponder("42", -1, t + 10);
    t += 10;
    // Un instante antes de la espera no toca; al cumplirse, sí.
    TEST_ASSERT_EQUAL_STRING("", enviarSiToca(e, t + espera - 1));
    t += espera;
  }
  TEST_ASSERT_EQUAL(1, e.pendientes());
}

void test_esperaTras_crece_y_se_topa() {
  TEST_ASSERT_EQUAL_UINT32(5000, Entregas::esperaTras(1));
  TEST_ASSERT_EQUAL_UINT32(10000, Entregas::esperaTras(2));
  TEST_ASSERT_EQUAL_UINT32(20000, Entregas::esperaTras(3));
  TEST_ASSERT_EQUAL_UINT32(ESPERA_MAXIMA_MS, Entregas::esperaTras(10));
  TEST_ASSERT_EQUAL_UINT32(ESPERA_MAXIMA_MS, Entregas::esperaTras(255));
}

void test_429_y_5xx_reintentan() {
  Entregas e;
  e.agregar(informe("1"), 0);
  enviarSiToca(e, 0);
  e.alResponder("1", 429, 10);
  TEST_ASSERT_EQUAL(1, e.pendientes());
  TEST_ASSERT_EQUAL_STRING("1", enviarSiToca(e, 10 + 5000));
  e.alResponder("1", 503, 5100);
  TEST_ASSERT_EQUAL(1, e.pendientes());
  TEST_ASSERT_EQUAL_STRING("", enviarSiToca(e, 5100 + 9999));
  TEST_ASSERT_EQUAL_STRING("1", enviarSiToca(e, 5100 + 10000));
}

void test_otro_4xx_se_descarta_sin_reintentar() {
  const int codigos[] = {400, 401, 404, 409};
  for (int codigo : codigos) {
    Entregas e;
    e.agregar(informe("1"), 0);
    enviarSiToca(e, 0);
    e.alResponder("1", codigo, 10);
    TEST_ASSERT_EQUAL(0, e.pendientes());
    TEST_ASSERT_EQUAL_STRING("", enviarSiToca(e, 1000000));
  }
}

void test_pasado_el_plazo_se_descarta() {
  Entregas e;
  e.agregar(informe("1"), 1000);
  enviarSiToca(e, 1000);
  e.alResponder("1", -1, 1010);
  TEST_ASSERT_TRUE(e.debeEnviar(1000 + PLAZO_ENTREGA_MS - 1) != nullptr);  // aún en plazo
  TEST_ASSERT_EQUAL(1, e.pendientes());
  TEST_ASSERT_TRUE(e.debeEnviar(1000 + PLAZO_ENTREGA_MS) == nullptr);
  TEST_ASSERT_EQUAL(0, e.pendientes());
}

void test_envio_sin_respuesta_se_da_por_fallido_y_se_reintenta() {
  Entregas e;
  e.agregar(informe("1"), 0);
  TEST_ASSERT_EQUAL_STRING("1", enviarSiToca(e, 0));
  // En vuelo no se pide otro envío.
  TEST_ASSERT_EQUAL_STRING("", enviarSiToca(e, VENCE_ENVIO_MS - 1));
  // Nunca contestó: fallo, espera inicial, y vuelve a tocar.
  TEST_ASSERT_EQUAL_STRING("", enviarSiToca(e, VENCE_ENVIO_MS));
  TEST_ASSERT_EQUAL_STRING("1", enviarSiToca(e, VENCE_ENVIO_MS + ESPERA_INICIAL_MS));
}

void test_de_a_uno_en_vuelo_y_en_orden() {
  Entregas e;
  e.agregar(informe("1"), 0);
  e.agregar(informe("2"), 0);
  TEST_ASSERT_EQUAL_STRING("1", enviarSiToca(e, 0));
  TEST_ASSERT_EQUAL_STRING("", enviarSiToca(e, 1));  // el 1 sigue en vuelo
  e.alResponder("1", 204, 2);
  TEST_ASSERT_EQUAL_STRING("2", enviarSiToca(e, 3));
}

void test_un_informe_que_falla_no_traba_a_los_demas() {
  Entregas e;
  e.agregar(informe("1"), 0);
  e.agregar(informe("2"), 0);
  enviarSiToca(e, 0);
  e.alResponder("1", -1, 5);
  TEST_ASSERT_EQUAL_STRING("2", enviarSiToca(e, 6));  // el 1 espera su turno; el 2 sale ya
}

void test_cola_llena_pierde_el_mas_viejo() {
  Entregas e;
  e.agregar(informe("1"), 0);
  e.agregar(informe("2"), 0);
  e.agregar(informe("3"), 0);
  e.agregar(informe("4"), 0);
  TEST_ASSERT_EQUAL(CAPACIDAD_ENTREGAS, e.pendientes());
  TEST_ASSERT_TRUE(e.agregar(informe("5"), 0));
  TEST_ASSERT_EQUAL(CAPACIDAD_ENTREGAS, e.pendientes());
  TEST_ASSERT_EQUAL_STRING("2", enviarSiToca(e, 0));  // el 1 se perdió
}

void test_respuesta_de_un_evento_desconocido_se_ignora() {
  Entregas e;
  e.agregar(informe("1"), 0);
  e.alResponder("99", 204, 0);
  TEST_ASSERT_EQUAL(1, e.pendientes());
}

void test_si_no_se_pudo_encolar_sigue_tocando() {
  Entregas e;
  e.agregar(informe("1"), 0);
  // La tarea de red estaba llena: no se llama a enviado() y el informe sigue disponible.
  TEST_ASSERT_TRUE(e.debeEnviar(0) != nullptr);
  TEST_ASSERT_TRUE(e.debeEnviar(1) != nullptr);
}

static Informe informeManual(const char* id) {
  Informe i = informe(id);
  i.manual = true;
  return i;
}

void test_el_id_de_una_orden_no_se_confunde_con_el_de_un_evento() {
  // Un id de orden y un id de evento pueden coincidir en número: son informes distintos.
  Entregas e;
  TEST_ASSERT_TRUE(e.agregar(informe("42"), 0));
  TEST_ASSERT_TRUE(e.agregar(informeManual("42"), 0));
  TEST_ASSERT_EQUAL_UINT8(2, e.pendientes());
  TEST_ASSERT_FALSE(e.agregar(informeManual("42"), 0));  // pero cada uno una sola vez
  TEST_ASSERT_FALSE(e.agregar(informe("42"), 0));
}

void test_la_respuesta_de_una_orden_no_cierra_el_informe_de_un_evento() {
  Entregas e;
  e.agregar(informe("42"), 0);
  e.agregar(informeManual("42"), 0);
  const Informe* primero = e.debeEnviar(0);
  TEST_ASSERT_TRUE(primero != nullptr);
  TEST_ASSERT_FALSE(primero->manual);
  e.enviado("42", 0, false);
  e.alResponder("42", 204, 10, true);  // la respuesta es de la orden: no toca al del evento en vuelo
  TEST_ASSERT_EQUAL_UINT8(2, e.pendientes());
  e.alResponder("42", 204, 20, false);
  TEST_ASSERT_EQUAL_UINT8(1, e.pendientes());
  const Informe* siguiente = e.debeEnviar(20);
  TEST_ASSERT_TRUE(siguiente != nullptr);
  TEST_ASSERT_TRUE(siguiente->manual);
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_el_id_de_una_orden_no_se_confunde_con_el_de_un_evento);
  RUN_TEST(test_la_respuesta_de_una_orden_no_cierra_el_informe_de_un_evento);
  RUN_TEST(test_clasificacion_de_codigos);
  RUN_TEST(test_204_lo_da_por_entregado_y_no_se_vuelve_a_enviar);
  RUN_TEST(test_un_solo_informe_por_apertura);
  RUN_TEST(test_sin_red_reintenta_con_espera_creciente);
  RUN_TEST(test_esperaTras_crece_y_se_topa);
  RUN_TEST(test_429_y_5xx_reintentan);
  RUN_TEST(test_otro_4xx_se_descarta_sin_reintentar);
  RUN_TEST(test_pasado_el_plazo_se_descarta);
  RUN_TEST(test_envio_sin_respuesta_se_da_por_fallido_y_se_reintenta);
  RUN_TEST(test_de_a_uno_en_vuelo_y_en_orden);
  RUN_TEST(test_un_informe_que_falla_no_traba_a_los_demas);
  RUN_TEST(test_cola_llena_pierde_el_mas_viejo);
  RUN_TEST(test_respuesta_de_un_evento_desconocido_se_ignora);
  RUN_TEST(test_si_no_se_pudo_encolar_sigue_tocando);
  return UNITY_END();
}
