import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:flutter/foundation.dart';

/// Un intento de lectura del QR en una puerta, aceptado o rechazado (ADR 0007).
@immutable
class IntentoQr {
  const new({
    required this.ocurridoAt,
    required this.permitido,
    required this.motivoCode,
    required this.puertaNombre,
  });

  final DateTime ocurridoAt;
  final bool permitido;

  /// Código del motivo (`acceso.permitido`, `qr.usado`…): la presentación lo
  /// traduce.
  final String motivoCode;
  final String puertaNombre;
}

/// Qué pasó con un QR que se está mostrando: su estado y el último intento
/// de lectura. Lo sabe solo el servidor; el lector no habla con la app.
@immutable
class SeguimientoQr {
  const new({required this.estado, required this.ultimoIntento});

  final EstadoQr estado;

  /// `null` si nadie lo ha acercado a un lector.
  final IntentoQr? ultimoIntento;

  /// La puerta lo aceptó: el QR ya cumplió su único uso.
  bool get concedido => ultimoIntento?.permitido ?? false;

  /// Código del motivo por el que el QR ya no sirve, o `null` si sigue
  /// vigente y nadie lo rechazó. Un rechazo manda; si no hubo lectura pero el
  /// QR ya no vale (vencido o anulado en otro dispositivo), se deriva del
  /// estado.
  String? get motivoDeRechazo {
    final intento = ultimoIntento;
    if (intento != null && !intento.permitido) return intento.motivoCode;
    return switch (estado) {
      EstadoQr.vencido => 'qr.vencido',
      EstadoQr.anulado => 'qr.anulado',
      EstadoQr.usado when !concedido => 'qr.usado',
      _ => null,
    };
  }
}
