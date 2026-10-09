import 'package:flutter/foundation.dart';

/// Plazos de vigencia que la persona puede elegir al emitir (handoff C05b):
/// por **horas** (cortas 1, 2, 4, 8; largas 12, 16, 20, 24; o una hora exacta
/// del día) o por **días** (2, 3, 5, 7, o todo el día). Por defecto, 2 horas.
/// La API acepta hasta el máximo del plan, con techo de 7 días (ADR 0020).
enum OpcionVigencia {
  unaHora(horas: 1),
  dosHoras(horas: 2),
  cuatroHoras(horas: 4),
  ochoHoras(horas: 8),
  doceHoras(horas: 12),
  dieciseisHoras(horas: 16),
  veinteHoras(horas: 20),
  veinticuatroHoras(horas: 24),
  horaExacta(),
  dosDias(dias: 2),
  tresDias(dias: 3),
  cincoDias(dias: 5),
  sieteDias(dias: 7),

  /// "Todo el día": la API la calcula como el fin del día local del sitio
  /// (ADR 0008, D-16), así que la app no envía `vence_at`.
  finDelDia();

  new({this.horas, this.dias});

  /// Horas de vigencia desde la emisión; `null` si no es un plazo en horas.
  final int? horas;

  /// Días de vigencia desde la emisión; `null` si no es un plazo en días.
  final int? dias;

  /// Plazos del bloque corto (hasta 8 h).
  static const List<OpcionVigencia> corta = [
    unaHora,
    dosHoras,
    cuatroHoras,
    ochoHoras,
  ];

  /// Plazos del bloque largo (de 12 a 24 h).
  static const List<OpcionVigencia> larga = [
    doceHoras,
    dieciseisHoras,
    veinteHoras,
    veinticuatroHoras,
  ];

  /// Plazos del modo días.
  static const List<OpcionVigencia> enDias = [
    dosDias,
    tresDias,
    cincoDias,
    sieteDias,
  ];

  bool get esCorta => corta.contains(this);
  bool get esLarga => larga.contains(this);

  /// Pertenece al modo días (incluye "todo el día").
  bool get esDeDias => enDias.contains(this) || this == finDelDia;
}

/// La vigencia elegida con, si hace falta, la hora exacta.
@immutable
class Vigencia {
  const new(this.opcion, {this.minutosDelDia});

  static const porDefecto = Vigencia(OpcionVigencia.dosHoras);

  final OpcionVigencia opcion;

  /// Hora local elegida en [OpcionVigencia.horaExacta], en minutos desde la
  /// medianoche (sin tipos de Flutter: el dominio es Dart puro).
  final int? minutosDelDia;

  /// Momento de vencimiento en UTC, o `null` para dejar que la API decida.
  DateTime? venceAtPara(DateTime ahora) {
    final horas = opcion.horas;
    if (horas != null) return ahora.toUtc().add(Duration(hours: horas));
    final dias = opcion.dias;
    if (dias != null) return ahora.toUtc().add(Duration(days: dias));
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
