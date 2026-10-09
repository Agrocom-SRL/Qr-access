import 'package:flutter/foundation.dart';

/// Puerta de una cuenta, como la necesita la app: para elegirla al emitir un
/// QR (ADR 0008). La app no la crea ni la edita en V1.
@immutable
class Puerta {
  const new({
    required this.id,
    required this.nombre,
    required this.sitioNombre,
  });

  final String id;
  final String nombre;
  final String sitioNombre;
}
