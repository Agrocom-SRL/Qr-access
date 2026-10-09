import 'package:flutter/foundation.dart';

/// Resultado de un intento de acceso (ADR 0007).
enum ResultadoEvento {
  permitido('permitido'),
  rechazado('rechazado');

  new(this.valorApi);

  final String valorApi;

  static ResultadoEvento desdeApi(String valor) =>
      ResultadoEvento.values.firstWhere(
        (resultado) => resultado.valorApi == valor,
        orElse: () => throw FormatException('Resultado desconocido: $valor'),
      );
}

/// Un intento de acceso en una puerta de la cuenta. Es de solo lectura: la
/// bitácora no se edita ni se borra (invariante 4).
@immutable
class EventoAcceso {
  const new({
    required this.id,
    required this.ocurridoAt,
    required this.resultado,
    required this.motivoCode,
    required this.puertaNombre,
  });

  final String id;

  /// Momento del intento, en UTC.
  final DateTime ocurridoAt;
  final ResultadoEvento resultado;

  /// Código del motivo (`acceso.permitido`, `qr.vencido`…). La presentación
  /// lo traduce.
  final String motivoCode;
  final String puertaNombre;
}
