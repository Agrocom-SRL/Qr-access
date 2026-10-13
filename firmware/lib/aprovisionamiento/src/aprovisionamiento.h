// Aprovisionamiento por serie (ADR 0009 y 0025): interpreta y valida las líneas de
// comando con las que se cargan la URL de la API y el código de vinculación de la
// placa (y, solo para desarrollo o recuperación, la credencial del dispositivo).
// No hay WiFi: la placa va por Ethernet. Lógica PURA: la escritura en NVS la hace src/config.
//
//   ayuda                       lista los comandos
//   estado                      muestra qué hay cargado (nunca las claves)
//   set <campo> <valor>         guarda un campo
//   borrar                      borra lo aprovisionado (solo NVS del dispositivo)
//   reiniciar                   reinicia para aplicar los cambios
//
// Campos: api_url, codigo, disp_id, disp_clave.
#pragma once

#include <stddef.h>

namespace aprovisionamiento {

constexpr size_t MAX_LINEA = 256;
constexpr size_t MAX_VALOR = 128;

enum class Campo { ApiUrl, Codigo, DispositivoId, DispositivoClave };
enum class Tipo { Vacio, Ayuda, Estado, Fijar, Borrar, Reiniciar, Invalido };
enum class Error { Ninguno, ComandoDesconocido, CampoDesconocido, ValorInvalido };

struct Comando {
  Tipo tipo = Tipo::Vacio;
  Error error = Error::Ninguno;
  Campo campo = Campo::ApiUrl;
  char valor[MAX_VALOR + 1] = {0};  // validado; para ApiUrl, sin "/" final
};

// `permitirHttp`: solo compilaciones de desarrollo aceptan una URL http://.
Comando interpretar(const char* linea, bool permitirHttp);

// Nombre del campo tal como se escribe en el comando (para mensajes).
const char* nombre(Campo campo);

// Lo mismo que se exige al guardar, para validar lo que ya está en NVS.
bool urlValida(const char* url, bool permitirHttp);
bool idValido(const char* id);
bool claveValida(const char* clave);

/// Código de vinculación (ADR 0025): 16 caracteres Crockford base32 en mayúsculas
/// (sin I, L, O ni U). Lo sortea el servidor al registrar la placa.
constexpr size_t LARGO_CODIGO = 16;
bool codigoValido(const char* codigo);

/// Clave nueva de la placa (ADR 0025 §4): `cantidad` bytes aleatorios en hexadecimal
/// minúscula (2 caracteres por byte) más el NUL. false si `salida` no alcanza.
/// Los bytes los sortea quien llama con el generador del hardware (esp_random).
bool claveDesdeBytes(const unsigned char* bytes, size_t cantidad, char* salida, size_t capacidad);

// "Dispositivo <id>.<clave>" en `salida`. false si id o clave no son válidos
// (no se puede inyectar nada en el encabezado) o no caben.
bool armarAutorizacion(const char* id, const char* clave, char* salida, size_t capacidad);

}  // namespace aprovisionamiento
