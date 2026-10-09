import 'package:flutter/foundation.dart';

/// Vigencia que la persona puede elegir al emitir (handoff C05b). Por defecto
/// el fin del día local del sitio: lo calcula la API (ADR 0008, D-16), así que
/// la app no envía `vence_at`. Las demás: un plazo corto (1, 2 o 4 h), uno
/// largo (8, 12 o 18 h) o una hora concreta del día.
enum OpcionVigencia {
  finDelDia(null),
  unaHora(1),
  dosHoras(2),
  cuatroHoras(4),
  ochoHoras(8),
  doceHoras(12),
  dieciochoHoras(18),
  horaExacta(null);

  new(this.horas);

  /// Horas de vigencia desde la emisión; `null` cuando no es un plazo fijo.
  final int? horas;

  /// Plazos de [corta] (hasta 4 h).
  static const List<OpcionVigencia> corta = [unaHora, dosHoras, cuatroHoras];

  /// Plazos de la vigencia larga (de 8 h en adelante).
  static const List<OpcionVigencia> larga = [
    ochoHoras,
    doceHoras,
    dieciochoHoras,
  ];

  bool get esCorta => corta.contains(this);
  bool get esLarga => larga.contains(this);
}

/// La vigencia elegida con, si hace falta, la hora exacta.
@immutable
class Vigencia {
  const new(this.opcion, {this.minutosDelDia});

  static const porDefecto = Vigencia(OpcionVigencia.finDelDia);

  final OpcionVigencia opcion;

  /// Hora local elegida en [OpcionVigencia.horaExacta], en minutos desde la
  /// medianoche (sin tipos de Flutter: el dominio es Dart puro).
  final int? minutosDelDia;

  /// Momento de vencimiento en UTC, o `null` para dejar que la API decida.
  DateTime? venceAtPara(DateTime ahora) {
    final horas = opcion.horas;
    if (horas != null) return ahora.toUtc().add(Duration(hours: horas));
    final minutos = minutosDelDia;
    if (opcion != OpcionVigencia.horaExacta || minutos == null) return null;
    final local = ahora.toLocal();
    return DateTime(
      local.year,
      local.month,
      local.day,
      minutos ~/ 60,
      minutos % 60,
    ).toUtc();
  }

  /// Una hora exacta que ya pasó no sirve: la API la rechazaría.
  bool esValidaEn(DateTime ahora) {
    final vence = venceAtPara(ahora);
    return vence == null || vence.isAfter(ahora.toUtc());
  }
}

/// Qué está mal en lo que la persona escribió para emitir un QR.
enum ErrorDatosEmision { sinPuertas, etiquetaLarga, vigenciaPasada }

/// Datos validados para emitir un QR (HU-11). El constructor exige que
/// `errorDe` sea `null`: una instancia siempre cumple las reglas.
@immutable
class DatosEmision {
  new({
    required Set<String> puertaIds,
    required this.vigencia,
    required String etiqueta,
    required DateTime ahora,
  }) : assert(
         errorDe(
               puertaIds: puertaIds,
               etiqueta: etiqueta,
               vigencia: vigencia,
               ahora: ahora,
             ) ==
             null,
         'Los datos de emisión tienen que validarse antes',
       ),
       puertaIds = puertaIds.toList(),
       etiqueta = _etiquetaLimpia(etiqueta);

  /// Largo máximo de la etiqueta en la app (handoff: 40; la API admite 60).
  static const largoMaximoEtiqueta = 40;

  final List<String> puertaIds;
  final Vigencia vigencia;

  /// Nota libre, sin espacios sobrantes; `null` si no se escribió nada.
  final String? etiqueta;

  /// Devuelve el primer error de los datos, o `null` si son válidos. Sin
  /// puertas no hay QR; la etiqueta es una nota corta (D-21).
  static ErrorDatosEmision? errorDe({
    required Set<String> puertaIds,
    required String etiqueta,
    required Vigencia vigencia,
    required DateTime ahora,
  }) {
    if (puertaIds.isEmpty) return ErrorDatosEmision.sinPuertas;
    if (etiqueta.trim().length > largoMaximoEtiqueta) {
      return ErrorDatosEmision.etiquetaLarga;
    }
    if (!vigencia.esValidaEn(ahora)) return ErrorDatosEmision.vigenciaPasada;
    return null;
  }
}

String? _etiquetaLimpia(String etiqueta) {
  final limpia = etiqueta.trim();
  return limpia.isEmpty ? null : limpia;
}

/// Lo que "Repetir último" trae al formulario (handoff C04a).
@immutable
class PrellenadoEmision {
  const new({required this.puertaIds, this.etiqueta});

  final Set<String> puertaIds;
  final String? etiqueta;
}
