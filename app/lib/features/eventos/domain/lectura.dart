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

/// Una lectura: un intento de lectura de un QR (o una apertura desde la app,
/// ADR 0035) en una puerta de la cuenta,
/// aceptado o rechazado (tabla `lecturas`). Es de solo lectura: la
/// bitácora no se edita ni se borra (invariante 4).
@immutable
class Lectura {
  const new({
    required this.id,
    required this.ocurridoAt,
    required this.resultado,
    required this.motivoCode,
    required this.puertaNombre,
    required this.sitioNombre,
    this.esManual = false,
    this.qrEtiqueta,
    this.generadorEtiqueta,
  });

  final String id;

  /// Momento del intento, en UTC.
  final DateTime ocurridoAt;
  final ResultadoEvento resultado;

  /// Código del motivo (`acceso.permitido`, `qr.vencido`…). La presentación
  /// lo traduce.
  final String motivoCode;
  final String puertaNombre;
  final String sitioNombre;

  /// Apertura pedida desde la app, sin QR (ADR 0035). No tiene etiqueta de QR
  /// ni generador: el detalle dice que se abrió desde la app.
  final bool esManual;

  /// Etiqueta del QR leído y de quien lo generó; `null` si no era un QR de
  /// la cuenta.
  final String? qrEtiqueta;
  final String? generadorEtiqueta;

  bool get esPermitido => resultado == ResultadoEvento.permitido;
}

/// Filtros del listado y del resumen (HU-15): resultado, puerta y ventana.
@immutable
class FiltroEventos {
  const new({this.resultado, this.puertaId, this.desde, this.hasta});

  final ResultadoEvento? resultado;
  final String? puertaId;
  final DateTime? desde;
  final DateTime? hasta;

  @override
  bool operator ==(Object other) =>
      other is FiltroEventos &&
      other.resultado == resultado &&
      other.puertaId == puertaId &&
      other.desde == desde &&
      other.hasta == hasta;

  @override
  int get hashCode => Object.hash(resultado, puertaId, desde, hasta);

  FiltroEventos copiar({
    ResultadoEvento? resultado,
    bool quitarResultado = false,
    String? puertaId,
    bool quitarPuerta = false,
  }) => FiltroEventos(
    resultado: quitarResultado ? null : (resultado ?? this.resultado),
    puertaId: quitarPuerta ? null : (puertaId ?? this.puertaId),
    desde: desde,
    hasta: hasta,
  );
}

/// Conteos de un período (indicadores del tablero).
@immutable
class ResumenEventos {
  const new({
    required this.permitidos,
    required this.rechazados,
    required this.rechazadosPorMotivo,
  });

  final int permitidos;
  final int rechazados;
  final Map<String, int> rechazadosPorMotivo;

  /// El motivo de rechazo más frecuente, para la nota del indicador.
  MapEntry<String, int>? get motivoPrincipal => rechazadosPorMotivo.isEmpty
      ? null
      : rechazadosPorMotivo.entries.reduce(
          (a, b) => a.value >= b.value ? a : b,
        );
}
