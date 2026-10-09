#include "tiempo.h"

namespace tiempo {

namespace {

// Fecha civil de un día contado desde 1970-01-01 (algoritmo de H. Hinnant).
void fechaCivil(int64_t dias, int64_t& anio, int& mes, int& dia) {
  dias += 719468;
  const int64_t era = (dias >= 0 ? dias : dias - 146096) / 146097;
  const int64_t diaEra = dias - era * 146097;
  const int64_t anioEra = (diaEra - diaEra / 1460 + diaEra / 36524 - diaEra / 146096) / 365;
  const int64_t diaAnio = diaEra - (365 * anioEra + anioEra / 4 - anioEra / 100);
  const int64_t mp = (5 * diaAnio + 2) / 153;
  dia = static_cast<int>(diaAnio - (153 * mp + 2) / 5 + 1);
  mes = static_cast<int>(mp < 10 ? mp + 3 : mp - 9);
  anio = anioEra + era * 400 + (mes <= 2 ? 1 : 0);
}

void escribirDigitos(char* destino, int64_t valor, int cantidad) {
  for (int i = cantidad - 1; i >= 0; --i) {
    destino[i] = static_cast<char>('0' + valor % 10);
    valor /= 10;
  }
}

}  // namespace

bool valida(int64_t epoch) { return epoch >= EPOCH_MINIMO_VALIDO && epoch < EPOCH_MAXIMO_VALIDO; }

bool formatearIso(int64_t epoch, char* salida, size_t capacidad) {
  if (salida == nullptr || capacidad == 0) return false;
  salida[0] = '\0';
  if (capacidad < CAPACIDAD_ISO || !valida(epoch)) return false;

  int64_t anio = 0;
  int mes = 0;
  int dia = 0;
  fechaCivil(epoch / 86400, anio, mes, dia);
  const int64_t segundosDelDia = epoch % 86400;

  escribirDigitos(salida, anio, 4);
  salida[4] = '-';
  escribirDigitos(salida + 5, mes, 2);
  salida[7] = '-';
  escribirDigitos(salida + 8, dia, 2);
  salida[10] = 'T';
  escribirDigitos(salida + 11, segundosDelDia / 3600, 2);
  salida[13] = ':';
  escribirDigitos(salida + 14, (segundosDelDia % 3600) / 60, 2);
  salida[16] = ':';
  escribirDigitos(salida + 17, segundosDelDia % 60, 2);
  salida[19] = 'Z';
  salida[20] = '\0';
  return true;
}

}  // namespace tiempo
