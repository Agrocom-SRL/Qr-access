import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:flutter/foundation.dart';

/// Puerta a la que sirve un QR: solo `id` y nombre, como la devuelve la API.
@immutable
class PuertaDeQr {
  const new({required this.id, required this.nombre});

  final String id;
  final String nombre;
}

/// QR que la persona ya emitió, tal como aparece en el listado. No trae el
/// `texto` del token: ese solo llega al emitirlo (ADR 0008).
@immutable
class QrAcceso {
  const new({
    required this.id,
    required this.etiqueta,
    required this.estado,
    required this.venceAt,
    required this.usadoAt,
    required this.anuladoAt,
    required this.creadoAt,
    required this.puertas,
  });

  final String id;

  /// Nota libre de quien lo emitió (D-21). `null` si no se escribió una.
  final String? etiqueta;
  final EstadoQr estado;
  final DateTime venceAt;
  final DateTime? usadoAt;
  final DateTime? anuladoAt;
  final DateTime creadoAt;
  final List<PuertaDeQr> puertas;

  /// Solo un QR vigente se puede anular: los demás ya no abren nada.
  bool get puedeAnularse => estado == EstadoQr.vigente;
}

/// QR recién emitido. `texto` es el token en claro: vive solo en la pantalla
/// que lo muestra y comparte, nunca se guarda (ADR 0008).
@immutable
class QrEmitido {
  const new({
    required this.id,
    required this.texto,
    required this.venceAt,
    required this.etiqueta,
    required this.puertas,
  });

  final String id;
  final String texto;
  final DateTime venceAt;
  final String? etiqueta;
  final List<PuertaDeQr> puertas;
}
