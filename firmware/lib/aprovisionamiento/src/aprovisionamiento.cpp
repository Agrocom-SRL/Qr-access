#include "aprovisionamiento.h"

#include <string.h>

namespace aprovisionamiento {

namespace {

struct NombreCampo {
  const char* texto;
  Campo campo;
};

constexpr NombreCampo CAMPOS[] = {
    {"api_url", Campo::ApiUrl},
    {"codigo", Campo::Codigo},
    {"disp_id", Campo::DispositivoId},
    {"disp_clave", Campo::DispositivoClave},
};

bool esEspacio(char c) { return c == ' ' || c == '\t'; }
bool esFinDeLinea(char c) { return c == '\r' || c == '\n'; }
bool esVisible(char c) { return c > 0x20 && c < 0x7f; }

bool empiezaCon(const char* texto, const char* prefijo) {
  return strncmp(texto, prefijo, strlen(prefijo)) == 0;
}

bool valorValido(Campo campo, const char* valor, bool permitirHttp) {
  switch (campo) {
    case Campo::ApiUrl: return urlValida(valor, permitirHttp);
    case Campo::Codigo: return codigoValido(valor);
    case Campo::DispositivoId: return idValido(valor);
    case Campo::DispositivoClave: return claveValida(valor);
  }
  return false;
}

Comando invalido(Error error) {
  Comando comando;
  comando.tipo = Tipo::Invalido;
  comando.error = error;
  return comando;
}

}  // namespace

const char* nombre(Campo campo) {
  for (const NombreCampo& entrada : CAMPOS) {
    if (entrada.campo == campo) return entrada.texto;
  }
  return "";
}

bool urlValida(const char* url, bool permitirHttp) {
  if (url == nullptr) return false;
  const size_t largo = strlen(url);
  if (largo > MAX_VALOR) return false;

  size_t inicioHost = 0;
  if (empiezaCon(url, "https://")) {
    inicioHost = 8;
  } else if (permitirHttp && empiezaCon(url, "http://")) {
    inicioHost = 7;
  } else {
    return false;
  }
  if (largo <= inicioHost) return false;
  for (size_t i = 0; i < largo; ++i) {
    if (!esVisible(url[i])) return false;  // sin espacios ni caracteres de control
  }
  return url[inicioHost] != '/' && url[inicioHost] != ':';
}

bool idValido(const char* id) {
  if (id == nullptr) return false;
  const size_t largo = strlen(id);
  if (largo < 1 || largo > 64) return false;
  for (size_t i = 0; i < largo; ++i) {
    const char c = id[i];
    const bool permitido = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') ||
                           (c >= 'A' && c <= 'Z') || c == '-' || c == '_';
    if (!permitido) return false;  // sin "." porque separa id y clave en el encabezado
  }
  return true;
}

bool claveValida(const char* clave) {
  if (clave == nullptr) return false;
  const size_t largo = strlen(clave);
  if (largo < 8 || largo > MAX_VALOR) return false;
  for (size_t i = 0; i < largo; ++i) {
    if (!esVisible(clave[i])) return false;
  }
  return true;
}

bool codigoValido(const char* codigo) {
  if (codigo == nullptr || strlen(codigo) != LARGO_CODIGO) return false;
  for (size_t i = 0; i < LARGO_CODIGO; ++i) {
    const char c = codigo[i];
    const bool permitido = (c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z');
    if (!permitido || c == 'I' || c == 'L' || c == 'O' || c == 'U') return false;
  }
  return true;
}

bool claveDesdeBytes(const unsigned char* bytes, size_t cantidad, char* salida, size_t capacidad) {
  if (salida == nullptr || capacidad == 0) return false;
  salida[0] = '\0';
  if (bytes == nullptr || cantidad == 0 || capacidad < cantidad * 2 + 1) return false;
  static const char HEX[] = "0123456789abcdef";
  for (size_t i = 0; i < cantidad; ++i) {
    salida[i * 2] = HEX[bytes[i] >> 4];
    salida[i * 2 + 1] = HEX[bytes[i] & 0x0f];
  }
  salida[cantidad * 2] = '\0';
  return true;
}

bool armarAutorizacion(const char* id, const char* clave, char* salida, size_t capacidad) {
  if (salida == nullptr || capacidad == 0) return false;
  salida[0] = '\0';
  if (!idValido(id) || !claveValida(clave)) return false;
  static const char PREFIJO[] = "Dispositivo ";
  const size_t largoPrefijo = sizeof(PREFIJO) - 1;
  const size_t largoId = strlen(id);
  const size_t largoClave = strlen(clave);
  if (largoPrefijo + largoId + 1 + largoClave + 1 > capacidad) return false;

  memcpy(salida, PREFIJO, largoPrefijo);
  memcpy(salida + largoPrefijo, id, largoId);
  salida[largoPrefijo + largoId] = '.';
  memcpy(salida + largoPrefijo + largoId + 1, clave, largoClave + 1);
  return true;
}

Comando interpretar(const char* linea, bool permitirHttp) {
  Comando comando;
  if (linea == nullptr) return comando;

  size_t largo = strnlen(linea, MAX_LINEA + 1);
  if (largo > MAX_LINEA) return invalido(Error::ComandoDesconocido);
  while (largo > 0 && esFinDeLinea(linea[largo - 1])) --largo;

  size_t i = 0;
  while (i < largo && esEspacio(linea[i])) ++i;
  if (i == largo) return comando;  // línea vacía

  const size_t inicioVerbo = i;
  while (i < largo && !esEspacio(linea[i])) ++i;
  const size_t largoVerbo = i - inicioVerbo;
  const char* verbo = linea + inicioVerbo;
  const auto es = [&](const char* texto) {
    return strlen(texto) == largoVerbo && strncmp(verbo, texto, largoVerbo) == 0;
  };

  if (!es("set")) {
    if (es("ayuda")) comando.tipo = Tipo::Ayuda;
    else if (es("estado")) comando.tipo = Tipo::Estado;
    else if (es("borrar")) comando.tipo = Tipo::Borrar;
    else if (es("reiniciar")) comando.tipo = Tipo::Reiniciar;
    else return invalido(Error::ComandoDesconocido);
    return comando;
  }

  while (i < largo && esEspacio(linea[i])) ++i;
  const size_t inicioCampo = i;
  while (i < largo && !esEspacio(linea[i])) ++i;
  const size_t largoCampo = i - inicioCampo;

  bool encontrado = false;
  for (const NombreCampo& entrada : CAMPOS) {
    if (strlen(entrada.texto) == largoCampo &&
        strncmp(linea + inicioCampo, entrada.texto, largoCampo) == 0) {
      comando.campo = entrada.campo;
      encontrado = true;
      break;
    }
  }
  if (!encontrado) return invalido(Error::CampoDesconocido);

  // El valor es el resto de la línea después de UN espacio: un SSID puede llevar espacios.
  if (i < largo) ++i;
  const size_t largoValor = largo - i;
  if (largoValor > MAX_VALOR) return invalido(Error::ValorInvalido);
  memcpy(comando.valor, linea + i, largoValor);
  comando.valor[largoValor] = '\0';

  if (!valorValido(comando.campo, comando.valor, permitirHttp)) {
    memset(comando.valor, 0, sizeof(comando.valor));
    return invalido(Error::ValorInvalido);
  }
  if (comando.campo == Campo::ApiUrl) {
    size_t n = strlen(comando.valor);
    while (n > 0 && comando.valor[n - 1] == '/') comando.valor[--n] = '\0';
  }
  comando.tipo = Tipo::Fijar;
  return comando;
}

}  // namespace aprovisionamiento
