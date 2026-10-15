import 'package:flutter/foundation.dart';

/// Una puerta de la cuenta como la gestiona el administrador (HU-07).
@immutable
class PuertaGestionada {
  const new({
    required this.id,
    required this.nombre,
    required this.segundosApertura,
    required this.activa,
    required this.tieneLector,
  });

  final String id;
  final String nombre;

  /// Cuánto queda abierta la cerradura tras una validación positiva.
  final int segundosApertura;
  final bool activa;

  /// Con un lector vinculado no se puede eliminar (lo libera AGROCOM).
  final bool tieneLector;
}

/// Un sitio de la cuenta con todas sus puertas.
@immutable
class SitioGestionado {
  const new({
    required this.id,
    required this.nombre,
    required this.direccion,
    required this.puertas,
  });

  final String id;
  final String nombre;
  final String? direccion;
  final List<PuertaGestionada> puertas;
}

/// Límites de `segundos_apertura` en la API.
const segundosAperturaMinimos = 1;
const segundosAperturaMaximos = 30;
const segundosAperturaPorDefecto = 5;

/// Largo máximo de los nombres y de la dirección en la API.
const largoMaximoNombreEstructura = 120;
const largoMaximoDireccion = 255;

/// Datos validados del formulario de un sitio.
@immutable
class DatosSitio {
  const new({required this.nombre, this.direccion});

  final String nombre;
  final String? direccion;
}

/// Datos validados del formulario de una puerta.
@immutable
class DatosPuerta {
  const new({required this.nombre, required this.segundosApertura});

  final String nombre;
  final int segundosApertura;
}

/// ¿Es válido el texto de segundos de apertura? `null` si no.
int? segundosValidos(String texto) {
  final segundos = int.tryParse(texto.trim());
  if (segundos == null ||
      segundos < segundosAperturaMinimos ||
      segundos > segundosAperturaMaximos) {
    return null;
  }
  return segundos;
}
