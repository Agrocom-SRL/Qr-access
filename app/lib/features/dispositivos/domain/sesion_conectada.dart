import 'package:flutter/foundation.dart';

/// Un aparato o navegador con una sesión de mi usuario abierta (ADR 0030 §4.1).
/// Es lo que se lista en "Dispositivos conectados". Sin IP ni secretos.
@immutable
class SesionConectada {
  const new({
    required this.id,
    required this.plataforma,
    required this.dispositivo,
    required this.ultimaActividadAt,
    required this.actual,
  });

  final String id;

  /// `android`, `ios` o `web`; `null` si la sesión no lo declaró.
  final String? plataforma;

  /// Nombre que mandó el cliente. Es texto libre: se muestra tal cual, como
  /// texto plano (ADR 0030 §4.1).
  final String? dispositivo;

  /// Hora de la última petición de esa sesión (UTC).
  final DateTime ultimaActividadAt;

  /// `true` para la sesión desde la que se mira la lista.
  final bool actual;

  /// La sesión de este aparato no se cierra desde aquí: cerrarla es salir, y
  /// eso vive en Perfil. Las demás sí se pueden cerrar.
  bool get puedeCerrarse => !actual;
}

/// Largo máximo del nombre de un dispositivo: lo mismo que recorta la API al
/// guardarlo (60 caracteres).
const largoMaximoNombreDispositivo = 60;

/// Orden de la lista: primero la de este aparato y luego la más reciente.
List<SesionConectada> ordenarSesiones(Iterable<SesionConectada> sesiones) {
  final lista = [...sesiones]
    ..sort((a, b) {
      if (a.actual != b.actual) return a.actual ? -1 : 1;
      return b.ultimaActividadAt.compareTo(a.ultimaActividadAt);
    });
  return lista;
}

/// Cuántas sesiones cerraría "cerrar las demás": todas menos la actual.
int cuantasOtrasSesiones(Iterable<SesionConectada> sesiones) =>
    sesiones.where((sesion) => !sesion.actual).length;
