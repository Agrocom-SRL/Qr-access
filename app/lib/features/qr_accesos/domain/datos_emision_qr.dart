import 'package:flutter/foundation.dart';

/// Vigencia que la persona puede elegir al emitir. Por defecto, el fin del día
/// local del sitio: lo calcula la API (ADR 0008, D-16), así que la app no envía
/// `vence_at`. Las demás son vigencias más cortas, en horas.
enum OpcionVigencia {
  finDelDia(horas: null),
  unaHora(horas: 1),
  cuatroHoras(horas: 4);

  new({required this.horas});

  /// Horas de vigencia desde la emisión; `null` cuando vence al fin del día.
  final int? horas;

  /// Momento de vencimiento en UTC, o `null` para dejar que la API decida.
  DateTime? venceAtPara(DateTime ahora) {
    final horas = this.horas;
    if (horas == null) return null;
    return ahora.toUtc().add(Duration(hours: horas));
  }
}

/// Qué está mal en lo que la persona escribió para emitir un QR.
enum ErrorDatosEmision { sinPuertas, etiquetaLarga }

/// Datos validados para emitir un QR (HU-11). El constructor exige que
/// `errorDe` sea `null`: una instancia siempre cumple las reglas.
@immutable
class DatosEmision {
  new({
    required Set<String> puertaIds,
    required this.vigencia,
    required String etiqueta,
  }) : assert(
         errorDe(puertaIds: puertaIds, etiqueta: etiqueta) == null,
         'Los datos de emisión tienen que validarse antes',
       ),
       puertaIds = puertaIds.toList(),
       etiqueta = _etiquetaLimpia(etiqueta);

  /// Largo máximo de la etiqueta (contrato V1: `etiqueta?(≤60)`).
  static const largoMaximoEtiqueta = 60;

  final List<String> puertaIds;
  final OpcionVigencia vigencia;

  /// Nota libre, sin espacios sobrantes; `null` si no se escribió nada.
  final String? etiqueta;

  /// Devuelve el primer error de los datos, o `null` si son válidos. Sin
  /// puertas no hay QR; la etiqueta es una nota corta (D-21).
  static ErrorDatosEmision? errorDe({
    required Set<String> puertaIds,
    required String etiqueta,
  }) {
    if (puertaIds.isEmpty) return ErrorDatosEmision.sinPuertas;
    if (etiqueta.trim().length > largoMaximoEtiqueta) {
      return ErrorDatosEmision.etiquetaLarga;
    }
    return null;
  }
}

String? _etiquetaLimpia(String etiqueta) {
  final limpia = etiqueta.trim();
  return limpia.isEmpty ? null : limpia;
}
