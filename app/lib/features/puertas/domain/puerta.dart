import 'package:flutter/foundation.dart';

/// Lector de una puerta y si reportó hace poco (HU-09).
@immutable
class DispositivoDePuerta {
  const new({
    required this.id,
    required this.nombre,
    required this.enLinea,
    required this.ultimoLatidoAt,
  });

  final String id;
  final String nombre;
  final bool enLinea;

  /// Último latido en UTC; `null` si nunca reportó.
  final DateTime? ultimoLatidoAt;
}

/// Puerta de una cuenta, como la necesita la app: para elegirla al emitir un
/// QR (ADR 0008) y para supervisarla (Administración › Puertas).
@immutable
class Puerta {
  const new({
    required this.id,
    required this.nombre,
    required this.sitioId,
    required this.sitioNombre,
    this.dispositivo,
  });

  final String id;
  final String nombre;
  final String sitioId;
  final String sitioNombre;

  /// `null` si la puerta no tiene lector.
  final DispositivoDePuerta? dispositivo;

  /// Sin lector o con el lector sin reportar, la puerta no abre: se avisa.
  bool get sinConexion => !(dispositivo?.enLinea ?? false);
}
